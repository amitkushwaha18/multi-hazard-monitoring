import React from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ExplainableAIPanel = ({ ml, mlLoading }) => {
  const xai = ml?.lstm?.xai || [];
  const contributions = xai.slice(0, 3);

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
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🧠 Explainable AI (XAI) & Feature Contributions
        </h2>
        <span style={{ fontSize: '12px', background: '#7e22ce', color: '#f3e8ff', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          SHAP Value Explainer
        </span>
      </div>

      <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#cbd5e1' }}>
          {mlLoading
            ? 'Computing real LSTM input-gradient attributions on live telemetry…'
            : contributions.length > 0
              ? 'Top factors influencing the current LSTM flood-risk prediction (genuine input gradients):'
              : 'Select a location to compute real feature attributions from the LSTM forecaster.'}
        </p>

        {/* Feature Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {contributions.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#64748b', padding: '8px 0' }}>
              No attribution data yet — the feature contributions are derived from the trained network's gradients on live telemetry.
            </div>
          ) : contributions.map((item) => {
            const pct = clamp(item.contribution || 0, 0, 100);
            const color = item.sign >= 0 ? '#ef4444' : '#38bdf8';
            return (
              <div key={item.feature}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{item.feature}</span>
                  <span style={{ color, fontWeight: 'bold' }}>{item.sign >= 0 ? '+' : ''}{pct.toFixed(0)}% Impact</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExplainableAIPanel;