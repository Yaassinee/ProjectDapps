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

  const toDelete = [
    path.join(projectRoot, "cache"),
    path.join(projectRoot, "artifacts"),
  ];
  for (const p of toDelete) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // Supprimer uniquement les fichiers .openzeppelin/unknown-*.json
  const ozDir = path.join(projectRoot, ".openzeppelin");
  if (fs.existsSync(ozDir)) {
    for (const f of fs.readdirSync(ozDir)) {
      if (f.startsWith("unknown-") && f.endsWith(".json")) {
        fs.unlinkSync(path.join(ozDir, f));
      }
    }
  }

  console.log("🔨 Recompilation des contrats...");
  execSync("npx hardhat compile", { stdio: "inherit", cwd: projectRoot });

  // ─── Upgrade ────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log("\nUpgrading with account:", deployer.address);

  const current = await ethers.getContractAt("FruitMarketV1", proxyAddress);
  console.log("Version actuelle:", await current.getVersion());

  const FruitMarketV2 = await ethers.getContractFactory("FruitMarketV2");

  // Si le manifest .openzeppelin n'existe pas pour ce réseau (ex: repo cloné),
  // importer le proxy existant avant l'upgrade.
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const manifestFile = path.join(
    ozDir,
    chainId === 11155111 ? "sepolia.json" : `unknown-${chainId}.json`
  );

  if (!fs.existsSync(manifestFile)) {
    console.log("⚠️  Manifest OpenZeppelin manquant — importation du proxy existant...");
    const FruitMarketV1 = await ethers.getContractFactory("FruitMarketV1");
    await upgrades.forceImport(proxyAddress, FruitMarketV1, { kind: "uups" });
    console.log("✓ Proxy importé.");
  }

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
