import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Donation amount is required'],
      min: [0.01, 'Donation amount must be greater than zero'],
    },
    transactionHash: {
      type: String,
      default: null,
      trim: true,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    fromAddress: {
      type: String,
      default: null,
      trim: true,
    },
    toAddress: {
      type: String,
      default: null,
      trim: true,
    },
    gasUsed: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'SUCCESS', 'FAILED'],
        message: '{VALUE} is not a valid transaction status',
      },
      default: 'SUCCESS',
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
    },
    aiAssessment: {
      riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: null,
      },
      probability: {
        type: Number,
        default: null,
      },
      assessedAt: {
        type: Date,
        default: null,
      },
      error: {
        type: String,
        default: null,
      },
    },
    reviewStatus: {
      type: String,
      enum: {
        values: ['PENDING_REVIEW', 'UNDER_REVIEW', 'CLEARED', 'ESCALATED'],
        message: '{VALUE} is not a valid review status',
      },
      default: 'PENDING_REVIEW',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent returning version keys by default
transactionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
