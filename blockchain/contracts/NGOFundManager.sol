// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NGOFundManager {
    address public owner;

    struct Milestone {
        string title;
        uint256 amount;
        bool released;
    }

    struct Project {
        address ngo;
        uint256 targetAmount;
        uint256 raisedAmount;
        uint256 releasedAmount;
        bool active;
        Milestone[] milestones;
    }

    mapping(uint256 => Project) public projects;
    uint256 public nextProjectId;

    event ProjectCreated(uint256 indexed projectId, address indexed ngo, uint256 targetAmount);
    event DonationReceived(uint256 indexed projectId, address indexed donor, uint256 amount);
    event MilestoneReleased(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount);
    event ProjectStatusUpdated(uint256 indexed projectId, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createProject(
        address ngo,
        uint256 targetAmount,
        string[] memory titles,
        uint256[] memory amounts
    ) external returns (uint256) {
        require(ngo != address(0), "Invalid NGO address");
        require(targetAmount > 0, "Target amount must be > 0");
        require(titles.length == amounts.length, "Milestone mismatch");
        require(titles.length > 0, "At least one milestone required");

        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Milestone amount must be > 0");
            sum += amounts[i];
        }
        require(sum == targetAmount, "Milestone sum must equal target");

        uint256 projectId = nextProjectId++;
        Project storage project = projects[projectId];
        project.ngo = ngo;
        project.targetAmount = targetAmount;
        project.active = true;

        for (uint256 i = 0; i < titles.length; i++) {
            project.milestones.push(Milestone({
                title: titles[i],
                amount: amounts[i],
                released: false
            }));
        }

        emit ProjectCreated(projectId, ngo, targetAmount);
        return projectId;
    }

    function donate(uint256 projectId) external payable {
        require(projectId < nextProjectId, "Invalid project ID");
        Project storage project = projects[projectId];
        require(project.active, "Project is not active");
        require(msg.value > 0, "Donation must be > 0");

        project.raisedAmount += msg.value;

        emit DonationReceived(projectId, msg.sender, msg.value);
    }

    function releaseMilestone(uint256 projectId, uint256 milestoneIndex) external onlyOwner {
        require(projectId < nextProjectId, "Invalid project ID");
        Project storage project = projects[projectId];
        require(milestoneIndex < project.milestones.length, "Invalid milestone ID");
        
        Milestone storage milestone = project.milestones[milestoneIndex];
        require(!milestone.released, "Milestone already released");

        uint256 amountToRelease = milestone.amount;
        require(
            project.raisedAmount - project.releasedAmount >= amountToRelease,
            "Insufficient project funds"
        );

        milestone.released = true;
        project.releasedAmount += amountToRelease;

        payable(project.ngo).transfer(amountToRelease);

        emit MilestoneReleased(projectId, milestoneIndex, amountToRelease);
    }

    function setProjectStatus(uint256 projectId, bool active) external onlyOwner {
        require(projectId < nextProjectId, "Invalid project ID");
        projects[projectId].active = active;
        emit ProjectStatusUpdated(projectId, active);
    }

    function getMilestonesCount(uint256 projectId) external view returns (uint256) {
        require(projectId < nextProjectId, "Invalid project ID");
        return projects[projectId].milestones.length;
    }

    function getMilestoneDetails(
        uint256 projectId,
        uint256 milestoneIndex
    ) external view returns (string memory title, uint256 amount, bool released) {
        require(projectId < nextProjectId, "Invalid project ID");
        Project storage project = projects[projectId];
        require(milestoneIndex < project.milestones.length, "Invalid milestone ID");

        Milestone storage milestone = project.milestones[milestoneIndex];
        return (milestone.title, milestone.amount, milestone.released);
    }
}
