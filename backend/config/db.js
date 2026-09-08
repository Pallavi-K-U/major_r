import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Database connection failed: MONGODB_URI environment variable is not defined.');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000, // 3 seconds timeout for fast feedback
    });
    console.log('MongoDB connected successfully.');
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    return false;
  }
};

export const isDBConnected = () => {
  return mongoose.connection.readyState === 1;
};
