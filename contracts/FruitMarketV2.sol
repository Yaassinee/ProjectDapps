// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FruitMarketV1.sol";

/**
 * @title FruitMarketV2
 * @notice Version 2 : ajoute un système d'évaluation des vendeurs.
 * @dev Hérite de V1 et ajoute de nouveaux slots de stockage APRÈS ceux de V1.
 */
contract FruitMarketV2 is FruitMarketV1 {
    // ──────────────────── Nouveau stockage V2 ───────────────────────

    struct Rating {
        address buyer;
        uint8 score;       // 1 à 5
        string comment;
    }

    /// vendeur => liste de ratings
    mapping(address => Rating[]) public sellerRatings;

    /// acheteur => vendeur => a déjà noté (empêcher les doublons)
    mapping(address => mapping(address => bool)) public hasRated;

    // ──────────────────── Events V2 ─────────────────────────────────

    event SellerRated(address indexed seller, address indexed buyer, uint8 score, string comment);

    // ──────────────────── Errors V2 ─────────────────────────────────

    error InvalidScore(uint8 score);
    error AlreadyRated(address seller);
    error CannotRateSelf();

    // ──────────────────── Nouvelles fonctions ───────────────────────

    /**
     * @notice Évaluer un vendeur. Un acheteur ne peut noter un vendeur qu'une seule fois.
     * @param _seller  Adresse du vendeur
     * @param _score   Note de 1 à 5
     * @param _comment Commentaire libre
     */
    function rateSeller(
        address _seller,
        uint8 _score,
        string calldata _comment
    ) external {
        if (_score < 1 || _score > 5) revert InvalidScore(_score);
        if (msg.sender == _seller) revert CannotRateSelf();
        if (hasRated[msg.sender][_seller]) revert AlreadyRated(_seller);

        hasRated[msg.sender][_seller] = true;
        sellerRatings[_seller].push(Rating({
            buyer: msg.sender,
            score: _score,
            comment: _comment
        }));

        emit SellerRated(_seller, msg.sender, _score, _comment);
    }

    /**
     * @notice Obtenir le nombre d'évaluations et la note moyenne d'un vendeur.
     * @return count   Nombre d'évaluations
     * @return average Note moyenne (multipliée par 100 pour garder 2 décimales)
     */
    function getSellerRating(address _seller)
        external
        view
        returns (uint256 count, uint256 average)
    {
        Rating[] storage ratings = sellerRatings[_seller];
        count = ratings.length;
        if (count == 0) return (0, 0);

        uint256 total = 0;
        for (uint256 i = 0; i < count; i++) {
            total += ratings[i].score;
        }
        average = (total * 100) / count; // ex: 350 = 3.50/5
    }

    /**
     * @notice Obtenir toutes les évaluations d'un vendeur.
     */
    function getSellerRatings(address _seller)
        external
        view
        returns (Rating[] memory)
    {
        return sellerRatings[_seller];
    }

    // ──────────────────── Override version ───────────────────────────

    function getVersion() external pure override returns (string memory) {
        return "v2";
    }
}
