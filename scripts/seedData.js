require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Block = require('../models/Block');
const CryptoUtils = require('../utils/crypto');
const { generateTokens } = require('../middleware/auth');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Wallet.deleteMany({});
    await Transaction.deleteMany({});
    await Block.deleteMany({});
    console.log('Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

const createUsers = async () => {
  try {
    const users = [
      {
        username: 'admin',
        email: 'admin@blockchain.com',
        password: 'admin123',
        role: 'admin',
        profile: {
          firstName: 'Admin',
          lastName: 'User'
        }
      },
      {
        username: 'alice',
        email: 'alice@blockchain.com',
        password: 'alice123',
        role: 'user',
        profile: {
          firstName: 'Alice',
          lastName: 'Johnson'
        }
      },
      {
        username: 'bob',
        email: 'bob@blockchain.com',
        password: 'bob123',
        role: 'user',
        profile: {
          firstName: 'Bob',
          lastName: 'Smith'
        }
      },
      {
        username: 'charlie',
        email: 'charlie@blockchain.com',
        password: 'charlie123',
        role: 'user',
        profile: {
          firstName: 'Charlie',
          lastName: 'Brown'
        }
      }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`Created user: ${user.username} (${user.email})`);
    }

    return createdUsers;
  } catch (error) {
    console.error('Error creating users:', error);
    return [];
  }
};

const createWallets = async (users) => {
  try {
    const wallets = [];
    
    for (const user of users) {
      // Create 2 wallets per user
      for (let i = 1; i <= 2; i++) {
        const { publicKey, privateKey } = CryptoUtils.generateKeyPair();
        const address = CryptoUtils.generateAddress(publicKey);
        
        const wallet = new Wallet({
          userId: user._id,
          address,
          publicKey,
          privateKey,
          balance: user.role === 'admin' ? 1000 : Math.floor(Math.random() * 100) + 50, // Admin gets 1000, others get 50-150
          metadata: {
            name: `${user.username}'s Wallet ${i}`,
            description: `Wallet ${i} for ${user.profile.firstName} ${user.profile.lastName}`
          }
        });
        
        await wallet.save();
        wallets.push(wallet);
        console.log(`Created wallet for ${user.username}: ${address} (Balance: ${wallet.balance})`);
      }
    }

    return wallets;
  } catch (error) {
    console.error('Error creating wallets:', error);
    return [];
  }
};

const createGenesisBlock = async () => {
  try {
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
    console.log('Created genesis block');
    return genesisBlock;
  } catch (error) {
    console.error('Error creating genesis block:', error);
    return null;
  }
};

const createSampleTransactions = async (users, wallets) => {
  try {
    const transactions = [];
    
    // Create some sample transactions between wallets
    const sampleTxs = [
      {
        from: wallets[1], // Alice's first wallet
        to: wallets[3], // Bob's first wallet
        amount: 10,
        user: users[1] // Alice
      },
      {
        from: wallets[2], // Alice's second wallet
        to: wallets[4], // Bob's second wallet
        amount: 15,
        user: users[1] // Alice
      },
      {
        from: wallets[3], // Bob's first wallet
        to: wallets[5], // Charlie's first wallet
        amount: 8,
        user: users[2] // Bob
      },
      {
        from: wallets[4], // Bob's second wallet
        to: wallets[6], // Charlie's second wallet
        amount: 12,
        user: users[2] // Bob
      },
      {
        from: wallets[5], // Charlie's first wallet
        to: wallets[1], // Alice's first wallet
        amount: 5,
        user: users[3] // Charlie
      }
    ];

    for (const txData of sampleTxs) {
      const timestamp = new Date();
      const fee = 0.001;
      const nonce = CryptoUtils.generateNonce();
      
      // Create transaction data for signing
      const transactionData = `${txData.from.address}${txData.to.address}${txData.amount}${fee}${timestamp.toISOString()}${nonce}`;
      
      // Create signature
      const signature = CryptoUtils.signData(transactionData, txData.from.privateKey);
      
      // Create transaction hash
      const hash = CryptoUtils.createTransactionHash(
        txData.from.address, 
        txData.to.address, 
        txData.amount, 
        timestamp, 
        nonce
      );

      const transaction = new Transaction({
        userId: txData.user._id,
        fromWallet: txData.from.address,
        toWallet: txData.to.address,
        amount: txData.amount,
        fee,
        signature,
        timestamp,
        hash,
        status: 'pending'
      });

      await transaction.save();
      transactions.push(transaction);
      console.log(`Created transaction: ${txData.amount} from ${txData.from.address.substring(0, 8)}... to ${txData.to.address.substring(0, 8)}...`);
    }

    return transactions;
  } catch (error) {
    console.error('Error creating transactions:', error);
    return [];
  }
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    await connectDB();
    await clearDatabase();
    
    console.log('\n📝 Creating users...');
    const users = await createUsers();
    
    console.log('\n💰 Creating wallets...');
    const wallets = await createWallets(users);
    
    console.log('\n⛓️ Creating genesis block...');
    const genesisBlock = await createGenesisBlock();
    
    console.log('\n💸 Creating sample transactions...');
    const transactions = await createSampleTransactions(users, wallets);
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`👥 Users created: ${users.length}`);
    console.log(`💰 Wallets created: ${wallets.length}`);
    console.log(`⛓️ Genesis block: ${genesisBlock ? 'Created' : 'Failed'}`);
    console.log(`💸 Transactions created: ${transactions.length}`);
    
    console.log('\n🔐 Sample Login Credentials:');
    console.log('Admin: admin@blockchain.com / admin123');
    console.log('Alice: alice@blockchain.com / alice123');
    console.log('Bob: bob@blockchain.com / bob123');
    console.log('Charlie: charlie@blockchain.com / charlie123');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Login with any user to get JWT token');
    console.log('3. Use admin account to mine pending transactions');
    console.log('4. Create new transactions and mine more blocks');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };