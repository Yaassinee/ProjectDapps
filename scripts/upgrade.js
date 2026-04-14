const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS manquant dans .env — exécutez d'abord le script de deploy.");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Lire la version actuelle
  const current = await ethers.getContractAt("FruitMarketV1", proxyAddress);
  console.log("Version actuelle:", await current.getVersion());

  // Upgrade vers V2
  const FruitMarketV2 = await ethers.getContractFactory("FruitMarketV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, FruitMarketV2, {
    kind: "uups",
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("──────────────────────────────────────");
  console.log("Proxy (inchangé)        :", proxyAddress);
  console.log("Nouvelle implémentation :", newImpl);
  console.log("Version après upgrade   :", await upgraded.getVersion());
  console.log("──────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
