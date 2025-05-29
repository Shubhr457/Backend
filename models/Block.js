const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  transactionCount: {
    type: Number,
    default: 0
  },
  previousHash: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true,
    unique: true
  },
  nonce: {
    type: Number,
    default: 0
  },
  merkleRoot: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    default: 4
  }
}, {
  timestamps: true
});

// Indexes for performance
blockSchema.index({ index: 1 });
blockSchema.index({ hash: 1 });
blockSchema.index({ timestamp: -1 });

// Virtual to check if block is genesis block
blockSchema.virtual('isGenesis').get(function() {
  return this.index === 0;
});

// Method to add transaction to block
blockSchema.methods.addTransaction = function(transactionId) {
  this.transactions.push(transactionId);
  this.transactionCount = this.transactions.length;
  return this;
};

// Static method to get latest block
blockSchema.statics.getLatest = function() {
  return this.findOne().sort({ index: -1 });
};

// Static method to get genesis block
blockSchema.statics.getGenesis = function() {
  return this.findOne({ index: 0 });
};

// Static method to get block by index
blockSchema.statics.getByIndex = function(index) {
  return this.findOne({ index });
};

module.exports = mongoose.model('Block', blockSchema); 