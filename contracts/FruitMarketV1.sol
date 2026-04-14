// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title FruitMarketV1
 * @notice Marketplace décentralisée pour acheter/vendre des fruits.
 * @dev Utilise le pattern UUPS pour les mises à niveau.
 *      Reentrancy guard implémenté manuellement (compatible proxy, pas de constructeur).
 */
contract FruitMarketV1 is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ──────────────── Reentrancy Guard (proxy-safe) ─────────────────
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }
    // ──────────────────────────── Structs ────────────────────────────

    struct Product {
        uint256 id;
        string name;
        uint256 priceWei;    // prix en wei
        uint256 stock;
        address seller;
        bool isActive;
    }

    struct Purchase {
        uint256 productId;
        address buyer;
        uint256 quantity;
        uint256 totalPaid;
        uint256 timestamp;
    }

    // ──────────────────────────── State ──────────────────────────────

    uint256 public nextProductId;
    mapping(uint256 => Product) public products;
    Purchase[] public purchases;

    // ──────────────────────────── Events ─────────────────────────────

    event ProductAdded(uint256 indexed id, string name, uint256 priceWei, uint256 stock, address indexed seller);
    event ProductUpdated(uint256 indexed id, uint256 newPrice, uint256 newStock);
    event ProductRemoved(uint256 indexed id);
    event ProductPurchased(uint256 indexed id, address indexed buyer, uint256 quantity, uint256 totalPaid);

    // ──────────────────────────── Errors ─────────────────────────────

    error ProductNotFound(uint256 id);
    error NotTheSeller(uint256 id, address caller);
    error ProductInactive(uint256 id);
    error InsufficientStock(uint256 id, uint256 requested, uint256 available);
    error InsufficientPayment(uint256 required, uint256 sent);
    error ZeroQuantity();
    error InvalidPrice();
    error EmptyName();
    error TransferFailed();

    // ──────────────────────────── Modifiers ──────────────────────────

    modifier productExists(uint256 _id) {
        if (_id >= nextProductId) revert ProductNotFound(_id);
        _;
    }

    modifier onlySeller(uint256 _id) {
        if (products[_id].seller != msg.sender) revert NotTheSeller(_id, msg.sender);
        _;
    }

    // ──────────────────────────── Initializer ────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _reentrancyStatus = _NOT_ENTERED;
        nextProductId = 0;
    }

    // ──────────────────────────── Core Logic ─────────────────────────

    /**
     * @notice Ajouter un nouveau produit au marché.
     * @param _name  Nom du fruit
     * @param _priceWei  Prix unitaire en wei
     * @param _stock  Quantité disponible
     */
    function addProduct(
        string calldata _name,
        uint256 _priceWei,
        uint256 _stock
    ) external {
        if (bytes(_name).length == 0) revert EmptyName();
        if (_priceWei == 0) revert InvalidPrice();

        uint256 id = nextProductId;
        products[id] = Product({
            id: id,
            name: _name,
            priceWei: _priceWei,
            stock: _stock,
            seller: msg.sender,
            isActive: true
        });

        nextProductId++;
        emit ProductAdded(id, _name, _priceWei, _stock, msg.sender);
    }

    /**
     * @notice Mettre à jour le prix et le stock d'un produit existant.
     */
    function updateProduct(
        uint256 _id,
        uint256 _newPrice,
        uint256 _newStock
    ) external productExists(_id) onlySeller(_id) {
        if (_newPrice == 0) revert InvalidPrice();

        Product storage p = products[_id];
        p.priceWei = _newPrice;
        p.stock = _newStock;

        emit ProductUpdated(_id, _newPrice, _newStock);
    }

    /**
     * @notice Retirer un produit (le rend inactif).
     */
    function removeProduct(uint256 _id)
        external
        productExists(_id)
        onlySeller(_id)
    {
        products[_id].isActive = false;
        emit ProductRemoved(_id);
    }

    /**
     * @notice Acheter un produit. Le paiement est envoyé directement au vendeur.
     * @param _id  Identifiant du produit
     * @param _quantity  Quantité à acheter
     */
    function buyProduct(uint256 _id, uint256 _quantity)
        external
        payable
        productExists(_id)
        nonReentrant
    {
        if (_quantity == 0) revert ZeroQuantity();

        Product storage p = products[_id];
        if (!p.isActive) revert ProductInactive(_id);
        if (p.stock < _quantity) revert InsufficientStock(_id, _quantity, p.stock);

        uint256 totalCost = p.priceWei * _quantity;
        if (msg.value < totalCost) revert InsufficientPayment(totalCost, msg.value);

        // Checks-Effects-Interactions : mise à jour du stock AVANT le transfert
        p.stock -= _quantity;

        // Enregistrer l'achat
        purchases.push(Purchase({
            productId: _id,
            buyer: msg.sender,
            quantity: _quantity,
            totalPaid: totalCost,
            timestamp: block.timestamp
        }));

        // Transférer les fonds au vendeur
        (bool ok, ) = payable(p.seller).call{value: totalCost}("");
        if (!ok) revert TransferFailed();

        // Rembourser le surplus éventuel
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool refundOk, ) = payable(msg.sender).call{value: excess}("");
            if (!refundOk) revert TransferFailed();
        }

        emit ProductPurchased(_id, msg.sender, _quantity, totalCost);
    }

    // ──────────────────────────── Views ──────────────────────────────

    function getProduct(uint256 _id) external view productExists(_id) returns (Product memory) {
        return products[_id];
    }

    function getPurchaseCount() external view returns (uint256) {
        return purchases.length;
    }

    function getVersion() external pure virtual returns (string memory) {
        return "v1";
    }

    // ──────────────────────────── UUPS ───────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
