const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromWallet: {
    type: String,
    required: true
  },
  toWallet: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.00000001
  },
  fee: {
    type: Number,
    required: true,
    min: 0,
    default: 0.001
  },
  signature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
    default: null
  },
  hash: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ fromWallet: 1 });
transactionSchema.index({ toWallet: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ hash: 1 });

// Virtual for total amount (amount + fee)
transactionSchema.virtual('totalAmount').get(function() {
  return this.amount + this.fee;
});

// Method to confirm transaction
transactionSchema.methods.confirm = function(blockId) {
  this.status = 'confirmed';
  this.blockId = blockId;
  return this.save();
};

// Method to fail transaction
transactionSchema.methods.fail = function() {
  this.status = 'failed';
  return this.save();
};

// Static method to get pending transactions
transactionSchema.statics.getPending = function() {
  return this.find({ status: 'pending' }).sort({ timestamp: 1 });
};

module.exports = mongoose.model('Transaction', transactionSchema); 