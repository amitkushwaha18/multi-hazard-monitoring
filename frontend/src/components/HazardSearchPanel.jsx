import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const istClock = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d)} IST`;
};

const liveChip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '8.5px',
  fontWeight: '800',
  letterSpacing: '0.08em',
  color: '#34d399',
  background: 'rgba(52,211,153,0.12)',
  border: '1px solid rgba(52,211,153,0.4)',
  borderRadius: '999px',
  padding: '1px 7px',
  marginLeft: '6px'
};

const LiveHazardCard = ({ label, icon, status, statusColor, rows }) => (
  <div style={{
    background: 'linear-gradient(160deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    padding: '14px'
  }}>
    <p style={{
      margin: 0,
      fontSize: '11px',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap'
    }}>
      {icon} {label}
      <span style={liveChip}>● LIVE NOW</span>
    </p>
    <p style={{ margin: '6px 0 10px', fontWeight: 'bold', fontSize: '14px', color: statusColor }}>
      {status}
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {rows.map((r) => (
        <span key={r.label} style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
          {r.label}: <b style={{ color: r.color || '#e2e8f0' }}>{r.value}</b>
        </span>
      ))}
    </div>
  </div>
);

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

      // Fetch PRESENT-TIME live telemetry only. No forecast / ML fields are read
      // here — future predictions are intentionally handled by the lower
      // Triple-Engine AI Suite (LSTM 24h + CNN + GA).
      let precip = 0, windSpeed = 0, windGusts = 0;
      let localMaxMag = 0;
      let seismicCount = 0;
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
          // Current-hour live rainfall only (never peakHourlyPrecipitation,
          // which is a future forecast value).
          precip = fdata.currentPrecipitation || 0;
          currentTemp = fdata.currentTemperature || 0;
        }
        if (seismicRes.status === 'fulfilled' && seismicRes.value?.data?.features) {
          // USGS all_hour feed = active events within the present hour.
          const features = seismicRes.value.data.features;
          const magnitudes = features.map(f => f.properties?.mag || 0);
          localMaxMag = magnitudes.length ? Math.max(...magnitudes) : 0;
          seismicCount = features.length;
        }
        if (cycloneRes.status === 'fulfilled') {
          windSpeed = cycloneRes.value?.data?.currentWindSpeed || 0;
          windGusts = cycloneRes.value?.data?.currentWindGusts || 0;
        }
      } catch (err) {
        console.warn('Backend offline, returning 0 telemetry data.');
        precip = 0;
        windSpeed = 0;
        windGusts = 0;
        localMaxMag = 0;
        seismicCount = 0;
        currentTemp = 0;
        telemetryData = null;
      }

      const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v)));

      let floodStatus = 'No Live Rainfall';
      if (precip > 10) floodStatus = 'Severe Flood Warning';
      else if (precip > 3) floodStatus = 'Moderate Flood Risk';
      else if (precip > 0) floodStatus = 'Light Rainfall';

      let seismicStatus = 'No Seismic Activity';
      if (localMaxMag >= 5.5) seismicStatus = 'High Earthquake Risk Alert';
      else if (localMaxMag >= 4.0) seismicStatus = 'Moderate Seismic Activity';

      let cycloneStatus = 'Calm Wind';
      if (windSpeed > 40) cycloneStatus = 'Severe Cyclone / High Wind Warning';
      else if (windSpeed > 20) cycloneStatus = 'Moderate Wind Alert';

      const floodPct = clampPct((precip / 25) * 100);
      const seismicPct = clampPct((localMaxMag / 8) * 100);
      const windPct = clampPct((windSpeed / 55) * 100);

      const riskAssessment = {
        floodRisk: `${floodStatus} (${floodPct}%)`,
        seismicRisk: `${seismicStatus} (${seismicPct}%)`,
        cycloneRisk: `${cycloneStatus} (${windPct}%)`,
        floodIndex: floodPct,
        seismicIndex: seismicPct,
        windIndex: windPct,
        precipitationMm: precip,
        windSpeedKmh: windSpeed,
        windGustsKmh: windGusts,
        temperatureC: currentTemp,
        magnitude: localMaxMag,
        seismicEvents: seismicCount,
        fetchedAt: new Date().toISOString(),
        dataMode: 'PRESENT_TIME_LIVE'
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
        risk: {
          floodRisk: 'No Live Rainfall (0%)',
          seismicRisk: 'No Seismic Activity (0%)',
          cycloneRisk: 'Calm Wind (0%)',
          floodIndex: 0,
          seismicIndex: 0,
          windIndex: 0,
          precipitationMm: 0,
          windSpeedKmh: 0,
          windGustsKmh: 0,
          magnitude: 0,
          seismicEvents: 0,
          fetchedAt: new Date().toISOString(),
          dataMode: 'PRESENT_TIME_LIVE'
        }
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
      <div style={{ marginBottom: '16px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '0.14em',
          color: '#34d399',
          background: 'rgba(52,211,153,0.1)',
          border: '1px solid rgba(52,211,153,0.45)',
          borderRadius: '999px',
          padding: '4px 12px',
          boxShadow: '0 0 18px rgba(52,211,153,0.3)'
        }}>
          ● PRESENT-TIME LIVE TELEMETRY
        </span>
        <h2 style={{ margin: '10px 0 0', fontSize: '20px', fontWeight: '700', color: '#38bdf8' }}>
          Multi-Hazard Risk Analyzer (Flood, Earthquake &amp; Cyclone)
        </h2>
        <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#94a3b8' }}>
          Right-now status only — current-hour rainfall, live USGS seismic activity and current wind speed.
          Future ML predictions live in the Triple-Engine AI Suite below.
        </p>
      </div>

      <div className="hs-search-row" style={{ display: 'flex', gap: '12px', position: 'relative' }}>
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

          <LiveHazardCard
            label="Flood Risk"
            icon="🌊"
            status={riskData.risk.floodRisk}
            statusColor={riskData.risk.floodRisk?.includes('Severe') || riskData.risk.floodRisk?.includes('High') ? '#ef4444' : '#10b981'}
            rows={[
              { label: 'Rainfall (current hour)', value: `${riskData.risk.precipitationMm ?? 0} mm`, color: '#38bdf8' },
              { label: 'Live Flood Index', value: `${riskData.risk.floodIndex ?? 0}%`, color: '#38bdf8' }
            ]}
          />

          <LiveHazardCard
            label="Earthquake / Seismic Risk"
            icon="🌋"
            status={riskData.risk.seismicRisk}
            statusColor={riskData.risk.seismicRisk?.includes('High') ? '#ef4444' : '#f59e0b'}
            rows={[
              { label: 'USGS Max Magnitude (last 1h)', value: `M ${riskData.risk.magnitude ?? 0}`, color: '#f59e0b' },
              { label: 'Active Events (last 1h)', value: riskData.risk.seismicEvents ?? 0, color: '#f59e0b' }
            ]}
          />

          <LiveHazardCard
            label="Cyclone / Wind Risk"
            icon="🌪️"
            status={riskData.risk.cycloneRisk}
            statusColor={riskData.risk.cycloneRisk?.includes('Severe') ? '#ef4444' : '#22d3ee'}
            rows={[
              { label: 'Current Wind Speed', value: `${riskData.risk.windSpeedKmh ?? 0} km/h`, color: '#22d3ee' },
              { label: 'Current Wind Gusts', value: `${riskData.risk.windGustsKmh ?? 0} km/h`, color: '#22d3ee' }
            ]}
          />
        </div>

        <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
          Present-moment snapshot as of <b style={{ color: '#94a3b8' }}>{istClock(riskData.risk.fetchedAt)}</b> · Source: Open-Meteo (rainfall/wind) &amp; USGS (seismic)
        </div>
        </div>
      )}
    </div>
  );
};

export default HazardSearchPanel;