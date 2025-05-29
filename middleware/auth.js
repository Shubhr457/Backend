const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// JWT Token Verification Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid JWT token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'User not found or inactive'
      });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please refresh your token'
      });
    }
    
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'Token verification failed'
    });
  }
};

// Admin Role Check Middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please authenticate first'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'This operation requires admin privileges'
    });
  }

  next();
};

// Wallet Ownership Check Middleware
const checkWalletOwnership = async (req, res, next) => {
  try {
    const walletId = req.params.walletId || req.params.id;
    
    if (!walletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID required',
        message: 'Please provide a valid wallet ID'
      });
    }

    const wallet = await Wallet.findById(walletId);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
        message: 'The specified wallet does not exist'
      });
    }

    // Check if user owns the wallet or is admin
    if (wallet.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only access your own wallets'
      });
    }

    req.wallet = wallet;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Error checking wallet ownership'
    });
  }
};

// Optional authentication middleware (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshTokens');
      
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

  return { accessToken, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  authenticateToken,
  requireAdmin,
  checkWalletOwnership,
  optionalAuth,
  generateTokens,
  verifyRefreshToken
}; 