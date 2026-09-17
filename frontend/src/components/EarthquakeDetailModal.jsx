import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

const DEFAULT_LOCATION = { lat: 26.8467, lng: 80.9462, name: 'Lucknow', region: 'Uttar Pradesh', country: 'India' };

const THEME = {
  bg: '#030712',
  panel: 'linear-gradient(155deg, rgba(26,36,58,0.88) 0%, rgba(9,13,24,0.92) 100%)',
  border: 'rgba(148, 163, 184, 0.14)',
  borderStrong: 'rgba(148, 163, 184, 0.28)',
  text: '#e9eff6',
  muted: '#8b97a8',
  cyan: '#22d3ee',
  blue: '#38bdf8',
  safe: '#34d399',
  moderate: '#fbbf24',
  high: '#f97316',
  critical: '#f4453e',
  display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  sans: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};

const cardStyle = {
  background: THEME.panel,
  border: `1px solid ${THEME.border}`,
  borderRadius: '16px',
  boxShadow: '0 24px 46px -26px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const riskColor = (level) => {
  if (level === 'CRITICAL') return THEME.critical;
  if (level === 'HIGH') return THEME.high;
  if (level === 'MODERATE') return THEME.moderate;
  return THEME.safe;
};

const GAUGE_R = 64;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

const EarthquakeDetailModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [locationInfo, setLocationInfo] = useState({
    name: 'Detecting location…',
    region: '',
    country: '',
    accuracy: null,
    source: 'pending',
  });
  const [coords, setCoords] = useState({ lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng });
  const [quakeData, setQuakeData] = useState(null);
  const [dataSource, setDataSource] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });
          resolveLocationName(lat, lng, position.coords.accuracy, 'gps');
          fetchTelemetry();
        },
        (error) => {
          console.warn('Geolocation denied or failed, using default location:', error.message);
          setLocationInfo({
            name: DEFAULT_LOCATION.name,
            region: DEFAULT_LOCATION.region,
            country: DEFAULT_LOCATION.country,
            accuracy: null,
            source: 'default',
          });
          fetchTelemetry();
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setLocationInfo({
        name: DEFAULT_LOCATION.name,
        region: DEFAULT_LOCATION.region,
        country: DEFAULT_LOCATION.country,
        accuracy: null,
        source: 'default',
      });
      fetchTelemetry();
    }
  }, [isOpen]);

  const resolveLocationName = async (lat, lng, accuracy, source) => {
    try {
      const res = await axios.get(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      const d = res.data || {};
      setLocationInfo({
        name: d.city || d.locality || d.principalSubdivision || 'Unnamed area',
        region: d.principalSubdivision || '',
        country: d.countryName || '',
        accuracy,
        source,
      });
    } catch (e) {
      console.warn('Reverse geocoding failed:', e.message);
      setLocationInfo({ name: 'Live GPS position', region: '', country: '', accuracy, source });
    }
  };

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/hazards/seismic');
      const features = res.data?.features || [];
      
      let maxMag = 0;
      features.forEach(f => {
        const mag = f.properties?.mag || 0;
        if (mag > maxMag) maxMag = mag;
      });

      setQuakeData({
        totalEvents: features.length,
        maxMagnitude: maxMag,
        recentActivity: features.slice(0, 24).map(f => f.properties?.mag || 0),
      });
      setDataSource('Backend seismic feed');
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Backend seismic fetch failed, setting 0 data:', err.message);
      setQuakeData({
        totalEvents: 0,
        maxMagnitude: 0,
        recentActivity: Array(24).fill(0),
      });
      setDataSource('Backend offline (0 data)');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  const analysis = useMemo(() => {
    const hourly = (quakeData?.recentActivity || Array(24).fill(0)).slice(0, 24);
    const maxMag = quakeData?.maxMagnitude ?? 0;
    const totalEv = quakeData?.totalEvents ?? 0;
    const currentHour = clock.getHours();

    const magScore = Math.min((maxMag / 8) * 100, 100);
    const eventScore = Math.min((totalEv / 400) * 100, 100);
    const composite = Math.round(magScore * 0.7 + eventScore * 0.3);

    let level = 'LOW';
    if (composite >= 75) level = 'CRITICAL';
    else if (composite >= 50) level = 'HIGH';
    else if (composite >= 25) level = 'MODERATE';

    return {
      hourly, maxMag, totalEv, currentHour,
      magScore, eventScore, composite, level,
      maxVal: Math.max(...hourly, maxMag, 7),
    };
  }, [quakeData, clock]);

  const chart = useMemo(() => {
    const w = 1000, h = 200, padTop = 15, padBottom = 8, padX = 6;
    const usableH = h - padTop - padBottom;
    const len = analysis.hourly.length || 1;

    const points = analysis.hourly.map((v, i) => {
      const x = padX + (i / (len - 1)) * (w - padX * 2);
      const y = padTop + usableH - (Math.min(v, analysis.maxVal) / (analysis.maxVal || 1)) * usableH;
      return { x, y, v };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const baseline = h - padBottom;
    const area = points.length
      ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`
      : '';
    const current = points[Math.min(analysis.currentHour, points.length - 1)] || { x: 0, y: h };

    return { w, h, points, line, area, current, baseline };
  }, [analysis]);

  if (!isOpen) return null;

  const rColor = riskColor(analysis.level);
  const locationLine = [locationInfo.region, locationInfo.country].filter(Boolean).join(', ');
  const gaugeDash = `${(analysis.composite / 100) * GAUGE_CIRC} ${GAUGE_CIRC}`;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: '#020617', zIndex: 99999,
        display: 'flex', flexDirection: 'column', color: THEME.text, fontFamily: THEME.sans,
        overflowY: 'auto', padding: '24px'
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .eqm-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
        .eqm-card:hover { transform: translateY(-2px); box-shadow: 0 20px 40px -20px rgba(0,0,0,0.85); }
        .eqm-close { transition: transform 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .eqm-close:hover { color: #e9eff6; border-color: #8b97a8; background: rgba(255,255,255,0.1); }
      `}</style>

      {/* Top Bar Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: THEME.text, margin: 0, fontFamily: THEME.display }}>
              Earthquake &amp; Seismic Risk Monitor
            </h1>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: THEME.cyan,
              border: '1px solid rgba(34,211,238,0.35)', borderRadius: '20px', padding: '3px 10px', fontFamily: THEME.mono,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME.cyan, animation: 'pulseDot 1.6s infinite' }} />
              LIVE
            </span>
          </div>
          <p style={{ color: THEME.muted, fontSize: '13px', margin: '4px 0 0 0', fontFamily: THEME.mono }}>
            {clock.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} · {clock.toLocaleTimeString()}
          </p>
        </div>
        <button
          className="eqm-close"
          onClick={onClose}
          style={{
            background: 'rgba(32,44,66,0.8)', color: THEME.muted, border: `1px solid ${THEME.borderStrong}`,
            borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
          }}
        >
          ← Back
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', border: `3px solid ${THEME.cyan}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ color: THEME.muted, fontSize: '14px' }}>Acquiring backend seismic telemetry…</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          
          {/* Top Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="eqm-card" style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Max Magnitude</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: THEME.critical, fontFamily: THEME.mono }}>
                {analysis.maxMag.toFixed(1)} <span style={{ fontSize: '12px', color: THEME.muted }}>M</span>
              </div>
            </div>
            <div className="eqm-card" style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Total Events Today</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: THEME.cyan, fontFamily: THEME.mono }}>
                {analysis.totalEv} <span style={{ fontSize: '12px', color: THEME.muted }}>events</span>
              </div>
            </div>
            <div className="eqm-card" style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Seismic Index</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: THEME.safe, fontFamily: THEME.mono }}>
                {analysis.composite} <span style={{ fontSize: '12px', color: THEME.muted }}>/100</span>
              </div>
            </div>
            <div className="eqm-card" style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Data Source</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: THEME.text, marginTop: '6px' }}>{dataSource}</div>
            </div>
          </div>

          {/* Main Grid: Location & Risk on Left, Chart on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="eqm-card" style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                  Detected Location
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: THEME.text, fontFamily: THEME.display }}>{locationInfo.name}</div>
                {locationLine && <div style={{ fontSize: '13px', color: THEME.muted, marginTop: '2px' }}>{locationLine}</div>}

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: THEME.mono, fontSize: '12.5px' }}>
                  <Row label="Latitude" value={`${coords.lat.toFixed(4)}°`} />
                  <Row label="Longitude" value={`${coords.lng.toFixed(4)}°`} />
                  {lastUpdated && <Row label="Synced" value={lastUpdated.toLocaleTimeString()} />}
                </div>
              </div>

              {/* Composite Risk Score Gauge */}
              <div className="eqm-card" style={{ ...cardStyle, border: `1px solid ${rColor}55`, padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
                  Composite Risk Score
                </div>

                <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 10px auto' }}>
                  <svg width="130" height="130" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r={GAUGE_R} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="12" />
                    <circle
                      cx="75" cy="75" r={GAUGE_R} fill="none" stroke={rColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={gaugeDash} transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '28px', fontWeight: 700, color: rColor, fontFamily: THEME.mono }}>{analysis.composite}</span>
                    <span style={{ fontSize: '10px', color: THEME.muted }}>out of 100</span>
                  </div>
                </div>

                <div style={{
                  display: 'inline-block', fontSize: '12px', fontWeight: 700, color: rColor,
                  border: `1px solid ${rColor}66`, borderRadius: '6px', padding: '4px 12px', background: `${rColor}14`,
                  marginBottom: '10px'
                }}>
                  {analysis.level} RISK
                </div>
                <p style={{ fontSize: '12.5px', color: THEME.muted, margin: 0, lineHeight: 1.5 }}>
                  Seismic activity and maximum recorded magnitude are reporting zero or normal state.
                </p>
              </div>
            </div>

            {/* Right Column: Chart & Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

              {/* Chart Card */}
              <div className="eqm-card" style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: THEME.text, margin: 0, fontWeight: 700, fontFamily: THEME.display }}>24-hour seismic magnitude trend</h3>
                    <p style={{ fontSize: '12.5px', color: THEME.muted, margin: '2px 0 0 0' }}>Hourly maximum magnitude trend for the detected coordinate</p>
                  </div>
                  <span style={{ fontSize: '11px', color: THEME.cyan, border: '1px solid rgba(34,211,238,0.3)', padding: '3px 8px', borderRadius: '6px', fontFamily: THEME.mono }}>
                    backend stream
                  </span>
                </div>

                <svg viewBox={`0 0 ${chart.w} ${chart.h}`} style={{ width: '100%', height: '220px', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="areaFillQuake" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={THEME.critical} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={THEME.critical} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={chart.area} fill="url(#areaFillQuake)" />
                  <path d={chart.line} fill="none" stroke={THEME.critical} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={chart.current.x} cy={chart.current.y} r="5" fill={THEME.critical} />
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: THEME.muted, marginTop: '8px', fontFamily: THEME.mono }}>
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Risk Factor Breakdown */}
              <div className="eqm-card" style={{ ...cardStyle, padding: '20px' }}>
                <h3 style={{ fontSize: '16px', color: THEME.text, margin: '0 0 4px 0', fontWeight: 700, fontFamily: THEME.display }}>Risk factor breakdown</h3>
                <p style={{ fontSize: '12.5px', color: THEME.muted, margin: '0 0 16px 0' }}>How each signal contributes to the composite score</p>
                
                <FactorBar label="Maximum Magnitude Severity" score={analysis.magScore} detail={`Magnitude ${analysis.maxMag.toFixed(1)} against baseline threshold`} />
                <FactorBar label="Global Event Frequency" score={analysis.eventScore} detail={`${analysis.totalEv} seismic events tracked`} last />
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  ,
    document.body
  );
};

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: THEME.muted }}>{label}</span>
    <span style={{ color: THEME.text }}>{value}</span>
  </div>
);

const FactorBar = ({ label, score, detail, last }) => {
  const barColor = score >= 75 ? THEME.critical : score >= 50 ? THEME.high : score >= 25 ? THEME.moderate : THEME.safe;
  return (
    <div style={{ marginBottom: last ? 0 : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
        <span style={{ color: THEME.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color: barColor, fontFamily: THEME.mono, fontWeight: 700 }}>{Math.round(score)}%</span>
      </div>
      <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: '4px', background: barColor }} />
      </div>
      <div style={{ fontSize: '11.5px', color: THEME.muted, marginTop: '4px' }}>{detail}</div>
    </div>
  );
};

export default EarthquakeDetailModal;