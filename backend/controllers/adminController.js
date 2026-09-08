import NgoProfile from '../models/ngoProfile.js';
import Project from '../models/project.js';
import Transaction from '../models/transaction.js';

export const getAllNgos = async (req, res, next) => {
  try {
    const ngos = await NgoProfile.find({}).populate('userId', 'name email');
    return res.status(200).json({ success: true, ngos });
  } catch (error) {
    next(error);
  }
};

export const getAllProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({});
    return res.status(200).json({ success: true, projects });
  } catch (error) {
    next(error);
  }
};

export const verifyNgo = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Find either by profile document ID or linked userId
    let profile = await NgoProfile.findById(id);
    if (!profile) {
      profile = await NgoProfile.findOne({ userId: id });
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'NGO Profile not found', status: 404 },
      });
    }

    profile.verified = true;
    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'NGO verified successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransactionReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewStatus } = req.body;

    // Validate review status value
    const validStatuses = ['UNDER_REVIEW', 'CLEARED', 'ESCALATED'];
    if (!reviewStatus || !validStatuses.includes(reviewStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid review status. Must be one of: ${validStatuses.join(', ')}`,
          status: 400,
        },
      });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { message: 'Transaction not found', status: 404 },
      });
    }

    transaction.reviewStatus = reviewStatus;
    transaction.reviewedBy = req.user._id;
    transaction.reviewedAt = new Date();
    await transaction.save();

    return res.status(200).json({
      success: true,
      message: `Transaction review status updated to ${reviewStatus}`,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};
