const axios = require('axios');

// Open-Meteo API for Weather and Rainfall Data
const getWeatherData = async (lat, lng) => {
  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation,temperature_2m`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    return null;
  }
};

// Open-Meteo API for Cyclone / High Wind Telemetry
const getCycloneData = async (lat, lng) => {
  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=wind_speed_10m&forecast_days=1&timezone=auto`
    );
    const data = response.data || {};
    return {
      currentWindSpeed: (data.current && Math.round((data.current.wind_speed_10m || 0) * 3.6 * 10) / 10) || 0,
      currentWindGusts: (data.current && Math.round((data.current.wind_gusts_10m || 0) * 3.6 * 10) / 10) || 0,
      windDirection: (data.current && data.current.wind_direction_10m) || 0,
      hourlyForecast: {
        wind_speed_10m: (data.hourly && data.hourly.wind_speed_10m || []).map(v => Math.round(v * 3.6 * 10) / 10),
        time: (data.hourly && data.hourly.time) || []
      },
      elevation: data.elevation || 0
    };
  } catch (error) {
    console.error('Error fetching cyclone/wind data:', error.message);
    return null;
  }
};

// USGS Earthquake API for Live Seismic Data (all active events, no limit)
const getSeismicData = async () => {
  try {
    const response = await axios.get(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching seismic data:', error.message);
    return null;
  }
};

module.exports = { getWeatherData, getSeismicData, getCycloneData };