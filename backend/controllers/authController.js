import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, walletAddress } = req.body;

    // 1. Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required registration fields', status: 400 },
      });
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid email format', status: 400 },
      });
    }

    // 3. Password strength validation (>= 8 chars)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 8 characters long', status: 400 },
      });
    }

    // 4. Role validation
    if (!['DONOR', 'NGO', 'ADMIN'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid role value', status: 400 },
      });
    }

    // 5. Prevent public ADMIN registration (TC-18)
    if (role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        error: { message: 'ADMIN role cannot be self-assigned through public registration', status: 400 },
      });
    }

    // 6. Check for duplicate email (TC-3)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email is already registered', status: 400 },
      });
    }

    // 7. Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // 8. Create user
    const user = new User({
      name,
      email,
      passwordHash,
      role,
      walletAddress: walletAddress || '',
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required', status: 400 },
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password', status: 401 },
      });
    }

    // Compare password
    const isMatch = await bcryptjs.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password', status: 401 },
      });
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};
