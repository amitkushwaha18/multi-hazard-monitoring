const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, sparse: true, unique: true },
  mobileNumber: { type: String, sparse: true, unique: true },
  passwordHash: { type: String }, // Optional for Google/OTP login users
  role: { type: String, enum: ['Public Citizen', 'Authority/Admin'], default: 'Public Citizen' },
  authProvider: { type: String, enum: ['local', 'google', 'otp'], default: 'local' },
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  cityState: { type: String, default: 'Gorakhpur, Uttar Pradesh' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);