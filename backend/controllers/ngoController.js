import NgoProfile from '../models/ngoProfile.js';

export const getNgoProfile = async (req, res, next) => {
  try {
    let profile = await NgoProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new NgoProfile({
        userId: req.user._id,
        name: req.user.name,
        registrationNumber: 'PENDING',
        description: '',
        walletAddress: req.user.walletAddress || '',
      });
      await profile.save();
    }
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    next(error);
  }
};

export const updateNgoProfile = async (req, res, next) => {
  try {
    const { name, description, registrationNumber, walletAddress } = req.body;
    let profile = await NgoProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = new NgoProfile({
        userId: req.user._id,
        name: name || req.user.name,
        registrationNumber: registrationNumber || 'PENDING',
        description: description || '',
        walletAddress: walletAddress || req.user.walletAddress || '',
      });
    } else {
      if (name) profile.name = name;
      if (description !== undefined) profile.description = description;
      if (registrationNumber) profile.registrationNumber = registrationNumber;
      if (walletAddress !== undefined) profile.walletAddress = walletAddress;
    }

    await profile.save();
    return res.status(200).json({
      success: true,
      message: 'NGO Profile updated successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
};
