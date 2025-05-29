const Block = require('../models/Block');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const CryptoUtils = require('../utils/crypto');

class BlockchainController {

  // Get all blocks with pagination (public)
  static async getBlocks(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        sortBy = 'index',
        order = 'desc',
        fromDate,
        toDate,
        minIndex,
        maxIndex
      } = req.query;

      // Build query
      const query = {};

      if (fromDate || toDate) {
        query.timestamp = {};
        if (fromDate) query.timestamp.$gte = new Date(fromDate);
        if (toDate) query.timestamp.$lte = new Date(toDate);
      }

      if (minIndex !== undefined || maxIndex !== undefined) {
        query.index = {};
        if (minIndex !== undefined) query.index.$gte = parseInt(minIndex);
        if (maxIndex !== undefined) query.index.$lte = parseInt(maxIndex);
      }

      const sortOrder = order === 'asc' ? 1 : -1;
      const sortOptions = { [sortBy]: sortOrder };

      const blocks = await Block.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('transactions', 'hash amount fromWallet toWallet status');

      const total = await Block.countDocuments(query);

      const formattedBlocks = blocks.map(block => ({
        id: block._id,
        index: block.index,
        hash: block.hash,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        transactionCount: block.transactionCount,
        merkleRoot: block.merkleRoot,
        nonce: block.nonce,
        difficulty: block.difficulty,
        transactions: block.transactions.map(tx => ({
          id: tx._id,
          hash: tx.hash,
          amount: tx.amount,
          fromWallet: tx.fromWallet,
          toWallet: tx.toWallet,
          status: tx.status
        })),
        createdAt: block.createdAt
      }));

      res.json({
        success: true,
        data: {
          blocks: formattedBlocks
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
      console.error('Get blocks error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get blocks',
        message: 'An error occurred while fetching blocks'
      });
    }
  }

  // Get specific block with transactions (public)
  static async getBlock(req, res) {
    try {
      const { blockId } = req.params;

      const block = await Block.findById(blockId)
        .populate({
          path: 'transactions',
          populate: {
            path: 'userId',
            select: 'username'
          }
        });

      if (!block) {
        return res.status(404).json({
          success: false,
          error: 'Block not found',
          message: 'The specified block does not exist'
        });
      }

      const formattedTransactions = block.transactions.map(tx => ({
        id: tx._id,
        hash: tx.hash,
        fromWallet: tx.fromWallet,
        toWallet: tx.toWallet,
        amount: tx.amount,
        fee: tx.fee,
        signature: tx.signature,
        status: tx.status,
        timestamp: tx.timestamp,
        user: tx.userId ? {
          id: tx.userId._id,
          username: tx.userId.username
        } : null
      }));

      res.json({
        success: true,
        data: {
          block: {
            id: block._id,
            index: block.index,
            hash: block.hash,
            previousHash: block.previousHash,
            timestamp: block.timestamp,
            transactionCount: block.transactionCount,
            merkleRoot: block.merkleRoot,
            nonce: block.nonce,
            difficulty: block.difficulty,
            transactions: formattedTransactions,
            createdAt: block.createdAt,
            updatedAt: block.updatedAt
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
      console.error('Get block error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get block',
        message: 'An error occurred while fetching block details'
      });
    }
  }

  // Mine pending transactions into new block (admin only)
  static async mineBlock(req, res) {
    try {
      // Get pending transactions
      const pendingTransactions = await Transaction.getPending();

      if (pendingTransactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No pending transactions',
          message: 'There are no pending transactions to mine'
        });
      }

      // Get the latest block
      const latestBlock = await Block.getLatest();
      const newIndex = latestBlock ? latestBlock.index + 1 : 0;
      const previousHash = latestBlock ? latestBlock.hash : '0000000000000000000000000000000000000000000000000000000000000000';

      // Validate all pending transactions before mining
      const validTransactions = [];
      for (const tx of pendingTransactions) {
        const sourceWallet = await Wallet.findOne({ address: tx.fromWallet });
        const destinationWallet = await Wallet.findOne({ address: tx.toWallet });

        if (sourceWallet && destinationWallet && sourceWallet.canSpend(tx.amount + tx.fee)) {
          // Verify signature
          const transactionData = `${tx.fromWallet}${tx.toWallet}${tx.amount}${tx.fee}${tx.timestamp.toISOString()}`;
          const isValidSignature = CryptoUtils.verifySignature(transactionData, tx.signature, sourceWallet.publicKey);
          
          if (isValidSignature) {
            validTransactions.push(tx);
          } else {
            await tx.fail();
          }
        } else {
          await tx.fail();
        }
      }

      if (validTransactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid transactions',
          message: 'All pending transactions failed validation'
        });
      }

      // Create merkle root from transaction hashes
      const transactionHashes = validTransactions.map(tx => tx.hash);
      const merkleRoot = CryptoUtils.calculateMerkleRoot(transactionHashes);

      // Mine the block
      const timestamp = new Date();
      const difficulty = parseInt(process.env.MINING_DIFFICULTY) || 4;
      const miningResult = CryptoUtils.mineBlock(newIndex, previousHash, timestamp, merkleRoot, difficulty);

      // Create new block
      const newBlock = new Block({
        index: newIndex,
        timestamp,
        transactions: validTransactions.map(tx => tx._id),
        transactionCount: validTransactions.length,
        previousHash,
        hash: miningResult.hash,
        nonce: miningResult.nonce,
        merkleRoot,
        difficulty
      });

      await newBlock.save();

      // Update transaction statuses and wallet balances
      for (const tx of validTransactions) {
        await tx.confirm(newBlock._id);

        // Update wallet balances
        const sourceWallet = await Wallet.findOne({ address: tx.fromWallet });
        const destinationWallet = await Wallet.findOne({ address: tx.toWallet });

        if (sourceWallet) {
          await sourceWallet.updateBalance(-(tx.amount + tx.fee));
        }

        if (destinationWallet) {
          await destinationWallet.updateBalance(tx.amount);
        }
      }

      // Add block reward (optional - create a transaction for mining reward)
      const blockReward = parseFloat(process.env.BLOCK_REWARD) || 10;
      
      res.json({
        success: true,
        message: 'Block mined successfully',
        data: {
          block: {
            id: newBlock._id,
            index: newBlock.index,
            hash: newBlock.hash,
            previousHash: newBlock.previousHash,
            timestamp: newBlock.timestamp,
            transactionCount: newBlock.transactionCount,
            merkleRoot: newBlock.merkleRoot,
            nonce: newBlock.nonce,
            difficulty: newBlock.difficulty,
            minedBy: req.user.username,
            blockReward,
            transactionsProcessed: validTransactions.length
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
      console.error('Mine block error:', error);
      res.status(500).json({
        success: false,
        error: 'Mining failed',
        message: 'An error occurred while mining the block'
      });
    }
  }

  // Get blockchain status and metrics (public)
  static async getBlockchainStatus(req, res) {
    try {
      // Get blockchain statistics
      const totalBlocks = await Block.countDocuments();
      const totalTransactions = await Transaction.countDocuments();
      const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
      const confirmedTransactions = await Transaction.countDocuments({ status: 'confirmed' });
      const failedTransactions = await Transaction.countDocuments({ status: 'failed' });

      // Get latest block
      const latestBlock = await Block.getLatest();

      // Calculate total volume
      const volumeResult = await Transaction.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, totalVolume: { $sum: '$amount' }, totalFees: { $sum: '$fee' } } }
      ]);

      const totalVolume = volumeResult.length > 0 ? volumeResult[0].totalVolume : 0;
      const totalFees = volumeResult.length > 0 ? volumeResult[0].totalFees : 0;

      // Get network statistics
      const totalWallets = await Wallet.countDocuments();
      const activeWallets = await Wallet.countDocuments({ balance: { $gt: 0 } });

      // Calculate average block time (last 10 blocks)
      const recentBlocks = await Block.find().sort({ index: -1 }).limit(10);
      let averageBlockTime = 0;
      if (recentBlocks.length > 1) {
        let totalTime = 0;
        for (let i = 0; i < recentBlocks.length - 1; i++) {
          const timeDiff = new Date(recentBlocks[i].timestamp) - new Date(recentBlocks[i + 1].timestamp);
          totalTime += timeDiff;
        }
        averageBlockTime = Math.round(totalTime / (recentBlocks.length - 1) / 1000); // in seconds
      }

      const status = {
        blockchain: {
          totalBlocks,
          latestBlock: latestBlock ? {
            index: latestBlock.index,
            hash: latestBlock.hash,
            timestamp: latestBlock.timestamp,
            transactionCount: latestBlock.transactionCount
          } : null,
          difficulty: latestBlock ? latestBlock.difficulty : 4,
          averageBlockTime: `${averageBlockTime}s`
        },
        transactions: {
          total: totalTransactions,
          pending: pendingTransactions,
          confirmed: confirmedTransactions,
          failed: failedTransactions,
          totalVolume: parseFloat(totalVolume.toFixed(8)),
          totalFees: parseFloat(totalFees.toFixed(8))
        },
        network: {
          totalWallets,
          activeWallets,
          networkHashRate: 'N/A', // Would require actual mining network
          peers: 1 // Single node for this implementation
        }
      };

      res.json({
        success: true,
        data: {
          status,
          isHealthy: true,
          lastUpdated: new Date().toISOString()
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
      console.error('Get blockchain status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
        message: 'An error occurred while fetching blockchain status'
      });
    }
  }

  // Validate entire blockchain integrity (admin only)
  static async validateBlockchain(req, res) {
    try {
      const blocks = await Block.find().sort({ index: 1 }).populate('transactions');
      
      if (blocks.length === 0) {
        return res.json({
          success: true,
          data: {
            validation: {
              isValid: true,
              errors: [],
              message: 'No blocks to validate'
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
      }

      const validationErrors = [];
      let isValid = true;

      // Validate each block
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const errors = [];

        // Check block index
        if (block.index !== i) {
          errors.push(`Invalid block index. Expected: ${i}, Got: ${block.index}`);
        }

        // Check previous hash (skip genesis block)
        if (i > 0) {
          const previousBlock = blocks[i - 1];
          if (block.previousHash !== previousBlock.hash) {
            errors.push(`Invalid previous hash. Expected: ${previousBlock.hash}, Got: ${block.previousHash}`);
          }
        }

        // Check block hash
        const calculatedHash = CryptoUtils.calculateBlockHash(
          block.index,
          block.previousHash,
          block.timestamp,
          block.merkleRoot,
          block.nonce
        );

        if (block.hash !== calculatedHash) {
          errors.push(`Invalid block hash. Expected: ${calculatedHash}, Got: ${block.hash}`);
        }

        // Check merkle root
        const transactionHashes = block.transactions.map(tx => tx.hash);
        const calculatedMerkleRoot = CryptoUtils.calculateMerkleRoot(transactionHashes);
        
        if (block.merkleRoot !== calculatedMerkleRoot) {
          errors.push(`Invalid merkle root. Expected: ${calculatedMerkleRoot}, Got: ${block.merkleRoot}`);
        }

        // Validate transactions in block
        for (const tx of block.transactions) {
          const sourceWallet = await Wallet.findOne({ address: tx.fromWallet });
          if (sourceWallet) {
            const transactionData = `${tx.fromWallet}${tx.toWallet}${tx.amount}${tx.fee}${tx.timestamp.toISOString()}`;
            const isValidSignature = CryptoUtils.verifySignature(transactionData, tx.signature, sourceWallet.publicKey);
            
            if (!isValidSignature) {
              errors.push(`Invalid transaction signature: ${tx.hash}`);
            }
          }
        }

        if (errors.length > 0) {
          isValid = false;
          validationErrors.push({
            blockIndex: block.index,
            blockHash: block.hash,
            errors
          });
        }
      }

      res.json({
        success: true,
        data: {
          validation: {
            isValid,
            totalBlocks: blocks.length,
            validatedBlocks: blocks.length - validationErrors.length,
            errors: validationErrors,
            message: isValid ? 'Blockchain is valid' : 'Blockchain has validation errors'
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
      console.error('Validate blockchain error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: 'An error occurred while validating the blockchain'
      });
    }
  }

  // Initialize genesis block (internal use)
  static async initializeGenesis() {
    try {
      const existingGenesis = await Block.getGenesis();
      if (existingGenesis) {
        return existingGenesis;
      }

      const genesisBlock = new Block({
        index: 0,
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        transactions: [],
        transactionCount: 0,
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
        nonce: 0,
        merkleRoot: CryptoUtils.calculateMerkleRoot([]),
        difficulty: 4
      });

      await genesisBlock.save();
      console.log('Genesis block created successfully');
      return genesisBlock;
    } catch (error) {
      console.error('Failed to create genesis block:', error);
      throw error;
    }
  }
}

module.exports = BlockchainController; 