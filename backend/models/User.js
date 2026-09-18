const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, default: 'User' },
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, default: '' },
  phone: { type: String, default: '' },
  dob: { type: String, default: '' },
  password: { type: String, default: '' },
  passwordHash: { type: String, default: '' },
  address: { type: String, default: '' },
  state: { type: String, default: 'Uttar Pradesh' },
  city: { type: String, default: '' },
  pinCode: { type: String, default: '' },
  cityState: { type: String, default: 'Gorakhpur, Uttar Pradesh' },
  role: { type: String, enum: ['Public Citizen', 'Authority/Admin'], default: 'Public Citizen' },
  authProvider: { type: String, enum: ['local', 'google', 'otp'], default: 'local' },
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);