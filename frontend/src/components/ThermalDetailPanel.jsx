import React from 'react';

const ThermalDetailPanel = ({ thermalEvents = [] }) => {
  const activeCount = thermalEvents ? thermalEvents.length : 0;

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
      <div className="mh-flex-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f97316' }}>
          🌡️ Active Thermal Stress & Heatwave Monitoring Zones
        </h2>
        <span style={{ fontSize: '12px', background: '#451a03', color: '#fb923c', padding: '4px 8px', borderRadius: '6px', border: '1px solid #7c2d12' }}>
          Active Heatwave Zones: {activeCount}
        </span>
      </div>

      <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeCount > 0 ? (
          thermalEvents.map((zone) => {
            const temp = zone.temperatureC || 0;
            const isSevere = temp >= 38;

            return (
              <div key={zone.id} className="mh-flex-row" style={{
                background: '#020617',
                borderLeft: `4px solid ${isSevere ? '#ef4444' : '#f97316'}`,
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#e2e8f0' }}>{zone.locationName}</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Status: <b style={{ color: isSevere ? '#ef4444' : '#fb923c' }}>{zone.thermalStatus || '0'}</b> | Humidity: {zone.humidity || 0}%
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: isSevere ? '#ef4444' : '#fb923c'
                  }}>
                    {temp}°C
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ color: '#64748b', fontSize: '13px' }}>No active thermal zones (0 detected).</p>
        )}
      </div>
    </div>
  );
};

export default ThermalDetailPanel;