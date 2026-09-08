import mongoose from 'mongoose';

const ngoProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'NGO name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
    },
    walletAddress: {
      type: String,
      default: '',
      trim: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const NgoProfile = mongoose.model('NgoProfile', ngoProfileSchema);
export default NgoProfile;
