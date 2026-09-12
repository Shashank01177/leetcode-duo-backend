const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String }, // optional, for admin
  password: { type: String, required: true },
  leetcodeId: { type: String, required: true, unique: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isInQueue: { type: Boolean, default: false },
  currentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
