const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const CryptoUtils = require('../utils/crypto');

class TransactionController {

  // Create and validate new transaction
  static async createTransaction(req, res) {
    try {
      const { fromWallet, toWallet, amount, fee = 0.001, privateKey } = req.body;

      // Validate addresses
      if (!CryptoUtils.isValidAddress(fromWallet) || !CryptoUtils.isValidAddress(toWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address',
          message: 'Please provide valid wallet addresses'
        });
      }

      if (fromWallet === toWallet) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction',
          message: 'Source and destination wallets cannot be the same'
        });
      }

      // Find and validate source wallet ownership
      const sourceWallet = await Wallet.findOne({ address: fromWallet });
      if (!sourceWallet) {
        return res.status(404).json({
          success: false,
          error: 'Source wallet not found',
          message: 'The source wallet does not exist'
        });
      }

      // Check if user owns the source wallet
      if (sourceWallet.userId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only send from your own wallets'
        });
      }

      // Validate destination wallet exists
      const destinationWallet = await Wallet.findOne({ address: toWallet });
      if (!destinationWallet) {
        return res.status(404).json({
          success: false,
          error: 'Destination wallet not found',
          message: 'The destination wallet does not exist'
        });
      }

      // Check sufficient balance
      const totalAmount = amount + fee;
      if (!sourceWallet.canSpend(totalAmount)) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
          message: `Insufficient balance. Available: ${sourceWallet.balance}, Required: ${totalAmount}`
        });
      }

      // Create transaction data for signing
      const timestamp = new Date();
      const nonce = CryptoUtils.generateNonce();
      const transactionData = `${fromWallet}${toWallet}${amount}${fee}${timestamp.toISOString()}${nonce}`;

      // Create digital signature
      const signature = CryptoUtils.signData(transactionData, privateKey);

      // Verify signature with wallet's public key
      const isValidSignature = CryptoUtils.verifySignature(transactionData, signature, sourceWallet.publicKey);
      if (!isValidSignature) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature',
          message: 'Transaction signature verification failed'
        });
      }

      // Generate transaction hash
      const hash = CryptoUtils.createTransactionHash(fromWallet, toWallet, amount, timestamp, nonce);

      // Create transaction
      const transaction = new Transaction({
        userId: req.user.id,
        fromWallet,
        toWallet,
        amount,
        fee,
        signature,
        timestamp,
        hash,
        status: 'pending'
      });

      await transaction.save();

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: {
          transaction: {
            id: transaction._id,
            fromWallet: transaction.fromWallet,
            toWallet: transaction.toWallet,
            amount: transaction.amount,
            fee: transaction.fee,
            totalAmount: transaction.totalAmount,
            signature: transaction.signature,
            hash: transaction.hash,
            status: transaction.status,
            timestamp: transaction.timestamp,
            createdAt: transaction.createdAt
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
      console.error('Create transaction error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate transaction',
          message: 'A transaction with this hash already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create transaction',
        message: 'An error occurred while creating the transaction'
      });
    }
  }

  // Get transaction details (public)
  static async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;

      const transaction = await Transaction.findById(transactionId)
        .populate('userId', 'username')
        .populate('blockId', 'index hash timestamp');

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          message: 'The specified transaction does not exist'
        });
      }

      res.json({
        success: true,
        data: {
          transaction: {
            id: transaction._id,
            fromWallet: transaction.fromWallet,
            toWallet: transaction.toWallet,
            amount: transaction.amount,
            fee: transaction.fee,
            totalAmount: transaction.totalAmount,
            signature: transaction.signature,
            hash: transaction.hash,
            status: transaction.status,
            timestamp: transaction.timestamp,
            block: transaction.blockId ? {
              id: transaction.blockId._id,
              index: transaction.blockId.index,
              hash: transaction.blockId.hash,
              timestamp: transaction.blockId.timestamp
            } : null,
            user: transaction.userId ? {
              id: transaction.userId._id,
              username: transaction.userId.username
            } : null,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
          }
        },
        user: req.user ? {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        } : null,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction',
        message: 'An error occurred while fetching transaction details'
      });
    }
  }

  // List transactions with pagination and filters (public)
  static async getTransactions(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        sortBy = 'timestamp',
        order = 'desc',
        status,
        fromWallet,
        toWallet,
        minAmount,
        maxAmount,
        fromDate,
        toDate
      } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (fromWallet) {
        query.fromWallet = fromWallet;
      }

      if (toWallet) {
        query.toWallet = toWallet;
      }

      if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = parseFloat(minAmount);
        if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
      }

      if (fromDate || toDate) {
        query.timestamp = {};
        if (fromDate) query.timestamp.$gte = new Date(fromDate);
        if (toDate) query.timestamp.$lte = new Date(toDate);
      }

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortOptions = { [sortBy]: sortOrder };

      const transactions = await Transaction.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('userId', 'username')
        .populate('blockId', 'index hash');

      const total = await Transaction.countDocuments(query);

      const formattedTransactions = transactions.map(tx => ({
        id: tx._id,
        fromWallet: tx.fromWallet,
        toWallet: tx.toWallet,
        amount: tx.amount,
        fee: tx.fee,
        status: tx.status,
        hash: tx.hash,
        timestamp: tx.timestamp,
        block: tx.blockId ? {
          id: tx.blockId._id,
          index: tx.blockId.index,
          hash: tx.blockId.hash
        } : null,
        user: tx.userId ? {
          id: tx.userId._id,
          username: tx.userId.username
        } : null
      }));

      res.json({
        success: true,
        data: {
          transactions: formattedTransactions
        },
        user: req.user ? {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        } : null,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasNext: (parseInt(offset) + parseInt(limit)) < total
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      });

    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transactions',
        message: 'An error occurred while fetching transactions'
      });
    }
  }

  // Validate transaction before processing
  static async validateTransaction(req, res) {
    try {
      const { fromWallet, toWallet, amount, signature } = req.body;

      // Validate addresses
      if (!CryptoUtils.isValidAddress(fromWallet) || !CryptoUtils.isValidAddress(toWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address',
          message: 'Please provide valid wallet addresses'
        });
      }

      // Check if wallets exist
      const sourceWallet = await Wallet.findOne({ address: fromWallet });
      const destinationWallet = await Wallet.findOne({ address: toWallet });

      const validationResult = {
        sourceWallet: {
          exists: !!sourceWallet,
          balance: sourceWallet ? sourceWallet.balance : 0,
          sufficient: sourceWallet ? sourceWallet.canSpend(amount + 0.001) : false
        },
        destinationWallet: {
          exists: !!destinationWallet
        },
        signature: {
          provided: !!signature,
          valid: false
        },
        amount: {
          valid: amount > 0 && amount >= 0.00000001,
          value: amount
        },
        overall: false
      };

      // Verify signature if wallets exist
      if (sourceWallet && signature) {
        const transactionData = `${fromWallet}${toWallet}${amount}`;
        validationResult.signature.valid = CryptoUtils.verifySignature(
          transactionData, 
          signature, 
          sourceWallet.publicKey
        );
      }

      // Check user ownership
      const userOwnsWallet = sourceWallet && sourceWallet.userId.toString() === req.user.id;
      validationResult.ownership = {
        userOwnsSource: userOwnsWallet
      };

      // Overall validation
      validationResult.overall = 
        validationResult.sourceWallet.exists &&
        validationResult.destinationWallet.exists &&
        validationResult.sourceWallet.sufficient &&
        validationResult.signature.valid &&
        validationResult.amount.valid &&
        validationResult.ownership.userOwnsSource;

      res.json({
        success: true,
        data: {
          validation: validationResult,
          canProceed: validationResult.overall
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
      console.error('Validate transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: 'An error occurred while validating the transaction'
      });
    }
  }
}

module.exports = TransactionController; 