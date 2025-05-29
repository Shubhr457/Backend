const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transactionController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validate, validateQuery, validateParams, transactionSchemas, querySchemas, paramSchemas } = require('../middleware/validation');

// Protected transaction routes
router.post('/', 
  authenticateToken, 
  validate(transactionSchemas.create), 
  TransactionController.createTransaction
);

router.post('/validate', 
  authenticateToken, 
  validate(transactionSchemas.validate), 
  TransactionController.validateTransaction
);

// Public transaction routes (with optional auth)
router.get('/',
  optionalAuth,
  validateQuery(querySchemas.transactionQuery),
  TransactionController.getTransactions
);

router.get('/:transactionId',
  optionalAuth,
  validateParams(paramSchemas.transactionId),
  TransactionController.getTransaction
);

module.exports = router;