const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Bridge', 'Dam', 'Road', 'Building', 'Railway'], 
    required: true 
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    city: String,
    state: String
  },
  healthMetrics: {
    vibration: Number,
    tilt: Number,
    crackWidth: Number,
    waterLevel: Number,
    structuralHealthIndex: Number
  },
  status: { 
    type: String, 
    enum: ['Safe', 'Under Observation', 'Critical'], 
    default: 'Safe' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);