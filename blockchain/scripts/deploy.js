const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const NGOFundManager = await hre.ethers.getContractFactory("NGOFundManager");
  // Explicitly set a gasLimit of 5,000,000 to prevent gas cap threshold exceptions
  const fundManager = await NGOFundManager.deploy({ gasLimit: 5000000 });
  await fundManager.waitForDeployment();

  const address = await fundManager.getAddress();
  console.log("NGOFundManager deployed to:", address);

  // Write address and ABI to a file
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/NGOFundManager.sol/NGOFundManager.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const config = {
    address: address,
    abi: artifact.abi
  };

  // Write for frontend
  const frontendDir = path.resolve(__dirname, "../../frontend/src");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(frontendDir, "contract_config.json"),
    JSON.stringify(config, null, 2)
  );

  // Write for backend
  const backendDir = path.resolve(__dirname, "../../backend");
  if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(backendDir, "contract_config.json"),
    JSON.stringify(config, null, 2)
  );

  console.log("Contract configurations exported successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
