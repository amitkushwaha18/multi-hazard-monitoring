import React, { useEffect, useState } from 'react';
import { API_BASE_URL, withRetry } from '../config';

const ACTIVE_ASSET_TYPES = ['Bridge', 'Dam', 'Building'];

const AssetHealthPanel = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAssetData = async (isFirstLoad) => {
      if (isFirstLoad) setLoading(true);
      try {
        const data = await withRetry(async () => {
          const res = await fetch(`${API_BASE_URL}/api/assets`);
          if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
          return res.json();
        }, isFirstLoad ? 3 : 0, 2500);

        if (cancelled) return;
        const items = Array.isArray(data) ? data : [];
        setAssets(items.filter((a) => ACTIVE_ASSET_TYPES.includes(a?.type)));
        setBackendOnline(true);
      } catch (err) {
        // Keep the last known asset telemetry rather than dropping to 0.
        console.warn('Backend offline or error fetching assets:', err.message);
        if (!cancelled) setBackendOnline(false);
      } finally {
        if (!cancelled && isFirstLoad) setLoading(false);
      }
    };

    fetchAssetData(true);

    const intervalId = setInterval(() => fetchAssetData(false), 20000);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, []);

  return (
    <div style={{
      marginTop: '20px',
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
    }}>
      <div className="mh-flex-head" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '12px',
        marginBottom: '16px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
          Infrastructure Structural Health Monitoring (Bridges, Dams & Buildings)
        </h2>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Monitored Assets: {loading && assets.length === 0 ? '…' : assets.length}
        </span>
      </div>

      {loading && assets.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
              <div className="mh-skeleton" style={{ height: '14px', width: '60%', marginBottom: '10px' }} />
              <div className="mh-skeleton" style={{ height: '10px', width: '45%', marginBottom: '18px' }} />
              <div className="mh-skeleton" style={{ height: '8px', width: '100%', marginBottom: '16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div className="mh-skeleton" style={{ height: '42px' }} />
                <div className="mh-skeleton" style={{ height: '42px' }} />
                <div className="mh-skeleton" style={{ height: '42px' }} />
              </div>
            </div>
          ))}
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', fontSize: '12.5px', margin: 0 }}>
            Waking the live backend — asset telemetry will appear automatically…
          </p>
        </div>
      ) : assets.length === 0 ? (
        backendOnline === false ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>
            Backend is offline — live asset telemetry unavailable. Monitored Assets: 0.
          </p>
        ) : (
          <p style={{ textAlign: 'center', color: '#64748b' }}>
            No infrastructure assets registered yet. Monitored Assets: 0.
          </p>
        )
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {assets.map((asset) => {
            const health = asset.healthMetrics?.structuralHealthIndex || 0;
            const healthColor = health > 80 ? '#10b981' : health > 60 ? '#f59e0b' : '#ef4444';

            return (
              <div key={asset._id || asset.name} style={{
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0' }}>{asset.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Type: <b>{asset.type}</b> • {asset.location?.city || 'India'}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    background: asset.status === 'Safe' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: asset.status === 'Safe' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${asset.status === 'Safe' ? '#059669' : '#d97706'}`
                  }}>
                    {asset.status}
                  </span>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                    <span>Structural Health Index</span>
                    <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{health}/100</span>
                  </div>
                  <div style={{ background: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${health}%`, height: '100%', background: healthColor }}></div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #1e293b',
                  textAlign: 'center'
                }}>
                  <div style={{ background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Vibration</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>
                      {asset.healthMetrics?.vibration || '0'} mm/s
                    </p>
                  </div>
                  <div style={{ background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Tilt</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>
                      {asset.healthMetrics?.tilt || '0'}°
                    </p>
                  </div>
                  <div style={{ background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Crack</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>
                      {asset.healthMetrics?.crackWidth || '0'} mm
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssetHealthPanel;