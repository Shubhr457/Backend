const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate, authSchemas } = require('../middleware/validation');

// Public routes
router.post('/register', validate(authSchemas.register), AuthController.register);
router.post('/login', validate(authSchemas.login), AuthController.login);
router.post('/refresh', validate(authSchemas.refreshToken), AuthController.refresh);

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, validate(authSchemas.updateProfile), AuthController.updateProfile);
router.post('/logout', authenticateToken, AuthController.logout);
router.post('/logout-all', authenticateToken, AuthController.logoutAll);

module.exports = router; 