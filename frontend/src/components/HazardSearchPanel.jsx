import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const HazardSearchPanel = ({ onLocationSelect, externalRequest }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [riskData, setRiskData] = useState(null);

  const handleInputChange = async (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedItem(null);

    if (val.length > 2) {
      try {
        const geoRes = await axios.get(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=5&language=en&format=json`
        );
        if (geoRes.data.results) {
          setSuggestions(geoRes.data.results);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (item) => {
    const fullCityName = `${item.name}, ${item.admin1 || ''} (${item.country || ''})`;
    setQuery(fullCityName);
    setSelectedItem(item);
    setSuggestions([]);
  };

  useEffect(() => {
    if (externalRequest && externalRequest.city) {
      setQuery(externalRequest.city);
      setSelectedItem(null);
      setSuggestions([]);
      runAnalysis(externalRequest.city);
    }
  }, [externalRequest]);

  const runAnalysis = async (cityOverride) => {
    const locationStr =
      typeof cityOverride === 'string' ? cityOverride
      : (typeof cityOverride === 'object' && cityOverride?.target?.value) ? cityOverride.target.value
      : String(cityOverride || '');
    const targetQuery = locationStr.trim() || (query && query.trim());
    if (!targetQuery) return;
    setLoading(true);

    try {
      let lat, lng, fullCityName;

      if (selectedItem) {
        lat = selectedItem.latitude;
        lng = selectedItem.longitude;
        fullCityName = targetQuery;
      } else {
        const geoRes = await axios.get(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetQuery)}&count=1&language=en&format=json`
        );
        if (geoRes.data.results && geoRes.data.results.length > 0) {
          const item = geoRes.data.results[0];
          lat = item.latitude;
          lng = item.longitude;
          fullCityName = `${item.name}, ${item.admin1 || ''} (${item.country || ''})`;
        } else {
          alert('City not found. Please select a valid location.');
          setLoading(false);
          return;
        }
      }

      // Fetch from backend telemetry engine; if backend is offline, return 0 data
      let precip = 0, windSpeed = 0;
      let localMaxMag = 0;
      let currentTemp = 0;
      let telemetryData = null;

      try {
        const [floodRes, seismicRes, cycloneRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/hazards/flood-analysis?lat=${lat}&lng=${lng}`),
          axios.get(`${API_BASE_URL}/api/hazards/seismic`),
          axios.get(`${API_BASE_URL}/api/hazards/cyclone?lat=${lat}&lng=${lng}`)
        ]);

        if (floodRes.status === 'fulfilled' && floodRes.value?.data) {
          const fdata = floodRes.value.data;
          telemetryData = fdata;
          precip = fdata.peakHourlyPrecipitation || fdata.currentPrecipitation || 0;
          currentTemp = fdata.currentTemperature || 0;
        }
        if (seismicRes.status === 'fulfilled' && seismicRes.value?.data?.features) {
          const magnitudes = seismicRes.value.data.features.map(f => f.properties?.mag || 0);
          localMaxMag = magnitudes.length ? Math.max(...magnitudes) : 0;
        }
        if (cycloneRes.status === 'fulfilled') {
          windSpeed = cycloneRes.value?.data?.currentWindSpeed || 0;
        }
      } catch (err) {
        console.warn('Backend offline, returning 0 telemetry data.');
        precip = 0;
        windSpeed = 0;
        localMaxMag = 0;
        currentTemp = 0;
        telemetryData = null;
      }

      let floodStatus = '0 Risk';
      if (precip > 10) floodStatus = 'Severe Flood Warning';
      else if (precip > 3) floodStatus = 'Moderate Flood Risk';

      let seismicStatus = '0 Seismic Activity';
      if (localMaxMag >= 5.5) seismicStatus = 'High Earthquake Risk Alert';
      else if (localMaxMag >= 4.0) seismicStatus = 'Moderate Seismic Activity';

      let cycloneStatus = '0 Wind Speed';
      if (windSpeed > 40) cycloneStatus = 'Severe Cyclone / High Wind Warning';
      else if (windSpeed > 20) cycloneStatus = 'Moderate Wind Alert';

      const floodPct = Math.round((precip / 25) * 100);
      const seismicPct = Math.round((localMaxMag / 8) * 100);
      const windPct = Math.round((windSpeed / 55) * 100);

      const riskAssessment = {
        floodRisk: `${floodStatus} (${floodPct}%)`,
        seismicRisk: `${seismicStatus} (${seismicPct}%)`,
        cycloneRisk: `${cycloneStatus} (${windPct}%)`,
        precipitationMm: precip,
        windSpeedKmh: windSpeed,
        temperatureC: currentTemp,
        magnitude: localMaxMag
      };

      const result = {
        cityName: fullCityName,
        lat,
        lng,
        risk: riskAssessment,
        telemetry: telemetryData
      };

      setRiskData(result);

      if (typeof onLocationSelect === 'function') {
        onLocationSelect(result);
      }
    } catch (err) {
      console.error('Error in multi-hazard analysis:', err);
      setRiskData({
        cityName: targetQuery,
        lat: 0,
        lng: 0,
        risk: { floodRisk: '0 (0%)', seismicRisk: '0 (0%)', cycloneRisk: '0 (0%)', precipitationMm: 0, windSpeedKmh: 0, magnitude: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      marginBottom: '20px',
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '24px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      position: 'relative'
    }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#38bdf8' }}>
        Multi-Hazard Risk Analyzer (Flood, Earthquake & Cyclone)
      </h2>

      <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Type City or Place Name (e.g. Mumbai, Chennai, Bhubaneswar, Gorakhpur)..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#020617',
              color: '#fff',
              outline: 'none',
              fontSize: '15px',
              boxSizing: 'border-box'
            }}
          />

          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '0 0 8px 8px',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSuggestionClick(item)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #1e293b',
                    color: '#e2e8f0',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#1e293b'}
                  onMouseLeave={(e) => e.target.style.background = '#020617'}
                >
                  <b>{item.name}</b> {item.admin1 ? `, ${item.admin1}` : ''} ({item.country})
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => runAnalysis()}
          disabled={loading}
          style={{
            padding: '14px 28px',
            borderRadius: '8px',
            border: 'none',
            background: '#0284c7',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {riskData && !loading && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => { setRiskData(null); setSelectedItem(null); setQuery(''); }}
              style={{
                background: 'transparent',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ← Back / Clear Results
            </button>
          </div>
        <div style={{
          padding: '20px',
          background: '#020617',
          border: '1px solid #334155',
          borderRadius: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)'
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Location</p>
            <p style={{ margin: '4px 0 0', fontWeight: 'bold', color: '#e2e8f0', fontSize: '15px' }}>{riskData.cityName}</p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flood Risk</p>
            <p style={{ margin: '6px 0 0', fontWeight: 'bold', fontSize: '14px', color: riskData.risk.floodRisk?.includes('Severe') || riskData.risk.floodRisk?.includes('High') ? '#ef4444' : '#10b981' }}>
              {riskData.risk.floodRisk}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earthquake / Seismic Risk</p>
            <p style={{ margin: '6px 0 0', fontWeight: 'bold', fontSize: '14px', color: riskData.risk.seismicRisk?.includes('High') ? '#ef4444' : '#f59e0b' }}>
              {riskData.risk.seismicRisk}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cyclone / Wind Risk</p>
            <p style={{ margin: '6px 0 0', fontWeight: 'bold', fontSize: '14px', color: riskData.risk.cycloneRisk?.includes('Severe') ? '#ef4444' : '#38bdf8' }}>
              {riskData.risk.cycloneRisk}
            </p>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default HazardSearchPanel;