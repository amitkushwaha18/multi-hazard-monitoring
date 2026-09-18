import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_BASE_URL, withRetry } from '../config';

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

const compassLabel = (deg) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
};

const GAUGE_R = 64;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

const CycloneDetailModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [locationInfo, setLocationInfo] = useState({
    name: 'Detecting location…',
    region: '',
    country: '',
    accuracy: null,
    source: 'pending',
  });
  const [coords, setCoords] = useState({ lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng });
  const [elevation, setElevation] = useState(null);
  const [cycloneData, setCycloneData] = useState(null);
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
          fetchTelemetry(lat, lng);
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
          fetchTelemetry(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
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
      fetchTelemetry(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
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

  const fetchTelemetry = async (lat, lng) => {
    setLoading(true);
    try {
      const res = await withRetry(
        () => axios.get(`${API_BASE_URL}/api/hazards/cyclone?lat=${lat}&lng=${lng}`, { timeout: 12000 }),
        3,
        2500
      );
      setCycloneData({
        currentWindSpeed: res.data?.currentWindSpeed ?? 0,
        currentWindGusts: res.data?.currentWindGusts ?? 0,
        windDirection: res.data?.windDirection ?? 0,
        hourlyForecast: res.data?.hourlyForecast || { wind_speed_10m: Array(24).fill(0) },
      });
      setElevation(res.data?.elevation ?? 0);
      setDataSource('Backend wind telemetry');
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Backend cyclone telemetry fetch failed, setting 0 data:', err.message);
      setCycloneData({
        currentWindSpeed: 0,
        currentWindGusts: 0,
        windDirection: 0,
        hourlyForecast: { wind_speed_10m: Array(24).fill(0) },
      });
      setDataSource('Backend offline (0 data)');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  const analysis = useMemo(() => {
    const hourly = (cycloneData?.hourlyForecast?.wind_speed_10m || Array(24).fill(0)).slice(0, 24);
    const windSpeed = cycloneData?.currentWindSpeed ?? 0;
    const windGusts = cycloneData?.currentWindGusts ?? 0;
    const currentHour = clock.getHours();
    const upcoming = hourly.slice(currentHour, currentHour + 6);
    const upcomingAvg = upcoming.length ? upcoming.reduce((a, b) => a + b, 0) / upcoming.length : 0;
    const trendDelta = upcomingAvg - windSpeed;

    const windScore = Math.min((windSpeed / 60) * 100, 100);
    const gustScore = Math.min((windGusts / 90) * 100, 100);
    const trendScore = Math.max(Math.min(trendDelta * 5, 100), 0);
    const composite = Math.round(windScore * 0.5 + gustScore * 0.3 + trendScore * 0.2);

    let level = 'LOW';
    if (composite >= 75) level = 'CRITICAL';
    else if (composite >= 50) level = 'HIGH';
    else if (composite >= 25) level = 'MODERATE';

    return {
      hourly, windSpeed, windGusts, windDirection: cycloneData?.windDirection || 0,
      currentHour, trendDelta, windScore, gustScore, trendScore, composite, level,
      maxVal: Math.max(...hourly, windSpeed, 50),
    };
  }, [cycloneData, clock]);

  const chart = useMemo(() => {
    const w = 1000, h = 260, padTop = 18, padBottom = 8, padX = 6;
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
      className="cdm-root"
      style={{
        position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at top, #071021 0%, #020408 70%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', color: THEME.text, fontFamily: THEME.sans,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .cdm-scroll { overflow-x: hidden; }
        .cdm-scroll::-webkit-scrollbar { width: 8px; }
        .cdm-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 8px; }
        .cdm-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
        .cdm-card:hover { transform: translateY(-3px); box-shadow: 0 30px 54px -24px rgba(0,0,0,0.85); }
        .cdm-close { transition: transform 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        .cdm-close:hover { color: #e9eff6; border-color: #8b97a8; transform: translateY(-1px); }
        @media (max-width: 768px) {
          .cdm-root > div:first-of-type { padding: 12px 16px !important; }
          .cdm-root h1 { font-size: 16px !important; }
          .cdm-scroll { padding: 18px 14px 32px !important; }
          .cdm-scroll > div:first-of-type { grid-template-columns: 1fr !important; gap: 16px !important; }
          .cdm-scroll > div:first-of-type > div:first-child { position: static !important; }
          .cdm-card { padding: 16px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 36px', borderBottom: `1px solid ${THEME.border}`, flexShrink: 0,
        background: 'rgba(3, 7, 18, 0.6)', backdropFilter: 'blur(10px)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: THEME.text, margin: 0, letterSpacing: '-0.015em', fontFamily: THEME.display }}>
              Cyclone &amp; High Wind Risk Monitor
            </h1>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: THEME.cyan,
              border: '1px solid rgba(34,211,238,0.35)', borderRadius: '20px', padding: '3px 10px', fontFamily: THEME.mono,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME.cyan, animation: 'pulseDot 1.6s ease-in-out infinite' }} />
              LIVE
            </span>
          </div>
          <p style={{ color: THEME.muted, fontSize: '13px', margin: '5px 0 0 0', fontFamily: THEME.mono }}>
            {clock.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            {'  ·  '}
            {clock.toLocaleTimeString()}
          </p>
        </div>
        <button
          className="cdm-close"
          onClick={onClose}
          style={{
            background: 'linear-gradient(145deg, rgba(32,44,66,0.9), rgba(13,19,32,0.9))',
            color: THEME.muted, border: `1px solid ${THEME.borderStrong}`,
            borderRadius: '10px', padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
          }}
        >
          ← Back
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', border: `3px solid ${THEME.cyan}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ color: THEME.muted, fontSize: '14px' }}>Acquiring backend wind telemetry…</p>
        </div>
      ) : (
        <div className="cdm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '28px 36px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '22px', alignItems: 'start' }}>

            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'sticky', top: 0 }}>
              <div className="cdm-card" style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontWeight: 600 }}>
                  Detected location
                </div>
                <div style={{ fontSize: '23px', fontWeight: 700, color: THEME.text, lineHeight: 1.2, fontFamily: THEME.display }}>{locationInfo.name}</div>
                {locationLine && <div style={{ fontSize: '13.5px', color: THEME.muted, marginTop: '4px' }}>{locationLine}</div>}

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: THEME.mono, fontSize: '12.5px' }}>
                  <Row label="Latitude" value={`${coords.lat.toFixed(4)}°`} />
                  <Row label="Longitude" value={`${coords.lng.toFixed(4)}°`} />
                  {elevation !== null && <Row label="Elevation" value={`${Math.round(elevation)} m`} />}
                </div>

                <div style={{
                  marginTop: '16px', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: THEME.muted,
                  borderTop: `1px solid ${THEME.border}`, paddingTop: '12px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: locationInfo.source === 'gps' ? THEME.safe : THEME.moderate }} />
                  {locationInfo.source === 'gps' ? 'Live GPS lock' : 'Default location'}
                  {lastUpdated && <span style={{ marginLeft: 'auto' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
                </div>
              </div>

              {/* Composite risk gauge */}
              <div className="cdm-card" style={{ ...cardStyle, border: `1px solid ${rColor}55`, padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 600 }}>
                  Composite wind risk
                </div>

                <div style={{ position: 'relative', width: '150px', height: '150px', margin: '10px auto 6px' }}>
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r={GAUGE_R} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="12" />
                    <circle
                      cx="75" cy="75" r={GAUGE_R} fill="none" stroke={rColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={gaugeDash} transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '34px', fontWeight: 700, color: rColor, fontFamily: THEME.mono }}>{analysis.composite}</span>
                    <span style={{ fontSize: '10.5px', color: THEME.muted }}>out of 100</span>
                  </div>
                </div>

                <div style={{
                  display: 'inline-block', fontSize: '12px', fontWeight: 700, color: rColor,
                  border: `1px solid ${rColor}66`, borderRadius: '8px', padding: '4px 12px', background: `${rColor}14`,
                }}>
                  {analysis.level} RISK
                </div>

                <p style={{ fontSize: '12.5px', color: THEME.muted, marginTop: '14px', lineHeight: 1.6, textAlign: 'left' }}>
                  Wind speed and gusts are reporting zero or baseline state from the backend.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <MetricCard label="Wind speed" value={analysis.windSpeed.toFixed(1)} unit="km/h" color={THEME.blue} />
                <MetricCard label="Wind gusts" value={analysis.windGusts.toFixed(1)} unit="km/h" color={THEME.high} />
                <MetricCard label="Wind direction" value={`${Math.round(analysis.windDirection)}° ${compassLabel(analysis.windDirection)}`} unit="" color={THEME.safe} />
                <MetricCard label="Data source" value={dataSource || '—'} unit="" color={THEME.muted} small />
              </div>

              {/* Chart */}
              <div className="cdm-card" style={{ ...cardStyle, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div>
                    <h3 style={{ fontSize: '16.5px', color: THEME.text, margin: 0, fontWeight: 700, fontFamily: THEME.display }}>24-hour wind velocity trend</h3>
                    <p style={{ color: THEME.muted, fontSize: '12.5px', margin: '4px 0 0 0' }}>Hourly forecast from backend telemetry</p>
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: THEME.cyan,
                    border: '1px solid rgba(34,211,238,0.35)', borderRadius: '20px', padding: '3px 10px', fontFamily: THEME.mono,
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME.cyan, animation: 'pulseDot 1.6s ease-in-out infinite' }} />
                    backend
                  </span>
                </div>

                <svg viewBox={`0 0 ${chart.w} ${chart.h}`} style={{ width: '100%', height: '240px', marginTop: '8px', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="areaFillWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={THEME.blue} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={THEME.blue} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75].map((f) => (
                    <line key={f} x1="0" x2={chart.w} y1={18 + (chart.h - 26) * f} y2={18 + (chart.h - 26) * f}
                      stroke="rgba(148,163,184,0.12)" strokeDasharray="4 6" />
                  ))}

                  <path d={chart.area} fill="url(#areaFillWind)" />
                  <path
                    d={chart.line} fill="none" stroke={THEME.blue} strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  />

                  <line x1={chart.current.x} x2={chart.current.x} y1="18" y2={chart.baseline} stroke="rgba(226,232,240,0.25)" strokeDasharray="3 4" />
                  <circle cx={chart.current.x} cy={chart.current.y} r="4" fill={THEME.blue} />
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: THEME.muted, fontFamily: THEME.mono, marginTop: '4px' }}>
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>

              {/* Risk Factor Breakdown */}
              <div className="cdm-card" style={{ ...cardStyle, padding: '24px' }}>
                <h3 style={{ fontSize: '16.5px', color: THEME.text, margin: '0 0 4px 0', fontWeight: 700, fontFamily: THEME.display }}>Wind risk factor breakdown</h3>
                <p style={{ color: THEME.muted, fontSize: '12.5px', margin: '0 0 18px 0' }}>How each signal contributes to the composite score</p>

                <FactorBar label="Wind speed" score={analysis.windScore} detail={`${analysis.windSpeed.toFixed(1)} km/h`} />
                <FactorBar label="Wind gusts" score={analysis.gustScore} detail={`${analysis.windGusts.toFixed(1)} km/h`} />
                <FactorBar label="Short-term trend" score={analysis.trendScore} detail="Stable or zero backend reading" last />
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

const MetricCard = ({ label, value, unit, color, small }) => (
  <div className="cdm-card" style={{ ...cardStyle, padding: '18px' }}>
    <div style={{ fontSize: '11px', color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    <div style={{
      fontSize: small ? '14px' : '29px', fontWeight: 700, color, marginTop: '8px', fontFamily: small ? THEME.sans : THEME.mono,
    }}>
      {value}{unit && <span style={{ fontSize: '13px', color: THEME.muted, marginLeft: '4px' }}>{unit}</span>}
    </div>
  </div>
);

const FactorBar = ({ label, score, detail, last }) => {
  const color = score >= 75 ? THEME.critical : score >= 50 ? THEME.high : score >= 25 ? THEME.moderate : THEME.safe;
  return (
    <div style={{ marginBottom: last ? 0 : '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
        <span style={{ color: THEME.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontFamily: THEME.mono }}>{Math.round(score)}%</span>
      </div>
      <div style={{ height: '8px', borderRadius: '5px', background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: '5px', background: color }} />
      </div>
      <div style={{ fontSize: '12px', color: THEME.muted, marginTop: '6px' }}>{detail}</div>
    </div>
  );
};

export default CycloneDetailModal;