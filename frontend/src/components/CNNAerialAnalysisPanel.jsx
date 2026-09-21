import React from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const round1 = (v) => Math.round(clamp(Number(v) || 0, 0, 100) * 10) / 10;

const SectionTitle = ({ icon, title, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
    <span style={{ fontSize: '12.5px', color: '#e2e8f0', fontWeight: '700', letterSpacing: '0.01em' }}>
      {icon} {title}
    </span>
    {hint && (
      <span
        title={hint}
        style={{
          fontSize: '9.5px',
          fontWeight: 'bold',
          color: '#22d3ee',
          border: '1px solid rgba(34,211,238,0.4)',
          background: 'rgba(34,211,238,0.1)',
          borderRadius: '999px',
          padding: '1px 8px',
          cursor: 'help'
        }}
      >
        ⓘ
      </span>
    )}
  </div>
);

const StatTile = ({ label, value, unit, color, hint }) => (
  <div
    title={hint}
    style={{
      flex: '1 1 130px',
      minWidth: '120px',
      background: 'linear-gradient(160deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '10px 12px'
    }}
  >
    <div style={{ fontSize: '19px', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
      {value}
      {unit ? <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginLeft: '3px' }}>{unit}</span> : null}
    </div>
    <div style={{
      fontSize: '9.5px',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginTop: '4px'
    }}>
      {label}
    </div>
  </div>
);

const CNNAerialAnalysisPanel = ({ locationName, risk, ml, mlLoading }) => {
  const isActive = Boolean(locationName);

  // Real values come from the live CNN analysis in the ML backend.
  const metrics = {
    structuralIntegrity: ml ? round1(ml.structuralIntegrity) : 0,
    floodSubmersion: ml ? round1(ml.floodSubmersion) : 0
  };
  const frames = ml?.framesDecoded || 0;
  const satellitePasses = ml?.satellitePasses || 0;
  const droneSorties = ml?.droneSorties || 0;
  const confidence = ml ? clamp(ml.detectionConfidence, 0, 100) : 0;
  const damageClass = ml ? (ml.damageClass || '—') : '—';
  const floodedAreaSqKm = ml?.floodedAreaSqKm || 0;
  const damageScore = ml ? clamp(ml.damageScore, 0, 100) : 0;
  const waterRatio = ml ? clamp((ml.waterRatio || 0) * 100, 0, 100) : 0;
  const blockedRoadNodes = Array.isArray(ml?.blockedRoadNodes) ? ml.blockedRoadNodes.length : 0;
  const blockedRoadRatio = ml ? clamp((ml.blockedRoadRatio || 0) * 100, 0, 100) : 0;
  const imageSource = ml?.imageSource || '—';

  // Nominal ground sampling distance derived from the real tile zoom level
  // embedded in the CNN image source (e.g. "live-imagery-z18").
  const zoomMatch = String(imageSource).match(/z(\d+)/);
  const satelliteZoom = zoomMatch ? Number(zoomMatch[1]) : null;
  const gsdMeters = satelliteZoom ? 156543.03 / Math.pow(2, satelliteZoom) : null;
  const gsdLabel = gsdMeters
    ? (gsdMeters < 1 ? `≈ ${(gsdMeters * 100).toFixed(0)} cm/px` : `≈ ${gsdMeters.toFixed(1)} m/px`)
    : '—';
  const sourceLabel = imageSource === '—'
    ? '—'
    : /upload/i.test(imageSource)
      ? 'Uploaded Aerial Frame'
      : 'Live Satellite Tile';

  const feedLabel = mlLoading
    ? `Running live CNN inference on ${locationName} aerial feed…`
    : isActive
      ? `Real-time analysis of ${locationName} aerial feed (${ml?.imageSource || 'live imagery'})`
      : 'Standby — awaiting satellite / drone feed';

  const statusColor = isActive ? '#34d399' : '#64748b';
  const statusText = mlLoading ? 'RUNNING' : (isActive ? 'LIVE' : 'STANDBY');
  const statusBg = isActive ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)';

  const integrityBarColor = metrics.structuralIntegrity > 95 ? '#a855f7' : metrics.structuralIntegrity > 75 ? '#38bdf8' : '#f59e0b';
  const submersionBarColor = metrics.floodSubmersion > 60 ? '#ef4444' : metrics.floodSubmersion > 30 ? '#f59e0b' : '#38bdf8';
  const damageTone = damageClass === 'Severe / Critical' ? '#ef4444' : damageClass === 'Moderate' ? '#f59e0b' : '#34d399';

  const MetricBar = ({ label, value, color, suffix, hint }) => (
    <div title={hint}>
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
          boxShadow: `0 0 12px ${color}88`,
          borderRadius: '6px',
          transition: 'width 0.8s ease'
        }} />
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(2,6,23,0.6), rgba(15,23,42,1) 40%)',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Hero glow accent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(600px 110px at 12% 0%, rgba(34,211,238,0.16), transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* ================= HERO HEADER ================= */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            fontWeight: '800',
            letterSpacing: '0.14em',
            color: '#22d3ee',
            background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.45)',
            borderRadius: '999px',
            padding: '4px 12px',
            boxShadow: '0 0 18px rgba(34,211,238,0.35)'
          }}>
            🛰️ ENGINE 01 | COMPUTER VISION
          </span>
          <h2 style={{
            margin: '10px 0 0',
            fontSize: 'clamp(18px, 2.4vw, 24px)',
            fontWeight: '800',
            letterSpacing: '0.01em',
            background: 'linear-gradient(90deg, #22d3ee, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(34,211,238,0.25)'
          }}>
            CNN Spatial Damage &amp; Aerial Analysis Engine
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
            YOLOv8 Computer Vision · Satellite &amp; Drone Fusion · Pixel-level damage &amp; flood segmentation
          </p>
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

      {/* Key metrics summary tags */}
      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Detection Confidence', value: isActive ? `${confidence.toFixed(1)}%` : '—', tone: '#22d3ee' },
          { label: 'Damage Class', value: isActive ? damageClass : '—', tone: damageTone },
          { label: 'Flooded Area', value: isActive ? `${floodedAreaSqKm} km²` : '—', tone: '#38bdf8' },
          { label: 'Blocked Junctions', value: isActive ? blockedRoadNodes : '—', tone: '#f59e0b' }
        ].map(tag => (
          <span key={tag.label} style={{
            fontSize: '10.5px',
            color: '#cbd5e1',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${tag.tone}44`,
            borderRadius: '999px',
            padding: '4px 11px'
          }}>
            {tag.label}: <b style={{ color: tag.tone }}>{tag.value}</b>
          </span>
        ))}
      </div>

      {/* ================= FEED STATUS STRIP ================= */}
      <div style={{
        position: 'relative',
        background: '#020617',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '12px 16px',
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
              ? `${frames.toLocaleString()} frames decoded · ${satellitePasses} satellite passes · ${droneSorties} drone sorties`
              : 'Feed auto-initializes upon location selection'}
          </div>
        </div>
        {isActive && (
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', whiteSpace: 'nowrap' }}>
            ⟳ Live
          </span>
        )}
      </div>

      {/* ================= SENSOR & IMAGERY ACQUISITION ================= */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <SectionTitle
          icon="🛰️"
          title="Sensor & Imagery Acquisition"
          hint="Where the analysed pixels came from — imagery source, zoom-derived resolution and acquisition counts."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <StatTile
            label="Imagery Source"
            value={isActive ? sourceLabel : '—'}
            color="#22d3ee"
            hint="Live satellite tile or uploaded aerial frame analysed by the CNN."
          />
          <StatTile
            label="Ground Sampling"
            value={isActive ? gsdLabel : '—'}
            color="#3b82f6"
            hint="Nominal satellite resolution derived from the real tile zoom level."
          />
          <StatTile
            label="Satellite Passes"
            value={isActive ? satellitePasses : '—'}
            color="#a855f7"
            hint="Number of satellite passes fused into this analysis."
          />
          <StatTile
            label="Drone Sorties"
            value={isActive ? droneSorties : '—'}
            color="#34d399"
            hint="Number of drone sorties contributing aerial frames."
          />
        </div>
      </div>

      {/* ================= DAMAGE & SUBMERSION METERS ================= */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '16px' }}>
        <div style={{
          background: 'rgba(2,6,23,0.6)',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '14px'
        }}>
          <SectionTitle
            icon="🏗️"
            title="Structural Damage Meter"
            hint="Percentage of intact built infrastructure estimated from the CNN damage head. Higher is better."
          />
          <MetricBar
            label="Structural Integrity"
            value={metrics.structuralIntegrity}
            color={integrityBarColor}
            suffix="%"
            hint="100% = all structures intact; lower values indicate visible structural damage."
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
            <span>Damage Score: <b style={{ color: '#f59e0b' }}>{isActive ? `${damageScore.toFixed(1)}/100` : '—'}</b></span>
            <span>Class: <b style={{ color: damageTone }}>{isActive ? damageClass : '—'}</b></span>
          </div>
        </div>

        <div style={{
          background: 'rgba(2,6,23,0.6)',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '14px'
        }}>
          <SectionTitle
            icon="🌊"
            title="Flood Submersion"
            hint="Share of the analysed area under water and the estimated flooded footprint."
          />
          <MetricBar
            label="Flood Submersion Index"
            value={metrics.floodSubmersion}
            color={submersionBarColor}
            suffix="%"
            hint="Percentage of the tile classified as flooded by the CNN water segmentation."
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
            <span>Flooded Area: <b style={{ color: '#38bdf8' }}>{isActive ? `${floodedAreaSqKm} km²` : '—'}</b></span>
            <span>Water Ratio: <b style={{ color: '#38bdf8' }}>{isActive ? `${waterRatio.toFixed(1)}%` : '—'}</b></span>
          </div>
        </div>
      </div>

      {/* ================= DETECTED HAZARD ZONES ================= */}
      <div style={{
        position: 'relative',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '14px',
        background: 'rgba(2,6,23,0.6)',
        marginTop: 'auto'
      }}>
        <SectionTitle
          icon="⚠️"
          title="Detected Hazard Zones"
          hint="Road-grid obstructions and model confidence that drive the evacuation router constraints."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <StatTile label="Blocked Junctions" value={isActive ? blockedRoadNodes : '—'} color="#f59e0b" hint="Road nodes blocked by flood/damage, fed to the GA router." />
          <StatTile label="Blocked Road Ratio" value={isActive ? `${blockedRoadRatio.toFixed(1)}%` : '—'} color="#ef4444" hint="Share of the road grid that is impassable." />
          <StatTile label="Detection Confidence" value={isActive ? `${confidence.toFixed(1)}%` : '—'} color="#22d3ee" hint="Calibrated CNN probability mass for the detected damage class." />
          <StatTile label="Damage Class" value={isActive ? damageClass : '—'} color={damageTone} hint="Aggregated damage severity: Stable, Moderate or Severe." />
        </div>
      </div>
    </div>
  );
};

export default CNNAerialAnalysisPanel;
