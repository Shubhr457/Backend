const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const CryptoUtils = require('../utils/crypto');

class WalletController {

  // Create new wallet
  static async createWallet(req, res) {
    try {
      const { metadata } = req.body;

      // Generate key pair and address
      const { publicKey, privateKey } = CryptoUtils.generateKeyPair();
      const address = CryptoUtils.generateAddress(publicKey);

      // Create wallet
      const wallet = new Wallet({
        userId: req.user.id,
        address,
        publicKey,
        privateKey, // In production, encrypt this
        balance: 1000, // Initial balance of 1000 for new wallets
        metadata: {
          name: metadata?.name || 'My Wallet',
          description: metadata?.description || ''
        }
      });

      await wallet.save();

      res.status(201).json({
        success: true,
        message: 'Wallet created successfully',
        data: {
          wallet: {
            id: wallet._id,
            address: wallet.address,
            publicKey: wallet.publicKey,
            balance: wallet.balance,
            metadata: wallet.metadata,
            createdAt: wallet.createdAt
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
      console.error('Create wallet error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Wallet address conflict',
          message: 'A wallet with this address already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create wallet',
        message: 'An error occurred while creating the wallet'
      });
    }
  }

  // Get wallet details (owner only)
  static async getWallet(req, res) {
    try {
      const wallet = req.wallet; // Set by checkWalletOwnership middleware

      res.json({
        success: true,
        data: {
          wallet: {
            id: wallet._id,
            address: wallet.address,
            publicKey: wallet.publicKey,
            balance: wallet.formattedBalance,
            metadata: wallet.metadata,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt
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
      console.error('Get wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet',
        message: 'An error occurred while fetching wallet details'
      });
    }
  }

  // Get wallet balance (owner only)
  static async getWalletBalance(req, res) {
    try {
      const wallet = req.wallet; // Set by checkWalletOwnership middleware

      // Calculate balance from confirmed transactions
      const confirmedTransactions = await Transaction.find({
        $or: [
          { fromWallet: wallet.address },
          { toWallet: wallet.address }
        ],
        status: 'confirmed'
      });

      let calculatedBalance = 0;
      for (const tx of confirmedTransactions) {
        if (tx.toWallet === wallet.address) {
          calculatedBalance += tx.amount;
        } else if (tx.fromWallet === wallet.address) {
          calculatedBalance -= (tx.amount + tx.fee);
        }
      }

      // Update wallet balance if different
      if (Math.abs(wallet.balance - calculatedBalance) > 0.00000001) {
        wallet.balance = calculatedBalance;
        await wallet.save();
      }

      res.json({
        success: true,
        data: {
          balance: {
            current: parseFloat(calculatedBalance.toFixed(8)),
            formatted: `${calculatedBalance.toFixed(8)} BTC`,
            address: wallet.address,
            lastUpdated: new Date().toISOString()
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
      console.error('Get wallet balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get balance',
        message: 'An error occurred while fetching wallet balance'
      });
    }
  }

  // Update wallet metadata (owner only)
  static async updateWallet(req, res) {
    try {
      const { metadata } = req.body;
      const wallet = req.wallet; // Set by checkWalletOwnership middleware

      // Update metadata
      wallet.metadata = { ...wallet.metadata, ...metadata };
      await wallet.save();

      res.json({
        success: true,
        message: 'Wallet updated successfully',
        data: {
          wallet: {
            id: wallet._id,
            address: wallet.address,
            balance: wallet.formattedBalance,
            metadata: wallet.metadata,
            updatedAt: wallet.updatedAt
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
      console.error('Update wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update wallet',
        message: 'An error occurred while updating the wallet'
      });
    }
  }

  // Get user's wallets (protected)
  static async getUserWallets(req, res) {
    try {
      const { limit = 20, offset = 0, sortBy = 'createdAt', order = 'desc' } = req.query;

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortOptions = { [sortBy]: sortOrder };

      const wallets = await Wallet.find({ userId: req.user.id })
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .select('-privateKey'); // Don't send private key in list

      const total = await Wallet.countDocuments({ userId: req.user.id });

      res.json({
        success: true,
        data: {
          wallets: wallets.map(wallet => ({
            id: wallet._id,
            address: wallet.address,
            balance: wallet.formattedBalance,
            metadata: wallet.metadata,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt
          }))
        },
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        },
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
      console.error('Get user wallets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get wallets',
        message: 'An error occurred while fetching wallets'
      });
    }
  }

  // Get wallet transactions (owner only)
  static async getWalletTransactions(req, res) {
    try {
      const wallet = req.wallet; // Set by checkWalletOwnership middleware
      const { 
        limit = 20, 
        offset = 0, 
        sortBy = 'timestamp', 
        order = 'desc',
        status,
        minAmount,
        maxAmount
      } = req.query;

      // Build query
      const query = {
        $or: [
          { fromWallet: wallet.address },
          { toWallet: wallet.address }
        ]
      };

      if (status) {
        query.status = status;
      }

      if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = parseFloat(minAmount);
        if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
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

      // Format transactions with direction
      const formattedTransactions = transactions.map(tx => ({
        id: tx._id,
        fromWallet: tx.fromWallet,
        toWallet: tx.toWallet,
        amount: tx.amount,
        fee: tx.fee,
        direction: tx.toWallet === wallet.address ? 'incoming' : 'outgoing',
        status: tx.status,
        signature: tx.signature,
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
          transactions: formattedTransactions,
          wallet: {
            id: wallet._id,
            address: wallet.address,
            balance: wallet.formattedBalance
          }
        },
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        },
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
      console.error('Get wallet transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transactions',
        message: 'An error occurred while fetching wallet transactions'
      });
    }
  }
}

module.exports = WalletController; 