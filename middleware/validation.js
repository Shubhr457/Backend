const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(422).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message,
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(422).json({
        success: false,
        error: 'Query validation error',
        message: error.details[0].message,
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Auth validation schemas
const authSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'admin').optional(),
    profile: Joi.object({
      firstName: Joi.string().min(1).max(50),
      lastName: Joi.string().min(1).max(50),
      avatar: Joi.string().uri()
    }).optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  updateProfile: Joi.object({
    profile: Joi.object({
      firstName: Joi.string().min(1).max(50),
      lastName: Joi.string().min(1).max(50),
      avatar: Joi.string().uri()
    }).min(1).required()
  })
};

// Wallet validation schemas
const walletSchemas = {
  create: Joi.object({
    metadata: Joi.object({
      name: Joi.string().min(1).max(100),
      description: Joi.string().max(500)
    }).optional()
  }),

  update: Joi.object({
    metadata: Joi.object({
      name: Joi.string().min(1).max(100),
      description: Joi.string().max(500)
    }).min(1).required()
  })
};

// Transaction validation schemas
const transactionSchemas = {
  create: Joi.object({
    fromWallet: Joi.string().length(40).hex().required(),
    toWallet: Joi.string().length(40).hex().required(),
    amount: Joi.number().positive().precision(8).min(0.00000001).required(),
    fee: Joi.number().min(0).precision(8).default(0.001),
    privateKey: Joi.string().required()
  }),

  validate: Joi.object({
    fromWallet: Joi.string().length(40).hex().required(),
    toWallet: Joi.string().length(40).hex().required(),
    amount: Joi.number().positive().precision(8).min(0.00000001).required(),
    signature: Joi.string().required()
  })
};

// Query validation schemas
const querySchemas = {
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    page: Joi.number().integer().min(1),
    sortBy: Joi.string().valid('timestamp', 'amount', 'createdAt', 'index').default('timestamp'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  transactionQuery: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'failed'),
    fromWallet: Joi.string().length(40).hex(),
    toWallet: Joi.string().length(40).hex(),
    minAmount: Joi.number().positive(),
    maxAmount: Joi.number().positive(),
    fromDate: Joi.date().iso(),
    toDate: Joi.date().iso(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    sortBy: Joi.string().valid('timestamp', 'amount', 'createdAt').default('timestamp'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  blockQuery: Joi.object({
    fromDate: Joi.date().iso(),
    toDate: Joi.date().iso(),
    minIndex: Joi.number().integer().min(0),
    maxIndex: Joi.number().integer().min(0),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    sortBy: Joi.string().valid('timestamp', 'index', 'createdAt').default('index'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  })
};

// Parameter validation schemas
const paramSchemas = {
  mongoId: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }),
  
  walletId: Joi.object({
    walletId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }),

  transactionId: Joi.object({
    transactionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }),

  blockId: Joi.object({
    blockId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  })
};

// Validate URL parameters
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Parameter validation error',
        message: error.details[0].message
      });
    }
    
    next();
  };
};

// Custom validation helpers
const customValidations = {
  // Validate wallet address format
  isValidWalletAddress: (address) => {
    return /^[a-fA-F0-9]{40}$/.test(address);
  },

  // Validate hash format
  isValidHash: (hash) => {
    return /^[a-fA-F0-9]{64}$/.test(hash);
  },

  // Validate amount precision
  isValidAmount: (amount) => {
    const str = amount.toString();
    const decimalIndex = str.indexOf('.');
    if (decimalIndex === -1) return true;
    return str.length - decimalIndex - 1 <= 8;
  },

  // Validate date range
  isValidDateRange: (fromDate, toDate) => {
    if (!fromDate || !toDate) return true;
    return new Date(fromDate) <= new Date(toDate);
  }
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
  authSchemas,
  walletSchemas,
  transactionSchemas,
  querySchemas,
  paramSchemas,
  customValidations
}; 