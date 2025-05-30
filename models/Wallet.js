const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    type: String,
    required: true,
    unique: true
  },
  publicKey: {
    type: String,
    required: true
  },
  privateKey: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  metadata: {
    name: {
      type: String,
      trim: true,
      default: 'My Wallet'
    },
    description: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
walletSchema.index({ userId: 1 });

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
  return parseFloat(this.balance.toFixed(8));
});

// Method to update balance
walletSchema.methods.updateBalance = async function(amount) {
  this.balance += amount;
  return this.save();
};

// Method to check if wallet can spend amount
walletSchema.methods.canSpend = function(amount) {
  return this.balance >= amount;
};

module.exports = mongoose.model('Wallet', walletSchema); 