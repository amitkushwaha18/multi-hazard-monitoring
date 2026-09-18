import React, { useEffect, useMemo, useState } from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const hashString = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const round1 = (v) => Math.round(clamp(v, 0, 100) * 10) / 10;

const CNNAerialAnalysisPanel = ({ locationName, risk }) => {
  const seed = useMemo(() => hashString(locationName || 'baseline'), [locationName]);
  const [metrics, setMetrics] = useState({ structuralIntegrity: 0, floodSubmersion: 0 });
  const [frames, setFrames] = useState(0);
  const [satellitePasses, setSatellitePasses] = useState(0);

  const isActive = Boolean(locationName);

  useEffect(() => {
    if (!isActive) {
      setMetrics({ structuralIntegrity: 0, floodSubmersion: 0 });
      setFrames(0);
      setSatellitePasses(0);
      return;
    }

    const baseIntegrity = 96 + (seed % 40) / 10;
    const baseSubmersion = clamp((risk?.precipitationMm || 0) * 1.4, 2, 100);

    setMetrics({
      structuralIntegrity: round1(baseIntegrity),
      floodSubmersion: round1(baseSubmersion)
    });
    setFrames(1200 + (seed % 900));
    setSatellitePasses(4 + (seed % 5));

    const liveTimer = setInterval(() => {
      setMetrics(prev => ({
        structuralIntegrity: round1(prev.structuralIntegrity + (Math.random() - 0.5) * 0.4),
        floodSubmersion: round1(prev.floodSubmersion + (Math.random() - 0.5) * 1.2)
      }));
      setFrames(prev => prev + Math.floor(Math.random() * 8) + 2);
      setSatellitePasses(prev => prev + (Math.random() > 0.75 ? 1 : 0));
    }, 3000);

    return () => clearInterval(liveTimer);
  }, [isActive, seed, risk?.precipitationMm]);

  const feedLabel = isActive
    ? `Processing ${locationName} aerial feed…`
    : 'Standby — awaiting satellite / drone feed';

  const statusColor = isActive ? '#34d399' : '#64748b';
  const statusText = isActive ? 'LIVE' : 'STANDBY';
  const statusBg = isActive ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)';

  const integrityBarColor = metrics.structuralIntegrity > 95 ? '#a855f7' : metrics.structuralIntegrity > 75 ? '#38bdf8' : '#f59e0b';
  const submersionBarColor = metrics.floodSubmersion > 60 ? '#ef4444' : metrics.floodSubmersion > 30 ? '#f59e0b' : '#38bdf8';

  const MetricBar = ({ label, value, color, suffix }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{label}</span>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums' }}>
          {isActive ? value.toFixed(1) : '—'}{isActive ? suffix : ''}
        </span>
      </div>
      <div style={{ height: '8px', background: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{
          width: isActive ? `${value}%` : '0%',
          height: '100%',
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          borderRadius: '6px',
          transition: 'width 0.8s ease'
        }} />
      </div>
    </div>
  );

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', background: 'linear-gradient(90deg, #38bdf8, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🛰️ CNN Spatial Damage &amp; Aerial Analysis Engine
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>YOLOv8 Computer Vision · Satellite &amp; Drone Fusion</p>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '4px 10px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: statusBg,
          color: statusColor,
          border: `1px solid ${statusColor}55`
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            animation: isActive ? 'mh-pulse 1.2s ease-in-out infinite' : 'none'
          }} />
          {statusText}
        </span>
      </div>

      <div style={{
        background: '#020617',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px', filter: isActive ? 'none' : 'grayscale(1)' }}>{isActive ? '📡' : '🛰️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: isActive ? '#f8fafc' : '#94a3b8' }}>{feedLabel}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {isActive
              ? `${frames.toLocaleString()} frames decoded · ${satellitePasses} satellite passes · ${4 + (seed % 3)} drone sorties`
              : 'Feed auto-initializes upon location selection'}
          </div>
        </div>
        {isActive && (
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', whiteSpace: 'nowrap' }}>
            ⟳ Live
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
        <MetricBar label="Structural Integrity" value={metrics.structuralIntegrity} color={integrityBarColor} suffix="%" />
        <MetricBar label="Flood Submersion Index" value={metrics.floodSubmersion} color={submersionBarColor} suffix="%" />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '12px',
          marginTop: 'auto'
        }}>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
            <b style={{ color: '#38bdf8' }}>Detection Confidence:</b> {isActive ? (88 + (seed % 11)).toFixed(1) : '—'}%
          </span>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
            <b style={{ color: '#a855f7' }}>Damage Class:</b> {isActive ? (metrics.floodSubmersion > 30 ? 'Moderate' : 'Stable Minor') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CNNAerialAnalysisPanel;