const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../middleware/auth');

class AuthController {
  
  // Register new user
  static async register(req, res) {
    try {
      const { username, email, password, profile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          message: `A user with this ${field} already exists`
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        profile: profile || {}
      });

      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);
      
      // Save refresh token to user
      await user.addRefreshToken(refreshToken);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile,
            createdAt: user.createdAt
          },
          tokens: {
            accessToken,
            refreshToken
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: 'An error occurred during registration'
      });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);
      
      // Save refresh token to user
      await user.addRefreshToken(refreshToken);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile
          },
          tokens: {
            accessToken,
            refreshToken
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  }

  // Refresh access token
  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required',
          message: 'Please provide a valid refresh token'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Find user and check if refresh token exists
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive || !user.refreshTokens.includes(refreshToken)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          message: 'Refresh token is invalid or expired'
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
      
      // Replace old refresh token with new one
      await user.removeRefreshToken(refreshToken);
      await user.addRefreshToken(newRefreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken,
            refreshToken: newRefreshToken
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        message: 'Invalid or expired refresh token'
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password -refreshTokens');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        },
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
        message: 'An error occurred while fetching profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { profile } = req.body;

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      // Update profile fields
      user.profile = { ...user.profile, ...profile };
      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile,
            updatedAt: user.updatedAt
          }
        },
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        message: 'An error occurred while updating profile'
      });
    }
  }

  // Logout user (remove refresh token)
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const user = await User.findById(req.user.id);
        if (user) {
          await user.removeRefreshToken(refreshToken);
        }
      }

      res.json({
        success: true,
        message: 'Logout successful',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'An error occurred during logout'
      });
    }
  }

  // Logout from all devices (clear all refresh tokens)
  static async logoutAll(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (user) {
        await user.clearRefreshTokens();
      }

      res.json({
        success: true,
        message: 'Logged out from all devices',
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'An error occurred during logout'
      });
    }
  }
}

module.exports = AuthController; 