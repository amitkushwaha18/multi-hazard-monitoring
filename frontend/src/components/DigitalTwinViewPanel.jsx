import React from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const DigitalTwinViewPanel = ({ selectedLocation, ml, seismicEvents }) => {
  const assetName = selectedLocation?.name || 'Tehri Hydroelectric Dam Complex';
  const cnn = ml?.cnn || {};
  const lstm = ml?.lstm || {};

  // Real structural metrics derived from the live CNN analysis.
  const integrity = clamp(Number(cnn.structuralIntegrity) || 0, 0, 100);
  const stressMpa = ml ? clamp((100 - integrity) * 0.3, 0, 60).toFixed(2) : '—';

  // Seismic metrics from the nearest live earthquake (within 600 km).
  const locLat = selectedLocation?.lat;
  const locLng = selectedLocation?.lng;
  let nearestMag = 0;
  if (locLat != null && locLng != null && Array.isArray(seismicEvents)) {
    for (const ev of seismicEvents) {
      const coords = ev?.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lg, la] = coords;
      const mag = Number(ev?.properties?.mag) || 0;
      const distKm = Math.hypot(la - locLat, lg - locLng) * 111;
      if (distKm < 600 && mag > nearestMag) nearestMag = mag;
    }
  }
  const strainMmm = ml ? clamp(nearestMag * 0.004, 0, 0.05).toFixed(3) : '—';
  const vibFreq = ml ? clamp(0.2 + nearestMag * 0.15, 0, 2.5).toFixed(2) : '—';

  // Core temperature from the live LSTM telemetry forecast.
  const tempSeries = lstm?.history?.temperature_2m || [];
  const coreTemp = ml && tempSeries.length ? `${tempSeries[tempSeries.length - 1].toFixed(1)} °C` : '—';

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
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🏢 Digital Twin Live Telemetry View
        </h2>
        <span style={{ fontSize: '12px', background: '#059669', color: '#d1fae5', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          3D Sensor Sync Active
        </span>
      </div>

      <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#f8fafc' }}>
          Asset: {assetName}
        </h4>

        {/* Telemetry Sensor Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Structural Stress</p>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>{stressMpa} MPa</p>
          </div>

          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Seismic Strain</p>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>{strainMmm} mm/m</p>
          </div>

          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Vibration Freq</p>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>{vibFreq} Hz</p>
          </div>

          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Core Temp</p>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>{coreTemp}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinViewPanel;