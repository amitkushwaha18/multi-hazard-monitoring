const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Asset = require('./models/Asset');

dotenv.config();

const sampleAssets = [
  {
    name: "Tehri Dam",
    type: "Dam",
    location: { lat: 30.3782, lng: 78.4801, city: "Tehri", state: "Uttarakhand" },
    healthMetrics: { vibration: 1.2, tilt: 0.1, crackWidth: 0.0, waterLevel: 820, structuralHealthIndex: 92 },
    status: "Safe"
  },
  {
    name: "Bandra-Worli Sea Link",
    type: "Bridge",
    location: { lat: 19.0330, lng: 72.8185, city: "Mumbai", state: "Maharashtra" },
    healthMetrics: { vibration: 4.5, tilt: 0.8, crackWidth: 0.2, waterLevel: 0, structuralHealthIndex: 78 },
    status: "Under Observation"
  },
  {
    name: "Bogibeel Bridge",
    type: "Bridge",
    location: { lat: 27.3981, lng: 94.9012, city: "Dibrugarh", state: "Assam" },
    healthMetrics: { vibration: 2.1, tilt: 0.3, crackWidth: 0.1, waterLevel: 102, structuralHealthIndex: 88 },
    status: "Safe"
  }
];

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Asset.deleteMany();
    await Asset.insertMany(sampleAssets);
    console.log("Sample Infrastructure Assets Inserted Successfully!");
    process.exit();
  } catch (err) {
    console.error("Error seeding assets:", err.message);
    process.exit(1);
  }
};

seedData();