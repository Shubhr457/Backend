require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const BlockchainController = require('./controllers/blockchainController');

// Import routes
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallets');
const transactionRoutes = require('./routes/transactions');
const blockchainRoutes = require('./routes/blockchain');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://yourdomain.com'] : 
    ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Blockchain API is running',
    timestamp: new Date().toISOString(),
    version: '1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Blockchain REST API v1.0',
    documentation: {
      authentication: {
        baseURL: '/api/auth',
        endpoints: [
          'POST /register - Register new user',
          'POST /login - User login',
          'POST /refresh - Refresh JWT token',
          'GET /profile - Get user profile (protected)',
          'PUT /profile - Update user profile (protected)',
          'POST /logout - Logout user (protected)',
          'POST /logout-all - Logout from all devices (protected)'
        ]
      },
      wallets: {
        baseURL: '/api/wallets',
        endpoints: [
          'POST / - Create new wallet (protected)',
          'GET / - Get user wallets (protected)',
          'GET /:walletId - Get wallet details (owner only)',
          'GET /:walletId/balance - Get wallet balance (owner only)',
          'PUT /:walletId - Update wallet metadata (owner only)',
          'GET /:walletId/transactions - Get wallet transactions (owner only)'
        ]
      },
      transactions: {
        baseURL: '/api/transactions',
        endpoints: [
          'POST / - Create transaction (authenticated)',
          'POST /validate - Validate transaction (authenticated)',
          'GET / - List transactions (public, paginated)',
          'GET /:transactionId - Get transaction details (public)'
        ]
      },
      blockchain: {
        baseURL: '/api/blockchain',
        endpoints: [
          'GET /blocks - Get all blocks (public, paginated)',
          'GET /blocks/:blockId - Get specific block (public)',
          'GET /status - Get blockchain status (public)',
          'POST /mine - Mine new block (admin only)',
          'GET /validate - Validate blockchain (admin only)'
        ]
      }
    },
    authentication: {
      type: 'Bearer JWT',
      header: 'Authorization: Bearer <token>',
      tokenExpiry: '15 minutes',
      refreshTokenExpiry: '7 days'
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/blockchain', blockchainRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
    availableEndpoints: [
      'GET /health - Health check',
      'GET /api - API documentation',
      'POST /api/auth/* - Authentication endpoints',
      'GET|POST|PUT /api/wallets/* - Wallet management',
      'GET|POST /api/transactions/* - Transaction operations',
      'GET|POST /api/blockchain/* - Blockchain operations'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Request validation failed',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      message: `A record with ${field} '${value}' already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication token is invalid'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'Authentication token has expired'
    });
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize blockchain (create genesis block if needed)
const initializeBlockchain = async () => {
  try {
    await BlockchainController.initializeGenesis();
    // Blockchain initialized silently
  } catch (error) {
    console.error('Failed to initialize blockchain:', error);
  }
};

// Start server
const startServer = async () => {
  try {
    await initializeBlockchain();
    
    app.listen(PORT, () => {
      //console.log(`🚀 Blockchain API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app; 