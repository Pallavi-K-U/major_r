import Project from '../models/project.js';
import NgoProfile from '../models/ngoProfile.js';

// Validation helper
const validateProjectInput = (body) => {
  const { title, description, targetAmount, startDate, endDate, milestones } = body;

  // TC-2: Missing Title
  if (!title || title.trim() === '') {
    return 'Project title is required';
  }

  if (!description || description.trim() === '') {
    return 'Project description is required';
  }

  // TC-3: Target amount <= 0
  const parsedTarget = Number(targetAmount);
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return 'Target amount must be greater than zero';
  }

  // TC-4: Date validation
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid start or end date format';
  }
  if (end <= start) {
    return 'End date must be strictly after the start date';
  }

  // TC-5: Milestone validation
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return 'Project must have at least one milestone';
  }

  let totalMilestoneAmount = 0;
  for (const m of milestones) {
    const amt = Number(m.amount);
    if (isNaN(amt) || amt <= 0) {
      return 'Milestone amounts must be greater than zero';
    }
    totalMilestoneAmount += amt;
  }

  // Allow a tiny tolerance for floating point summation
  if (Math.abs(totalMilestoneAmount - parsedTarget) > 0.01) {
    return 'The sum of milestone amounts must exactly equal the project target amount';
  }

  return null;
};

export const createProject = async (req, res, next) => {
  try {
    const errorMsg = validateProjectInput(req.body);
    if (errorMsg) {
      return res.status(400).json({
        success: false,
        error: { message: errorMsg, status: 400 },
      });
    }

    const { title, description, targetAmount, startDate, endDate, status, milestones, blockchainId } = req.body;

    const project = new Project({
      title,
      description,
      ngoId: req.user._id,
      targetAmount,
      startDate,
      endDate,
      status: status || 'DRAFT',
      milestones,
      blockchainId: blockchainId || 0,
    });

    await project.save();

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', status: 404 },
      });
    }

    // TC-7: NGO attempts to modify another NGO's project
    if (project.ngoId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: you can only modify your own projects', status: 403 },
      });
    }

    // Run validations on the merged inputs
    const mergedData = {
      title: req.body.title !== undefined ? req.body.title : project.title,
      description: req.body.description !== undefined ? req.body.description : project.description,
      targetAmount: req.body.targetAmount !== undefined ? req.body.targetAmount : project.targetAmount,
      startDate: req.body.startDate !== undefined ? req.body.startDate : project.startDate,
      endDate: req.body.endDate !== undefined ? req.body.endDate : project.endDate,
      milestones: req.body.milestones !== undefined ? req.body.milestones : project.milestones,
    };

    const errorMsg = validateProjectInput(mergedData);
    if (errorMsg) {
      return res.status(400).json({
        success: false,
        error: { message: errorMsg, status: 400 },
      });
    }

    // Apply updates
    if (req.body.title !== undefined) project.title = req.body.title;
    if (req.body.description !== undefined) project.description = req.body.description;
    if (req.body.targetAmount !== undefined) project.targetAmount = req.body.targetAmount;
    if (req.body.startDate !== undefined) project.startDate = req.body.startDate;
    if (req.body.endDate !== undefined) project.endDate = req.body.endDate;
    if (req.body.status !== undefined) project.status = req.body.status;
    if (req.body.milestones !== undefined) project.milestones = req.body.milestones;

    await project.save();

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ ngoId: req.user._id });
    return res.status(200).json({ success: true, projects });
  } catch (error) {
    next(error);
  }
};

export const getActiveProjects = async (req, res, next) => {
  try {
    // Return ACTIVE and COMPLETED projects (exclude DRAFT and SUSPENDED)
    const projects = await Project.find({ status: { $in: ['ACTIVE', 'COMPLETED'] } });
    return res.status(200).json({ success: true, projects });
  } catch (error) {
    next(error);
  }
};

export const getProjectDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', status: 404 },
      });
    }

    // TC-12: Retrieve corresponding NGO profile details along with project
    const ngoProfile = await NgoProfile.findOne({ userId: project.ngoId }).lean();
    project.ngoDetails = ngoProfile || {
      name: 'Registered NGO',
      registrationNumber: 'PENDING',
      description: 'No profile details available yet.',
      verified: false,
    };

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    next(error);
  }
};
