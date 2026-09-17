const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  hazardType: { 
    type: String, 
    enum: ['Flood', 'Thermal', 'Seismic', 'Structural'], 
    required: true 
  },
  severity: { 
    type: String, 
    enum: ['Low', 'Moderate', 'High', 'Critical'], 
    required: true 
  },
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  description: String,
  status: { 
    type: String, 
    enum: ['Active', 'Verified', 'Resolved'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);