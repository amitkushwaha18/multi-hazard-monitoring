const axios = require('axios');

// Fetch Weather, Elevation & Calculate Flood Risk
const getWeatherData = async (req, res) => {
  try {
    const { lat = 20.5937, lng = 78.9629 } = req.query;

    // 1. Fetch Rainfall Data from Open-Meteo Weather API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain&timezone=auto`;
    const weatherRes = await axios.get(weatherUrl);
    const currentData = weatherRes.data.current;

    // 2. Fetch Elevation Data from Open-Meteo Elevation API
    const elevationUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
    const elevationRes = await axios.get(elevationUrl);
    const elevationMeters = elevationRes.data.elevation ? elevationRes.data.elevation[0] : 100;

    const rainMm = currentData.precipitation || currentData.rain || 0;
    const tempC = currentData.temperature_2m || 0;

    // 3. Flood Risk Algorithm: High Rain + Low Elevation = High Risk Red Zone
    let floodRisk = 'Low Risk';
    let isHighRiskRedZone = false;

    if (rainMm >= 10 && elevationMeters < 150) {
      floodRisk = 'Critical High Risk (Lowland)';
      isHighRiskRedZone = true;
    } else if (rainMm > 5 || elevationMeters < 50) {
      floodRisk = 'Moderate Risk';
    }

    // Thermal Risk Logic
    const thermalRisk = tempC > 38 ? 'Extreme Thermal Stress' : tempC > 32 ? 'Moderate Heat' : 'Normal';

    res.status(200).json({
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      riskAssessment: {
        floodRisk,
        thermalRisk,
        precipitationMm: rainMm,
        temperatureC: tempC,
        elevationMeters,
        isHighRiskRedZone
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error in Multi-Hazard Risk Engine', error: err.message });
  }
};

module.exports = { getWeatherData };