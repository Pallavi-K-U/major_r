import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Milestone amount is required'],
    min: [0.01, 'Milestone amount must be greater than zero'],
  },
  order: {
    type: Number,
    required: [true, 'Milestone order is required'],
  },
  status: {
    type: String,
    enum: {
      values: ['PENDING', 'COMPLETED', 'RELEASED'],
      message: '{VALUE} is not a valid milestone status',
    },
    default: 'PENDING',
  },
});

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [0.01, 'Target amount must be greater than zero'],
    },
    raisedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    beneficiaryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'ACTIVE', 'COMPLETED', 'SUSPENDED'],
        message: '{VALUE} is not a valid project status',
      },
      default: 'DRAFT',
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    blockchainId: {
      type: Number,
      default: 0,
    },
    impactAnalysis: {
      impactScore: { type: Number, default: null },
      impactLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: null },
      generatedSummary: { type: String, default: null },
      completenessScore: { type: Number, default: null },
      confidenceScore: { type: Number, default: null },
      limitations: [{ type: String }],
      disclaimer: { type: String, default: null },
      analysedAt: { type: Date, default: null },
      error: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.model('Project', projectSchema);
export default Project;
