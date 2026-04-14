const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FruitMarket", function () {
  let market;
  let owner, seller, buyer, other;

  const APPLE_PRICE = ethers.parseEther("0.01"); // 0.01 ETH
  const BANANA_PRICE = ethers.parseEther("0.005");

  beforeEach(async function () {
    [owner, seller, buyer, other] = await ethers.getSigners();

    const FruitMarketV1 = await ethers.getContractFactory("FruitMarketV1");
    market = await upgrades.deployProxy(FruitMarketV1, [], {
      initializer: "initialize",
      kind: "uups",
    });
    await market.waitForDeployment();
  });

  // ─────────────── Test 1 : Déploiement ─────────────────────────────

  describe("Déploiement", function () {
    it("devrait déployer avec une adresse non nulle", async function () {
      const addr = await market.getAddress();
      expect(addr).to.not.equal(ethers.ZeroAddress);
    });

    it("devrait initialiser le owner correctement", async function () {
      expect(await market.owner()).to.equal(owner.address);
    });

    it("devrait être en version v1", async function () {
      expect(await market.getVersion()).to.equal("v1");
    });
  });

  // ─────────────── Test 2 : Ajout de produit ────────────────────────

  describe("Ajout de produit", function () {
    it("devrait ajouter un produit avec les bons paramètres", async function () {
      await market.connect(seller).addProduct("Pomme", APPLE_PRICE, 100);

      const product = await market.getProduct(0);
      expect(product.name).to.equal("Pomme");
      expect(product.priceWei).to.equal(APPLE_PRICE);
      expect(product.stock).to.equal(100n);
      expect(product.seller).to.equal(seller.address);
      expect(product.isActive).to.be.true;
    });

    it("devrait émettre un événement ProductAdded", async function () {
      await expect(market.connect(seller).addProduct("Pomme", APPLE_PRICE, 100))
        .to.emit(market, "ProductAdded")
        .withArgs(0, "Pomme", APPLE_PRICE, 100, seller.address);
    });

    it("devrait refuser un nom vide", async function () {
      await expect(
        market.connect(seller).addProduct("", APPLE_PRICE, 10)
      ).to.be.revertedWithCustomError(market, "EmptyName");
    });

    it("devrait refuser un prix de 0", async function () {
      await expect(
        market.connect(seller).addProduct("Pomme", 0, 10)
      ).to.be.revertedWithCustomError(market, "InvalidPrice");
    });

    it("devrait incrémenter nextProductId", async function () {
      await market.connect(seller).addProduct("Pomme", APPLE_PRICE, 10);
      await market.connect(seller).addProduct("Banane", BANANA_PRICE, 20);
      expect(await market.nextProductId()).to.equal(2n);
    });
  });

  // ─────────────── Test 3 : Achat ───────────────────────────────────

  describe("Achat de produit", function () {
    beforeEach(async function () {
      await market.connect(seller).addProduct("Pomme", APPLE_PRICE, 50);
    });

    it("devrait permettre l'achat et transférer les fonds au vendeur", async function () {
      const sellerBalBefore = await ethers.provider.getBalance(seller.address);

      await market.connect(buyer).buyProduct(0, 3, { value: APPLE_PRICE * 3n });

      const sellerBalAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalAfter - sellerBalBefore).to.equal(APPLE_PRICE * 3n);
    });

    it("devrait mettre à jour le stock après achat", async function () {
      await market.connect(buyer).buyProduct(0, 5, { value: APPLE_PRICE * 5n });
      const product = await market.getProduct(0);
      expect(product.stock).to.equal(45n);
    });

    it("devrait enregistrer l'achat", async function () {
      await market.connect(buyer).buyProduct(0, 2, { value: APPLE_PRICE * 2n });
      expect(await market.getPurchaseCount()).to.equal(1n);

      const purchase = await market.purchases(0);
      expect(purchase.buyer).to.equal(buyer.address);
      expect(purchase.quantity).to.equal(2n);
    });

    it("devrait émettre un événement ProductPurchased", async function () {
      await expect(
        market.connect(buyer).buyProduct(0, 1, { value: APPLE_PRICE })
      )
        .to.emit(market, "ProductPurchased")
        .withArgs(0, buyer.address, 1, APPLE_PRICE);
    });

    it("devrait rembourser le surplus", async function () {
      const overpay = APPLE_PRICE * 5n; // paie pour 5 mais achète 1
      const buyerBalBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await market.connect(buyer).buyProduct(0, 1, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
      // balance = before - price - gas
      const expectedBal = buyerBalBefore - APPLE_PRICE - gasCost;
      expect(buyerBalAfter).to.equal(expectedBal);
    });

    it("devrait revert si fonds insuffisants", async function () {
      const tooLow = APPLE_PRICE - 1n;
      await expect(
        market.connect(buyer).buyProduct(0, 1, { value: tooLow })
      ).to.be.revertedWithCustomError(market, "InsufficientPayment");
    });

    it("devrait revert si stock insuffisant", async function () {
      await expect(
        market.connect(buyer).buyProduct(0, 999, { value: APPLE_PRICE * 999n })
      ).to.be.revertedWithCustomError(market, "InsufficientStock");
    });

    it("devrait revert si quantité est 0", async function () {
      await expect(
        market.connect(buyer).buyProduct(0, 0, { value: APPLE_PRICE })
      ).to.be.revertedWithCustomError(market, "ZeroQuantity");
    });

    it("devrait revert si produit inactif", async function () {
      await market.connect(seller).removeProduct(0);
      await expect(
        market.connect(buyer).buyProduct(0, 1, { value: APPLE_PRICE })
      ).to.be.revertedWithCustomError(market, "ProductInactive");
    });
  });

  // ─────────────── Test 4 : Mise à jour et contrôle d'accès ────────

  describe("Mise à jour de produit", function () {
    beforeEach(async function () {
      await market.connect(seller).addProduct("Pomme", APPLE_PRICE, 50);
    });

    it("devrait permettre au vendeur de modifier prix/stock", async function () {
      const newPrice = ethers.parseEther("0.02");
      await market.connect(seller).updateProduct(0, newPrice, 200);

      const p = await market.getProduct(0);
      expect(p.priceWei).to.equal(newPrice);
      expect(p.stock).to.equal(200n);
    });

    it("devrait refuser la mise à jour par un non-vendeur", async function () {
      await expect(
        market.connect(other).updateProduct(0, APPLE_PRICE, 10)
      ).to.be.revertedWithCustomError(market, "NotTheSeller");
    });

    it("devrait permettre au vendeur de retirer un produit", async function () {
      await market.connect(seller).removeProduct(0);
      const p = await market.getProduct(0);
      expect(p.isActive).to.be.false;
    });
  });

  // ─────────────── Test 5 : Upgrade V1 → V2 ────────────────────────

  describe("Upgrade V1 → V2", function () {
    it("devrait conserver l'état et activer la nouvelle fonctionnalité", async function () {
      // --- Phase 1 : utiliser V1 ---
      await market.connect(seller).addProduct("Mangue", APPLE_PRICE, 30);
      await market.connect(buyer).buyProduct(0, 2, { value: APPLE_PRICE * 2n });

      // Vérifier l'état V1
      const productBefore = await market.getProduct(0);
      expect(productBefore.name).to.equal("Mangue");
      expect(productBefore.stock).to.equal(28n);
      expect(await market.getVersion()).to.equal("v1");

      // --- Phase 2 : upgrade vers V2 ---
      const FruitMarketV2 = await ethers.getContractFactory("FruitMarketV2");
      const upgraded = await upgrades.upgradeProxy(
        await market.getAddress(),
        FruitMarketV2,
        { kind: "uups" }
      );

      // --- Phase 3 : vérifier état conservé ---
      const productAfter = await upgraded.getProduct(0);
      expect(productAfter.name).to.equal("Mangue");
      expect(productAfter.stock).to.equal(28n);
      expect(productAfter.seller).to.equal(seller.address);
      expect(await upgraded.getPurchaseCount()).to.equal(1n);

      // --- Phase 4 : vérifier nouvelle fonctionnalité (ratings) ---
      expect(await upgraded.getVersion()).to.equal("v2");

      await upgraded.connect(buyer).rateSeller(seller.address, 4, "Bon vendeur!");
      const [count, avg] = await upgraded.getSellerRating(seller.address);
      expect(count).to.equal(1n);
      expect(avg).to.equal(400n); // 4.00

      // Vérifier qu'on ne peut pas noter deux fois
      await expect(
        upgraded.connect(buyer).rateSeller(seller.address, 5, "Super!")
      ).to.be.revertedWithCustomError(upgraded, "AlreadyRated");
    });
  });
});
