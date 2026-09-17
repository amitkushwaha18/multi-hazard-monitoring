import React, { useState } from 'react';

function AIRiskPredictionPanel() {
  const [hazardType, setHazardType] = useState('Flood');
  const [locationRisk, setLocationRisk] = useState('Moderate');
  const [aiScore, setAiScore] = useState(74);

  const handlePredict = () => {
    // Simulated AI prediction logic
    const randomScore = Math.floor(Math.random() * 40) + 60;
    setAiScore(randomScore);
    setLocationRisk(randomScore > 80 ? 'Critical' : randomScore > 70 ? 'High' : 'Moderate');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: locationRisk === 'Critical' ? '#f87171' : '#fbbf24' }}>
            {locationRisk} Risk
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIRiskPredictionPanel;