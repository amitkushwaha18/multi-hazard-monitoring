const Asset = require('../models/Asset');
const SAMPLE_INFRA_ASSETS = require('../data/sampleAssets');

// Get All Infrastructure Assets
const getAssets = async (req, res) => {
  try {
    const assets = await Asset.find();
    if (assets && assets.length > 0) {
      return res.status(200).json(assets);
    }
    // Database empty hone par sample assets send karein
    return res.status(200).json(SAMPLE_INFRA_ASSETS);
  } catch (error) {
    // MongoDB connect na hone par fallback sample assets send karein with 200 OK
    console.warn('Asset fetch from MongoDB failed, serving sample data:', error.message);
    return res.status(200).json(SAMPLE_INFRA_ASSETS);
  }
};

// Add New Asset
const createAsset = async (req, res) => {
  try {
    const newAsset = new Asset(req.body);
    const savedAsset = await newAsset.save();
    res.status(201).json(savedAsset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getAssets, createAsset };