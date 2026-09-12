const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', default: null },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  codeA: { type: String, default: '' },
  codeB: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Session', sessionSchema);
