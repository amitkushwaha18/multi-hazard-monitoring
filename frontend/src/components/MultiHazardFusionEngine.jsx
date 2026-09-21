import React from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const MultiHazardFusionEngine = ({ selectedLocation, ml, seismicEvents }) => {
  const lstm = ml?.lstm || {};

  // Thermal hazard weight: documented linear heat-index derivedness from the
  // live LSTM temperature forecast (avg °C over the trained window).
  const tempSeries = lstm?.history?.temperature_2m || [];
  const avgTempC = tempSeries.length
    ? tempSeries.reduce((a, b) => a + b, 0) / tempSeries.length
    : 0;
  const heatRisk = ml ? Math.round(clamp((avgTempC - 22) * 4.5, 0, 100)) : 0;

  // Seismic hazard weight: from the nearest live earthquake within 600 km.
  let seismicRisk = 0;
  const locLat = selectedLocation?.lat;
  const locLng = selectedLocation?.lng;
  if (locLat != null && locLng != null && Array.isArray(seismicEvents)) {
    let nearestMag = 0;
    for (const ev of seismicEvents) {
      const coords = ev?.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lg, la] = coords;
      const mag = Number(ev?.properties?.mag) || 0;
      const distKm = Math.hypot(la - locLat, lg - locLng) * 111;
      if (distKm < 600 && mag > nearestMag) nearestMag = mag;
    }
    seismicRisk = Math.round(clamp(nearestMag * 9, 0, 100));
  }

  // Inundation/flood weight: real ML LSTM flood-risk score.
  const floodRisk = ml ? Math.round(clamp(Number(lstm?.floodRiskScore) || 0, 0, 100)) : 0;

  const compositeRisk = Math.round((heatRisk * 0.4) + (seismicRisk * 0.3) + (floodRisk * 0.3));

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      marginTop: '20px'
    }}>
      <div className="mh-flex-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚡ Multi-Hazard Fusion Engine
        </h2>
        <span style={{ fontSize: '12px', background: '#d97706', color: '#fef3c7', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Fusion Composite: {compositeRisk}%
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {/* Heatwave Hazard Weight */}
        <div style={{ background: '#020617', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>🔥 Thermal Hazard Weight</p>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', color: '#ef4444' }}>{heatRisk}%</h3>
          {ml && <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#64748b' }}>LSTM {avgTempC.toFixed(1)}°C forecast</p>}
        </div>

        {/* Seismic Hazard Weight */}
        <div style={{ background: '#020617', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>🌋 Seismic Hazard Weight</p>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', color: '#eab308' }}>{seismicRisk}%</h3>
          {ml && <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#64748b' }}>Nearest live quake</p>}
        </div>

        {/* Flood Risk Weight */}
        <div style={{ background: '#020617', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>🌊 Inundation/Flood Weight</p>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', color: '#38bdf8' }}>{floodRisk}%</h3>
          {ml && <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#64748b' }}>LSTM flood {lstm?.riskLevel || '—'}</p>}
        </div>
      </div>
    </div>
  );
};

export default MultiHazardFusionEngine;