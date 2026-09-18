import React from 'react';

const MultiHazardFusionEngine = ({ selectedLocation }) => {
  const heatRisk = selectedLocation?.isHighRiskRedZone ? 85 : 42;
  const seismicRisk = 28;
  const floodRisk = selectedLocation?.isHighRiskRedZone ? 74 : 15;

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
        </div>

        {/* Seismic Hazard Weight */}
        <div style={{ background: '#020617', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>🌋 Seismic Hazard Weight</p>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', color: '#eab308' }}>{seismicRisk}%</h3>
        </div>

        {/* Flood Risk Weight */}
        <div style={{ background: '#020617', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>🌊 Inundation/Flood Weight</p>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', color: '#38bdf8' }}>{floodRisk}%</h3>
        </div>
      </div>
    </div>
  );
};

export default MultiHazardFusionEngine;