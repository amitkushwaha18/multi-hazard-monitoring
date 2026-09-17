import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import HazardSearchPanel from './HazardSearchPanel';
import TimeSeriesChart from './TimeSeriesChart';
import EarthquakeDetailPanel from './EarthquakeDetailPanel';
import AssetHealthPanel from './AssetHealthPanel';
import AlertModal from './AlertModal';
import MultiHazardFusionEngine from './MultiHazardFusionEngine';
import ExplainableAIPanel from './ExplainableAIPanel';
import DigitalTwinViewPanel from './DigitalTwinViewPanel';
import CVDamageDetectionPanel from './CVDamageDetectionPanel';
import AIRiskPredictionPanel from './AIRiskPredictionPanel';
import JarvisAssistant from './JarvisAssistant';
import FloodDetailModal from './FloodDetailModal';
import EarthquakeDetailModal from './EarthquakeDetailModal';
import CycloneDetailModal from './CycloneDetailModal';

const getInitials = (fullName) => {
  return String(fullName || 'Admin')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
};

const AdminOverview = ({ user, onLogout }) => {
  const [seismicEvents, setSeismicEvents] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [externalRequest, setExternalRequest] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pendingSeqRef = useRef(null);

  const profile = user || {};
  const fullName = profile.fullName || 'Administrator';
  const role = profile.role || 'Authority/Admin';
  const avatarText = getInitials(fullName);

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    if (pendingSeqRef.current) {
      setVoiceResult({ seq: pendingSeqRef.current, result: loc });
      pendingSeqRef.current = null;
    }
  };

  const handleDashCommand = (command) => {
    if (!command) return;
    if (command.type === 'ANALYZE_RISK' && command.city) {
      const seq = command.seq || Date.now();
      pendingSeqRef.current = seq;
      setExternalRequest({ city: command.city, seq });
    } else if (command.type === 'OPEN_MODAL' && command.modal) {
      setActiveModal(command.modal);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchSeismic = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/hazards/seismic', { timeout: 5000 });
        if (!cancelled && res?.data?.features) setSeismicEvents(res.data.features);
      } catch (err) {
        console.warn('Backend offline — seismic feed set to 0:', err.message);
        if (!cancelled) setSeismicEvents([]);
      }
    };
    fetchSeismic();
    const id = setInterval(fetchSeismic, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!showProfileMenu) return;
    const close = (e) => {
      if (e.target && e.target.closest && !e.target.closest('[data-profile-menu]')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showProfileMenu]);

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 15% 0%, rgba(220,38,38,.12), transparent 35%), linear-gradient(160deg, #020617 0%, #0b1020 55%, #07101f 100%)', color: '#f8fafc', fontFamily: "'Inter', sans-serif", paddingBottom: '50px', position: 'relative' }}>

      {/* Top Navigation Bar with Profile Menu */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 40px',
        borderBottom: '1px solid #1e293b',
        background: 'rgba(11, 16, 32, 0.85)',
        backdropFilter: 'blur(14px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>🚨 Admin Control Center</span>
          <span style={{
            fontSize: '11px',
            background: '#dc2626',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: 'bold'
          }}>
            Role: {role}
          </span>
        </div>

        <div data-profile-menu style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowProfileMenu(v => !v); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              borderRadius: '999px',
              padding: '6px 14px 6px 6px',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <span style={{
              height: '34px',
              width: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #7c3aed)',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {avatarText}
            </span>
            <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>{fullName}</span>
              <span style={{ display: 'block', fontSize: '11px', color: '#f87171' }}>Authority / Admin</span>
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>{showProfileMenu ? '▲' : '▼'}</span>
          </button>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: '260px',
              background: '#0f1a2e',
              border: '1px solid #334155',
              borderRadius: '14px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.65)',
              overflow: 'hidden',
              zIndex: 2000
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>{fullName}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{profile.email || 'No email'}</div>
                <div style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  background: 'rgba(220, 38, 38, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  borderRadius: '20px',
                  padding: '3px 10px'
                }}>
                  {role}
                </div>
              </div>
              <div style={{ padding: '8px' }}>
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  ⏻ Logout & Return to Sign-In
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <div style={{ padding: '32px 40px' }}>

        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          padding: '20px',
          borderRadius: '14px',
          marginBottom: '24px'
        }}>
          <h2 style={{ color: '#f87171', margin: '0 0 6px 0', fontSize: '20px' }}>🚨 Admin Overview — National Infrastructure Telemetry Command</h2>
          <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>
            Full administrative privileges enabled. Manage structural health indices, live seismic feeds, AI risk prediction and GIS risk buffers.
          </p>
        </div>

        {/* Top stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Live Seismic Events" value={seismicEvents.length} accent="#ef4444" />
          <StatCard label="Active Sessions" value="1" accent="#38bdf8" />
          <StatCard label="System Status" value="● ONLINE" accent="#34d399" />
          <StatCard label="Agency Level" value={role} accent="#a78bfa" small />
        </div>

        {/* Hazard Search Panel */}
        <HazardSearchPanel onLocationSelect={handleLocationSelect} externalRequest={externalRequest} />

        {/* Fusion + AI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <MultiHazardFusionEngine selectedLocation={selectedLocation} />
          <AIRiskPredictionPanel />
        </div>

        {/* Live forecast chart */}
        <TimeSeriesChart
          locationName={selectedLocation?.cityName}
          baseTemp={selectedLocation?.risk?.temperatureC}
          baseRain={selectedLocation?.risk?.precipitationMm}
          telemetry={selectedLocation?.telemetry}
        />

        {/* Telemetry grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginTop: '24px' }}>
          <DigitalTwinViewPanel selectedLocation={selectedLocation} />
          <CVDamageDetectionPanel />
        </div>

        {/* Full width analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          <EarthquakeDetailPanel seismicEvents={seismicEvents} />
          <AssetHealthPanel />
          <ExplainableAIPanel />
          <AlertModal selectedLocation={selectedLocation} />
        </div>
      </div>

      {/* Floating AI Jarvis Assistant Box */}
      <JarvisAssistant onDashCommand={handleDashCommand} voiceResult={voiceResult} />

      {/* Hazard Detail Modals (voice-openable detail views) */}
      <FloodDetailModal isOpen={activeModal === 'flood'} onClose={() => setActiveModal(null)} />
      <EarthquakeDetailModal isOpen={activeModal === 'earthquake'} onClose={() => setActiveModal(null)} />
      <CycloneDetailModal isOpen={activeModal === 'cyclone'} onClose={() => setActiveModal(null)} />
    </div>
  );
};

const StatCard = ({ label, value, accent, small }) => (
  <div style={{
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid #1e293b',
    borderRadius: '14px',
    padding: '18px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: small ? '16px' : '24px', fontWeight: 'bold', color: accent, marginTop: '6px' }}>{value}</div>
  </div>
);

export default AdminOverview;