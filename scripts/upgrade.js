const { ethers, upgrades } = require("hardhat");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS manquant dans .env — exécutez d'abord le script de deploy.");
  }

  // ─── Auto-clean cache to ensure fresh compilation ───────────────
  console.log("🧹 Nettoyage du cache pour garantir une compilation fraîche...");
  const projectRoot = path.resolve(__dirname, "..");

  // Supprimer cache, artifacts, et les fichiers unknown du plugin OpenZeppelin
  const toDelete = [
    path.join(projectRoot, "cache"),
    path.join(projectRoot, "artifacts"),
  ];
  for (const p of toDelete) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // Supprimer uniquement les fichiers .openzeppelin/unknown-*.json (garde sepolia.json!)
  const ozDir = path.join(projectRoot, ".openzeppelin");
  if (fs.existsSync(ozDir)) {
    for (const f of fs.readdirSync(ozDir)) {
      if (f.startsWith("unknown-") && f.endsWith(".json")) {
        fs.unlinkSync(path.join(ozDir, f));
      }
    }
  }

  // Recompiler
  console.log("🔨 Recompilation des contrats...");
  execSync("npx hardhat compile", { stdio: "inherit", cwd: projectRoot });

  // ─── Upgrade proprement dit ─────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log("\nUpgrading with account:", deployer.address);

  const current = await ethers.getContractAt("FruitMarketV1", proxyAddress);
  console.log("Version actuelle:", await current.getVersion());

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
