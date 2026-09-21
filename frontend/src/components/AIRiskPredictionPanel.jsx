import React, { useState } from 'react';

function AIRiskPredictionPanel({ selectedLocation, ml }) {
  const [hazardType, setHazardType] = useState('Flood');

  const parsePercent = (str) => {
    if (typeof str !== 'string') return null;
    const match = str.match(/(\d{1,3})\s*%/);
    if (!match) return null;
    return Math.min(100, Math.max(0, parseInt(match[1], 10)));
  };

  const getRiskScore = () => {
    if (!selectedLocation) return 0;
    const risk = selectedLocation.risk || {};

    if (hazardType === 'Earthquake') {
      const pct = parsePercent(risk.seismicRisk);
      if (pct !== null) return pct;
      const mag = Number(risk.magnitude) || 0;
      return Math.min(100, Math.round((mag / 8) * 100));
    }

    if (hazardType === 'Cyclone') {
      const pct = parsePercent(risk.cycloneRisk) ?? parsePercent(risk.windRisk);
      if (pct !== null) return pct;
      const wind = Number(risk.windSpeedKmh) || 0;
      return Math.min(100, Math.round((wind / 55) * 100));
    }

    // Flood: prefer the real ML LSTM/fused risk score when available.
    const mlFlood = ml?.fused?.riskScore ?? ml?.lstm?.floodRiskScore;
    if (mlFlood != null) {
      return Math.min(100, Math.max(0, Math.round(Number(mlFlood))));
    }

    const pct = parsePercent(risk.floodRisk);
    if (pct !== null) return pct;
    const precip = Number(risk.precipitationMm) || 0;
    return Math.min(100, Math.round((precip / 25) * 100));
  };

  const aiScore = getRiskScore();

  const getThreatLevel = (score) => {
    if (!selectedLocation) return 'No Active Risk / Baseline';
    if (score <= 0) return 'No Active Risk / Baseline';
    if (score <= 25) return 'Low';
    if (score <= 60) return 'Moderate';
    if (score <= 85) return 'High';
    return 'Critical';
  };

  const locationRisk = getThreatLevel(aiScore);

  const getThreatColor = (level) => {
    switch (level) {
      case 'Critical': return '#f87171';
      case 'High': return '#fb923c';
      case 'Moderate': return '#fbbf24';
      case 'Low': return '#4ade80';
      default: return '#94a3b8';
    }
  };

  const handlePredict = () => {
    // Score & threat level derive live from selectedLocation telemetry.
    setHazardType((h) => h);
  };

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '24px',
      color: '#f8fafc'
    }}>
      <div className="mh-flex-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8', margin: '0 0 4px 0' }}>🤖 AI Risk Prediction Engine</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Real-time hazard vulnerability & impact assessment</p>
        </div>
        <button
          onClick={handlePredict}
          style={{
            background: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Run AI Analysis ⚡
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>SELECTED HAZARD</div>
          <select
            value={hazardType}
            onChange={(e) => setHazardType(e.target.value)}
            style={{ width: '100%', background: '#090d16', color: '#fff', border: '1px solid #1e293b', padding: '8px', borderRadius: '6px', fontSize: '13px' }}
          >
            <option value="Flood">Flood / Urban Waterlogging</option>
            <option value="Earthquake">Earthquake Seismic Activity</option>
            <option value="Cyclone">Cyclone / Heavy Winds</option>
          </select>
        </div>

        <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>AI RISK SCORE</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: aiScore > 80 ? '#f87171' : '#38bdf8' }}>
            {aiScore} / 100
          </div>
        </div>

        <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>THREAT LEVEL</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: getThreatColor(locationRisk) }}>
            {locationRisk}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIRiskPredictionPanel;