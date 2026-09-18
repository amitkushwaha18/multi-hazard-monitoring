import React from 'react';

const ExplainableAIPanel = () => {
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
          Top factors influencing the current multi-hazard prediction score:
        </p>

        {/* Feature Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Surface Temperature Anomalies</span>
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>+42% Impact</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px' }}>
              <div style={{ width: '85%', height: '100%', background: '#ef4444', borderRadius: '3px' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Historical Seismic Fault Proximity</span>
              <span style={{ color: '#eab308', fontWeight: 'bold' }}>+28% Impact</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px' }}>
              <div style={{ width: '56%', height: '100%', background: '#eab308', borderRadius: '3px' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Urban Density & Drainage Index</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>+15% Impact</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px' }}>
              <div style={{ width: '30%', height: '100%', background: '#38bdf8', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplainableAIPanel;