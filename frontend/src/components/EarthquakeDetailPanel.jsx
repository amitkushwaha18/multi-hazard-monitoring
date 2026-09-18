import React from 'react';

const EarthquakeDetailPanel = ({ seismicEvents = [] }) => {
  // Direct live active earthquakes count
  const liveCount = seismicEvents ? seismicEvents.length : 0;

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
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>
          Live Active Earthquake Feed (USGS Real-time)
        </h2>
        <span style={{ fontSize: '12px', background: '#3f0f13', color: '#f87171', padding: '4px 8px', borderRadius: '6px', border: '1px solid #7f1d1d' }}>
          Total Live Events: {liveCount}
        </span>
      </div>

      <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {liveCount > 0 ? (
          seismicEvents.map((event) => {
            const mag = event.properties.mag;
            const place = event.properties.place;
            const time = new Date(event.properties.time).toLocaleTimeString();
            const depth = event.geometry.coordinates[2];

            return (
              <div key={event.id} className="mh-flex-row" style={{
                background: '#020617',
                borderLeft: `4px solid ${mag >= 5 ? '#ef4444' : mag >= 3 ? '#f59e0b' : '#10b981'}`,
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#e2e8f0' }}>{place}</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    Depth: {depth} km | Time: {time}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: mag >= 5 ? '#ef4444' : mag >= 3 ? '#f59e0b' : '#10b981'
                  }}>
                    M {mag}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ color: '#64748b', fontSize: '13px' }}>Fetching real-time seismic details...</p>
        )}
      </div>
    </div>
  );
};

export default EarthquakeDetailPanel;