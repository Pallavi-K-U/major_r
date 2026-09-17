const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../backend/contract_config.json"), "utf8"));
  const [deployer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(config.address, config.abi, deployer);
  const nextId = await contract.nextProjectId();
  console.log("Contract at", config.address, "has nextProjectId =", nextId.toString());
}

main().catch(console.error);
