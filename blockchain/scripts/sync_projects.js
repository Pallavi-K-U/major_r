const hre = require("hardhat");
const mongoose = require(require("path").resolve(__dirname, "../../backend/node_modules/mongoose"));
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect("mongodb://localhost:27017/major_r");
  const Project = mongoose.model("Project", new mongoose.Schema({}, { strict: false }));
  const projects = await Project.find({ status: "ACTIVE" });
  console.log(`Found ${projects.length} active projects in MongoDB.`);

  const contractConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../artifacts/contracts/NGOFundManager.sol/NGOFundManager.json"), "utf8")
  );
  const deployedConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../backend/contract_config.json"), "utf8")
  );

  const [deployer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(deployedConfig.address, contractConfig.abi, deployer);

  const currentNextId = await contract.nextProjectId();
  console.log(`Contract current nextProjectId: ${currentNextId}`);

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const targetEth = Number(p.get("targetAmount")) || 10;
    const targetWei = hre.ethers.parseEther(targetEth.toString());
    const rawMilestones = p.get("milestones") || [];

    let titles = [];
    let amounts = [];

    if (rawMilestones.length > 0) {
      titles = rawMilestones.map(m => m.title || "Milestone");
      amounts = rawMilestones.map(m => hre.ethers.parseEther((Number(m.amount) || 1).toString()));
      // Ensure sum matches target
      let sum = amounts.reduce((a, b) => a + b, 0n);
      if (sum !== targetWei) {
        amounts[amounts.length - 1] = amounts[amounts.length - 1] + (targetWei - sum);
      }
    } else {
      titles = ["Project Completion"];
      amounts = [targetWei];
    }

    console.log(`Registering on-chain project ${i}: "${p.get("title")}" (${targetEth} ETH)...`);
    const tx = await contract.createProject(
      deployer.address,
      targetWei,
      titles,
      amounts,
      { gasLimit: 3000000 }
    );
    const receipt = await tx.wait();

    // Update MongoDB project blockchainId to match on-chain ID
    await Project.updateOne({ _id: p._id }, { $set: { blockchainId: i } });
    console.log(`✓ Project "${p.get("title")}" synced to on-chain ID ${i}`);
  }

  const finalNextId = await contract.nextProjectId();
  console.log(`\nSuccessfully synced! Contract nextProjectId is now: ${finalNextId}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
