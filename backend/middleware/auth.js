import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No token provided, authorization denied',
          status: 401,
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';

    const decoded = jwt.verify(token, jwtSecret);
    
    // Fetch user to ensure user still exists in DB and roles are fresh
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token is invalid: user not found',
          status: 401,
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token is not valid or expired',
        status: 401,
      },
    });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access forbidden: insufficient permissions',
          status: 403,
        },
      });
    }
    next();
  };
};
