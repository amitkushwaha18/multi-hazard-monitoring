import React from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ROUTE_COLORS = ['#34d399', '#f59e0b', '#a855f7'];

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
          color: '#34d399',
          border: '1px solid rgba(52,211,153,0.4)',
          background: 'rgba(52,211,153,0.1)',
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

const GAEvacuationRouter = ({ locationName, risk, ml, mlLoading }) => {
  const routes = ml?.routes || [];
  const population = ml?.population || 0;
  const evacuated = ml?.evacuated || 0;
  const arrivals = ml?.arrivals || 0;
  const responseUnits = ml?.responseUnits || 0;
  const shelters = ml?.shelters || 0;
  const generation = ml?.generation || 0;
  const bestFitness = ml?.bestFitness || 0;
  const avgEta = ml?.avgEta || 0;
  const pool = ml?.chromosomePool || 0;
  const selection = ml?.selection || 'Roulette';
  const crossover = ml?.crossover ?? 0.85;
  const mutationRate = ml?.mutationRate ?? 0.02;

  const isActive = Boolean(locationName);

  const pctFor = (route) => {
    if (!isActive) return 0;
    const denom = Math.max(bestFitness, 0.0001);
    const raw = ((route?.fitness ?? 0) / denom) * 100;
    return clamp(raw, 20, 100);
  };

  const evacuationProgress = population > 0 ? clamp((evacuated / population) * 100, 0, 100) : 0;
  const arrivalProgress = population > 0 ? clamp((arrivals / population) * 100, 0, 100) : 0;
  const maxFitness = routes.length ? Math.max(...routes.map(r => r.fitness || 0), 1) : 1;

  const statusColor = isActive ? '#34d399' : '#64748b';
  const statusText = mlLoading ? 'OPTIMIZING' : (isActive ? 'OPTIMIZING' : 'IDLE');
  const statusBg = isActive ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)';

  const ResourceRow = ({ label, value, unit, color, hint }) => (
    <div
      title={hint}
      style={{
        flex: '1 1 130px',
        minWidth: '120px',
        background: 'linear-gradient(160deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '12px',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>
        {label}{unit ? ` (${unit})` : ''}
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
        background: 'radial-gradient(600px 110px at 12% 0%, rgba(52,211,153,0.16), transparent 70%)',
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
            color: '#34d399',
            background: 'rgba(52,211,153,0.1)',
            border: '1px solid rgba(52,211,153,0.45)',
            borderRadius: '999px',
            padding: '4px 12px',
            boxShadow: '0 0 18px rgba(52,211,153,0.32)'
          }}>
            🧬 ENGINE 03 | GENETIC OPTIMIZER
          </span>
          <h2 style={{
            margin: '10px 0 0',
            fontSize: 'clamp(18px, 2.4vw, 24px)',
            fontWeight: '800',
            letterSpacing: '0.01em',
            background: 'linear-gradient(90deg, #34d399, #14b8a6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(52,211,153,0.25)'
          }}>
            GA Evacuation &amp; Resource Router
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
            Genetic Algorithm · Route / Throughput Optimization · Constrained by CNN blocked junctions &amp; LSTM flood risk
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
          { label: 'Generation', value: isActive ? `G${generation}` : '—', tone: '#34d399' },
          { label: 'Best Fitness', value: isActive ? bestFitness : '—', tone: '#38bdf8' },
          { label: 'Population', value: isActive ? population.toLocaleString() : '—', tone: '#f59e0b' },
          { label: 'Avg ETA', value: isActive ? `${avgEta} min` : '—', tone: '#a855f7' }
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

      {!isActive ? (
        <div style={{
          position: 'relative',
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
          {/* ================= ROUTE A/B/C COMPARISON CARDS ================= */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <SectionTitle
              icon="🚌"
              title="Evacuation Route Comparison"
              hint="Each chromosome route evolved by the GA, ranked by real fitness and throughput capacity."
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
              {routes.map((route, i) => {
                const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                const pct = pctFor(route);
                return (
                  <div key={route.id} style={{
                    background: 'linear-gradient(160deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
                    border: `1px solid ${color}44`,
                    borderRadius: '12px',
                    padding: '14px',
                    boxShadow: `0 0 18px ${color}22`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color }}>
                        🚌 {route.label}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#94a3b8',
                        border: '1px solid #334155',
                        borderRadius: '999px',
                        padding: '2px 8px'
                      }}>
                        G{generation}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Throughput
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                      {route.throughput.toLocaleString()}
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>ppl/hr</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px', fontSize: '11px', color: '#cbd5e1' }}>
                      <span>⏱ ~{route.costMinutes} min</span>
                      <span>👥 cap {route.capacity.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                      <span style={{ fontSize: '9.5px', color: '#64748b', letterSpacing: '0.05em' }}>FITNESS</span>
                      <div style={{ flex: 1, height: '7px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${color}66, ${color})`,
                          boxShadow: `0 0 10px ${color}99`,
                          borderRadius: '4px',
                          transition: 'width 0.8s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums' }}>
                        {route.fitness}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= POPULATION THROUGHPUT + RESOURCES ================= */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <SectionTitle
                icon="👥"
                title="Population Throughput"
                hint="How many citizens are evacuated versus the full exposed population, and how many reach shelters."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Evacuated</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#34d399' }}>
                  {evacuated.toLocaleString()} / {population.toLocaleString()}
                </span>
              </div>
              <div style={{ height: '9px', background: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${evacuationProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #34d39966, #34d399)',
                  boxShadow: '0 0 12px rgba(52,211,153,0.7)',
                  borderRadius: '6px',
                  transition: 'width 0.8s ease'
                }} />
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px' }}>
                {Math.round(evacuationProgress)}% evacuated · {arrivals.toLocaleString()} reached shelters ({Math.round(arrivalProgress)}%)
              </div>
            </div>

            <div style={{
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <SectionTitle
                icon="🚑"
                title="Resource Deployment"
                hint="Live response units, shelter capacity and average travel time from the GA plan."
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <ResourceRow label="Response Units" value={responseUnits} color="#38bdf8" hint="Emergency units dispatched by the optimizer." />
                <ResourceRow label="Shelters" value={shelters} color="#a855f7" hint="Shelter nodes used as evacuation destinations." />
                <ResourceRow label="Avg ETA" value={`${avgEta}min`} color="#f59e0b" hint="Mean travel time across all active routes." />
              </div>
            </div>
          </div>

          {/* ================= FITNESS EVOLUTION + GENERATION COUNTER ================= */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <SectionTitle
                icon="📈"
                title="Fitness Evolution (Best Routes)"
                hint="Fitness value of every route in the winning generation — the GA keeps climbing until convergence."
              />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '150px', padding: '4px 6px 0' }}>
                {routes.map((route, i) => {
                  const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                  const h = clamp(((route.fitness || 0) / maxFitness) * 100, 6, 100);
                  return (
                    <div key={route.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 'bold', color }}>{route.fitness}</span>
                      <div
                        title={`${route.label} fitness ${route.fitness}`}
                        style={{
                          width: '100%',
                          maxWidth: '54px',
                          height: `${h}%`,
                          background: `linear-gradient(180deg, ${color}, ${color}44)`,
                          boxShadow: `0 0 14px ${color}88`,
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'height 0.8s ease'
                        }}
                      />
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{route.label.replace('Route ', '')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <SectionTitle
                icon="⏱️"
                title="Generation Counter"
                hint="Generation at which the best fitness stopped improving (convergence)."
              />
              <div style={{
                fontSize: 'clamp(38px, 6vw, 54px)',
                fontWeight: '900',
                lineHeight: 1,
                background: 'linear-gradient(90deg, #34d399, #14b8a6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 28px rgba(52,211,153,0.3)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                G{generation}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '8px' }}>
                Converged at generation <b style={{ color: '#34d399' }}>{generation}</b> · best fitness <b style={{ color: '#38bdf8' }}>{bestFitness}</b>
              </div>
            </div>
          </div>

          {/* ================= GA ENGINE PARAMETERS ================= */}
          <div style={{
            position: 'relative',
            fontSize: '11px',
            color: '#94a3b8',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '10px 12px',
            background: '#020617'
          }}>
            ⚙️ <b style={{ color: '#34d399' }}>GA Engine:</b> Chromosome pool {pool || '—'} · selection {selection} · crossover {(crossover * 100).toFixed(0)}% · mutation rate {mutationRate} · elitism on. Best route fitness re-evaluated each generation.
          </div>
        </>
      )}
    </div>
  );
};

export default GAEvacuationRouter;
