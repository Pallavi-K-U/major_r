import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader User ID is required'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'Mime type is required'],
      trim: true,
    },
    ipfsCid: {
      type: String,
      required: [true, 'IPFS CID is required'],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only log creation time
  }
);

// Prevent returning version keys by default
documentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Document = mongoose.model('Document', documentSchema);
export default Document;
