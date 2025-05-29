const express = require('express');
const router = express.Router();
const BlockchainController = require('../controllers/blockchainController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateQuery, validateParams, querySchemas, paramSchemas } = require('../middleware/validation');

// Public blockchain routes
router.get('/blocks',
  optionalAuth,
  validateQuery(querySchemas.blockQuery),
  BlockchainController.getBlocks
);

router.get('/blocks/:blockId',
  optionalAuth,
  validateParams(paramSchemas.blockId),
  BlockchainController.getBlock
);

router.get('/status',
  optionalAuth,
  BlockchainController.getBlockchainStatus
);

// Admin-only routes
router.post('/mine',
  authenticateToken,
  requireAdmin,
  BlockchainController.mineBlock
);

router.get('/validate',
  authenticateToken,
  requireAdmin,
  BlockchainController.validateBlockchain
);

module.exports = router; 