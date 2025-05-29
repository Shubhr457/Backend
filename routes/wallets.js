const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');
const { validate, validateQuery, validateParams, walletSchemas, querySchemas, paramSchemas } = require('../middleware/validation');

// Protected wallet routes
router.post('/', 
  authenticateToken, 
  validate(walletSchemas.create), 
  WalletController.createWallet
);

router.get('/', 
  authenticateToken, 
  validateQuery(querySchemas.pagination), 
  WalletController.getUserWallets
);

router.get('/:walletId', 
  authenticateToken,
  validateParams(paramSchemas.walletId),
  checkWalletOwnership,
  WalletController.getWallet
);

router.get('/:walletId/balance', 
  authenticateToken,
  validateParams(paramSchemas.walletId),
  checkWalletOwnership,
  WalletController.getWalletBalance
);

router.put('/:walletId', 
  authenticateToken,
  validateParams(paramSchemas.walletId),
  checkWalletOwnership,
  validate(walletSchemas.update),
  WalletController.updateWallet
);

router.get('/:walletId/transactions', 
  authenticateToken,
  validateParams(paramSchemas.walletId),
  checkWalletOwnership,
  validateQuery(querySchemas.transactionQuery),
  WalletController.getWalletTransactions
);

module.exports = router; 