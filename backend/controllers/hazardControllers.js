const { getWeatherData, getSeismicData, getCycloneData } = require('../utils/externalApis');

// Get Live Weather Data
const fetchWeather = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: 'Latitude and Longitude are required' });
  }

  const data = await getWeatherData(lat, lng);
  if (data) {
    res.json(data);
  } else {
    res.status(500).json({ message: 'Failed to fetch weather data' });
  }
};

// Get Live Seismic Events
const fetchSeismic = async (req, res) => {
  const data = await getSeismicData();
  if (data) {
    res.json(data);
  } else {
    res.status(500).json({ message: 'Failed to fetch seismic data' });
  }
};

// Get Live Cyclone / High Wind Telemetry
const fetchCyclone = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: 'Latitude and Longitude are required' });
  }

  const data = await getCycloneData(lat, lng);
  if (data) {
    res.json(data);
  } else {
    res.status(500).json({ message: 'Failed to fetch cyclone/wind data' });
  }
};

module.exports = { fetchWeather, fetchSeismic, fetchCyclone };