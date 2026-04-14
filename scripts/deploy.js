const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Déployer V1 via proxy UUPS
  const FruitMarketV1 = await ethers.getContractFactory("FruitMarketV1");
  const proxy = await upgrades.deployProxy(FruitMarketV1, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("──────────────────────────────────────");
  console.log("Proxy déployé à     :", proxyAddress);
  console.log("Implémentation (V1) :", implAddress);
  console.log("Version             :", await proxy.getVersion());
  console.log("──────────────────────────────────────");
  console.log("\nSauvegardez l'adresse du proxy dans votre .env :");
  console.log(`PROXY_ADDRESS=${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
