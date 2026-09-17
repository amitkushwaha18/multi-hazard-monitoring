const express = require('express');
const router = express.Router();
const { getAssets, createAsset } = require('../controllers/assetController');

// GET /api/assets - Fetch all infrastructure assets
router.get('/', getAssets);

// POST /api/assets - Create a new asset
router.post('/', createAsset);

module.exports = router;