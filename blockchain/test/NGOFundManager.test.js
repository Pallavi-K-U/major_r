const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NGOFundManager Smart Contract Unit Tests", function () {
  let fundManager;
  let owner;
  let ngo;
  let donor;
  let thirdParty;

  beforeEach(async function () {
    [owner, ngo, donor, thirdParty] = await ethers.getSigners();
    const NGOFundManager = await ethers.getContractFactory("NGOFundManager");
    fundManager = await NGOFundManager.deploy();
  });

  // TC-1: Deploy contract
  describe("TC-1: Deploy Contract", function () {
    it("Should deploy successfully and record owner address", async function () {
      const ownerAddress = await fundManager.owner();
      expect(ownerAddress).to.equal(owner.address);
      expect(await fundManager.getAddress()).to.properAddress;
    });
  });

  // TC-2: Create valid project
  describe("TC-2: Create Valid Project", function () {
    it("Should create a project with accurate values in storage", async function () {
      const target = ethers.parseEther("5.0"); // 5 ETH
      const titles = ["Infrastructure setup", "Operational materials"];
      const amounts = [ethers.parseEther("2.0"), ethers.parseEther("3.0")];

      await expect(fundManager.createProject(ngo.address, target, titles, amounts))
        .to.emit(fundManager, "ProjectCreated")
        .withArgs(0, ngo.address, target);

      const project = await fundManager.projects(0);
      expect(project.ngo).to.equal(ngo.address);
      expect(project.targetAmount).to.equal(target);
      expect(project.raisedAmount).to.equal(0);
      expect(project.releasedAmount).to.equal(0);
      expect(project.active).to.be.true;
    });
  });

  // TC-3: Create project with invalid parameters
  describe("TC-3: Create Project with Invalid Parameters", function () {
    it("Should revert if sum of milestones does not equal targetAmount", async function () {
      const target = ethers.parseEther("5.0");
      const titles = ["Milestone 1"];
      const amounts = [ethers.parseEther("4.9")]; // Sum = 4.9 != 5.0

      await expect(
        fundManager.createProject(ngo.address, target, titles, amounts)
      ).to.be.revertedWith("Milestone sum must equal target");
    });

    it("Should revert if titles and amounts array sizes mismatch", async function () {
      const target = ethers.parseEther("5.0");
      const titles = ["M1", "M2"];
      const amounts = [ethers.parseEther("5.0")]; // array mismatch

      await expect(
        fundManager.createProject(ngo.address, target, titles, amounts)
      ).to.be.revertedWith("Milestone mismatch");
    });
  });

  // TC-4: Valid donation
  describe("TC-4: Valid Donation", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("10.0"),
        ["M1"],
        [ethers.parseEther("10.0")]
      );
    });

    it("Should accept donation, update project raised balance and contract address balance", async function () {
      const donationVal = ethers.parseEther("2.5");

      await expect(fundManager.connect(donor).donate(0, { value: donationVal }))
        .to.emit(fundManager, "DonationReceived")
        .withArgs(0, donor.address, donationVal);

      const project = await fundManager.projects(0);
      expect(project.raisedAmount).to.equal(donationVal);

      const contractBal = await ethers.provider.getBalance(await fundManager.getAddress());
      expect(contractBal).to.equal(donationVal);
    });
  });

  // TC-5: Zero-value donation
  describe("TC-5: Zero-Value Donation", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("10.0"),
        ["M1"],
        [ethers.parseEther("10.0")]
      );
    });

    it("Should revert donations with value equal to 0", async function () {
      await expect(
        fundManager.connect(donor).donate(0, { value: 0 })
      ).to.be.revertedWith("Donation must be > 0");
    });
  });

  // TC-6: Unauthorized project administration action
  describe("TC-6: Unauthorized Project Administration Action", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("10.0"),
        ["M1"],
        [ethers.parseEther("10.0")]
      );
    });

    it("Should revert if non-owner tries to deactivate/activate status", async function () {
      await expect(
        fundManager.connect(thirdParty).setProjectStatus(0, false)
      ).to.be.revertedWith("Caller is not the owner");
    });
  });

  // TC-7: Create valid milestone
  describe("TC-7: Create Valid Milestone", function () {
    it("Should correctly store nested milestones within project struct arrays", async function () {
      const target = ethers.parseEther("5.0");
      const titles = ["Milestone A", "Milestone B"];
      const amounts = [ethers.parseEther("2.0"), ethers.parseEther("3.0")];

      await fundManager.createProject(ngo.address, target, titles, amounts);

      const count = await fundManager.getMilestonesCount(0);
      expect(count).to.equal(2);

      const mDetails = await fundManager.getMilestoneDetails(0, 1);
      expect(mDetails.title).to.equal("Milestone B");
      expect(mDetails.amount).to.equal(amounts[1]);
      expect(mDetails.released).to.be.false;
    });
  });

  // TC-8: Unauthorized milestone fund release
  describe("TC-8: Unauthorized Milestone Fund Release", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("5.0"),
        ["M1"],
        [ethers.parseEther("5.0")]
      );
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("5.0") });
    });

    it("Should revert if third party / NGO attempts to release milestone funds", async function () {
      await expect(
        fundManager.connect(thirdParty).releaseMilestone(0, 0)
      ).to.be.revertedWith("Caller is not the owner");
    });
  });

  // TC-9: Authorized valid milestone release
  describe("TC-9: Authorized Valid Milestone Release", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("5.0"),
        ["M1", "M2"],
        [ethers.parseEther("2.0"), ethers.parseEther("3.0")]
      );
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("5.0") });
    });

    it("Should transfer target milestone amount to NGO wallet and mark released", async function () {
      const initialNgoBal = await ethers.provider.getBalance(ngo.address);

      await expect(fundManager.releaseMilestone(0, 0))
        .to.emit(fundManager, "MilestoneReleased")
        .withArgs(0, 0, ethers.parseEther("2.0"));

      const finalNgoBal = await ethers.provider.getBalance(ngo.address);
      expect(finalNgoBal - initialNgoBal).to.equal(ethers.parseEther("2.0"));

      const details = await fundManager.getMilestoneDetails(0, 0);
      expect(details.released).to.be.true;
    });
  });

  // TC-10: Release same milestone twice
  describe("TC-10: Release Same Milestone Twice", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("5.0"),
        ["M1"],
        [ethers.parseEther("5.0")]
      );
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("5.0") });
      await fundManager.releaseMilestone(0, 0);
    });

    it("Should revert subsequent release attempts", async function () {
      await expect(
        fundManager.releaseMilestone(0, 0)
      ).to.be.revertedWith("Milestone already released");
    });
  });

  // TC-11: Release more funds than available
  describe("TC-11: Release More Funds Than Available", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("5.0"),
        ["M1"],
        [ethers.parseEther("5.0")]
      );
      // Donate only 3 ETH (Milestone 1 needs 5 ETH)
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("3.0") });
    });

    it("Should revert if project raised balance is insufficient", async function () {
      await expect(
        fundManager.releaseMilestone(0, 0)
      ).to.be.revertedWith("Insufficient project funds");
    });
  });

  // TC-12: Invalid milestone ID
  describe("TC-12: Invalid Milestone ID", function () {
    beforeEach(async function () {
      await fundManager.createProject(
        ngo.address,
        ethers.parseEther("5.0"),
        ["M1"],
        [ethers.parseEther("5.0")]
      );
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("5.0") });
    });

    it("Should revert for index out of bounds", async function () {
      await expect(
        fundManager.releaseMilestone(0, 1) // index 1 does not exist
      ).to.be.revertedWith("Invalid milestone ID");
    });
  });

  // TC-13: Verify emitted events
  describe("TC-13: Verify Emitted Events", function () {
    it("Should broadcast events with matching event arguments", async function () {
      const target = ethers.parseEther("4.0");

      // Creation
      await expect(fundManager.createProject(ngo.address, target, ["M1"], [target]))
        .to.emit(fundManager, "ProjectCreated")
        .withArgs(0, ngo.address, target);

      // Donation
      await expect(fundManager.connect(donor).donate(0, { value: target }))
        .to.emit(fundManager, "DonationReceived")
        .withArgs(0, donor.address, target);

      // Release
      await expect(fundManager.releaseMilestone(0, 0))
        .to.emit(fundManager, "MilestoneReleased")
        .withArgs(0, 0, target);
    });
  });

  // TC-14: Verify contract balances after donation and release
  describe("TC-14: Verify Contract Balances", function () {
    it("Should accurately track contract address balance through entire flow", async function () {
      const target = ethers.parseEther("5.0");
      await fundManager.createProject(ngo.address, target, ["M1", "M2"], [ethers.parseEther("2.0"), ethers.parseEther("3.0")]);

      const contractAddr = await fundManager.getAddress();

      // Initial contract balance
      expect(await ethers.provider.getBalance(contractAddr)).to.equal(0);

      // Donate
      await fundManager.connect(donor).donate(0, { value: ethers.parseEther("4.0") });
      expect(await ethers.provider.getBalance(contractAddr)).to.equal(ethers.parseEther("4.0"));

      // Release M1 (2.0 ETH)
      await fundManager.releaseMilestone(0, 0);
      expect(await ethers.provider.getBalance(contractAddr)).to.equal(ethers.parseEther("2.0"));
    });
  });
});
