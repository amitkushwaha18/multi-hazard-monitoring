const express = require('express');
const router = express.Router();
const { fetchWeather, fetchSeismic, fetchCyclone } = require('../controllers/hazardControllers');

// GET /api/hazards/weather?lat=26.8467&lng=80.9462
router.get('/weather', fetchWeather);

// GET /api/hazards/seismic
router.get('/seismic', fetchSeismic);

// GET /api/hazards/cyclone?lat=26.8467&lng=80.9462
router.get('/cyclone', fetchCyclone);

module.exports = router;