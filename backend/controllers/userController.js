import User from '../models/user.js';

export const updateUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, walletAddress } = req.body;

    // Enforce authorization checks: owner or admin (TC-19)
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied: you can only modify your own profile',
          status: 403,
        },
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          status: 404,
        },
      });
    }

    if (name) user.name = name;
    if (walletAddress !== undefined) user.walletAddress = walletAddress;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};
