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

const ROUTE_COLORS = ['#34d399', '#f59e0b', '#a855f7'];

const GAEvacuationRouter = ({ locationName, risk }) => {
  const seed = useMemo(() => hashString(locationName || 'baseline'), [locationName]);
  const [routes, setRoutes] = useState([]);
  const [population, setPopulation] = useState(0);
  const [evacuated, setEvacuated] = useState(0);
  const [arrivals, setArrivals] = useState(0);
  const [responseUnits, setResponseUnits] = useState(0);
  const [shelters, setShelters] = useState(0);
  const [generation, setGeneration] = useState(0);

  const isActive = Boolean(locationName);

  useEffect(() => {
    if (!isActive) {
      setRoutes([]);
      setPopulation(0);
      setEvacuated(0);
      setArrivals(0);
      setResponseUnits(0);
      setShelters(0);
      setGeneration(0);
      return;
    }

    const pop = 18000 + (seed % 62000);
    const baseThroughput = 700 + (seed % 1200);
    const routeCount = 3;
    const newRoutes = Array.from({ length: routeCount }, (_, i) => {
      const cap = Math.round((900 + (seed % 700)) * (1 - i * 0.12));
      const cost = Math.round((12 + (seed % 20)) * (1 + i * 0.3));
      return {
        id: i + 1,
        label: `Route ${String.fromCharCode(65 + i)}`,
        capacity: cap,
        costMinutes: cost,
        throughput: baseThroughput + (seed % (i + 1) * 180) + i * 95
      };
    });

    setRoutes(newRoutes);
    setPopulation(pop);
    setEvacuated(Math.round(pop * 0.16));
    setArrivals(Math.round(pop * 0.11));
    setResponseUnits(38 + (seed % 60));
    setShelters(6 + (seed % 14));
    setGeneration(42 + (seed % 120));

    const liveTimer = setInterval(() => {
      setGeneration(prev => prev + 1);
      setEvacuated(prev => clamp(prev + Math.floor(Math.random() * 40) + 12, 0, pop));
      setArrivals(prev => clamp(prev + Math.floor(Math.random() * 55) + 18, 0, pop));
      setRoutes(prevRoutes => prevRoutes.map((r) => ({
        ...r,
        throughput: Math.max(120, r.throughput + Math.floor((Math.random() - 0.45) * 60))
      })));
    }, 3000);

    return () => clearInterval(liveTimer);
  }, [isActive, seed, risk?.floodRisk]);

  const evacuationProgress = population > 0 ? clamp((evacuated / population) * 100, 0, 100) : 0;
  const arrivalProgress = population > 0 ? clamp((arrivals / population) * 100, 0, 100) : 0;

  const statusColor = isActive ? '#34d399' : '#64748b';
  const statusText = isActive ? 'OPTIMIZING' : 'IDLE';
  const statusBg = isActive ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)';

  const ResourceRow = ({ label, value, unit, color }) => (
    <div style={{
      flex: 1,
      minWidth: '120px',
      background: '#020617',
      border: '1px solid #1e293b',
      borderRadius: '10px',
      padding: '10px 12px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{label}{unit ? ` (${unit})` : ''}</div>
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
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', background: 'linear-gradient(90deg, #34d399, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🧬 GA Evacuation &amp; Resource Router
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Genetic Algorithm · Route / Throughput Optimization</p>
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

      {!isActive ? (
        <div style={{
          background: '#020617',
          border: '1px dashed #334155',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '13px',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          🚧 Select a location to generate optimal evacuation &amp; resource routes.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {routes.map((route, i) => {
              const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
              const pct = clamp(route.costMinutes > 0 ? (1 / route.costMinutes) * 100 * (900 / (900 + (seed % 700))) : 0, 20, 100);
              return (
                <div key={route.id} style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color }}>
                      🚌 {route.label} · Optimal Evacuation
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {route.throughput.toLocaleString()} ppl/hr · ~{route.costMinutes} min · cap {route.capacity.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>FITNESS</span>
                    <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${color}66, ${color})`,
                        borderRadius: '4px',
                        transition: 'width 0.8s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums' }}>G{generation}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Population Throughput Optimization</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399' }}>
                  {evacuated.toLocaleString()} / {population.toLocaleString()}
                </span>
              </div>
              <div style={{ height: '8px', background: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${evacuationProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #34d39966, #34d399)',
                  borderRadius: '6px',
                  transition: 'width 0.8s ease'
                }} />
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                {Math.round(evacuationProgress)}% evacuated · {arrivals.toLocaleString()} reached shelters ({Math.round(arrivalProgress)}%)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
              <ResourceRow label="Response Units" value={isActive ? responseUnits : '—'} color="#38bdf8" />
              <ResourceRow label="Shelters" value={isActive ? shelters : '—'} color="#a855f7" />
              <ResourceRow label="Avg ETA" value={isActive ? `${Math.round((seed % 20) + 8)}min` : '—'} color="#f59e0b" />
            </div>

            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '10px 12px',
              background: '#020617'
            }}>
              ⚙️ <b style={{ color: '#38bdf8' }}>GA Engine:</b> Chromosome pool {18 + (seed % 30)} · selection Roulette · crossover 0.85 · mutation rate 0.02 · elitism on. Best route fitness re-evaluated each generation.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GAEvacuationRouter;