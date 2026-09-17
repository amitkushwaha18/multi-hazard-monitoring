const express = require('express');
const router = express.Router();
const { getWeatherData } = require('../controllers/weatherController');

// GET /api/weather?lat=...&lng=...
router.get('/', getWeatherData);

module.exports = router;