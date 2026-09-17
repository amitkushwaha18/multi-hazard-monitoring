import React, { useState } from 'react';
import axios from 'axios';

const AlertModal = ({ selectedLocation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [showInAppToast, setShowInAppToast] = useState(false);

  const cityName = selectedLocation?.cityName || 'Not Selected';
  const rainMm = selectedLocation?.risk?.precipitationMm ?? 0;
  const elevationMeters = selectedLocation?.risk?.elevationMeters ?? 0;
  const isHighRisk = selectedLocation?.risk?.isHighRiskRedZone || false;
  const floodRiskStatus = selectedLocation?.risk?.floodRisk || '0 Risk';

  const playSoftAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playBeep(659.25, now, 0.25);
      playBeep(987.77, now + 0.3, 0.35);
    } catch (e) {
      console.log('Audio Context gesture required', e);
    }
  };

  const triggerBroadcast = async () => {
    setLoading(true);
    playSoftAlertSound();

    try {
      const payload = {
        location: cityName,
        hazardType: isHighRisk ? 'Critical Flood Hazard' : 'Multi-Hazard Risk',
        severity: isHighRisk ? 'Critical' : 'Moderate',
        affectedPeople: 0
      };

      const res = await axios.post('http://localhost:5000/api/alerts/dispatch', payload);
      setDispatchResult(res.data);
      setShowInAppToast(true);

    } catch (err) {
      console.error('Error dispatching alert (backend offline):', err);
      alert('Backend offline. Could not dispatch alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', color: '#fff' }}>
      
      {showInAppToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: isHighRisk ? '#7f1d1d' : '#0f172a',
          border: `2px solid ${isHighRisk ? '#ef4444' : '#38bdf8'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          maxWidth: '380px',
          animation: 'slideInRight 0.4s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '15px' }}>
              🚨 Emergency Warning Broadcasted!
            </h4>
            <button
              onClick={() => setShowInAppToast(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '16px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#f1f5f9' }}>
            <b>Location:</b> {cityName}
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#cbd5e1' }}>
            <b>Flood Risk:</b> <span style={{ color: isHighRisk ? '#fca5a5' : '#34d399' }}>{floodRiskStatus}</span>
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
            Rainfall: {rainMm} mm | Elevation: {elevationMeters}m
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#f59e0b' }}>Alert & Early Warning System Dispatcher</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Multi-channel dispatch: In-app, SMS, Email, WhatsApp, Push, Siren / IoT & CAP Format
          </p>
        </div>
        <button
          onClick={() => { setIsOpen(!isOpen); setDispatchResult(null); setShowInAppToast(false); }}
          style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isOpen ? '← Close Alert Engine' : 'Broadcast Emergency Warning'}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '16px', background: '#020617', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
          
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Broadcasting Target Location</p>
              <h3 style={{ margin: '2px 0 0', fontSize: '16px', color: '#38bdf8' }}>{cityName}</h3>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Live Risk Status</p>
              <p style={{
                margin: '2px 0 0',
                fontSize: '13px',
                fontWeight: 'bold',
                color: isHighRisk ? '#ef4444' : '#10b981'
              }}>
                {floodRiskStatus} ({rainMm} mm rain | Elev: {elevationMeters}m)
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>📱 In-App & Push Notification</div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>💬 SMS & WhatsApp Alerts</div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>📧 Email Mass Dispatcher</div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>🚨 Siren / IoT Trigger Pin</div>
          </div>

          <button
            onClick={triggerBroadcast}
            disabled={loading}
            style={{ padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
          >
            {loading ? 'Transmitting Warnings & Sound...' : `Execute Warning Pipeline for ${cityName}`}
          </button>

          {dispatchResult && (
            <div style={{ marginTop: '16px', background: '#0f172a', border: '1px solid #10b981', borderRadius: '8px', padding: '12px' }}>
              <p style={{ color: '#10b981', fontWeight: 'bold', margin: '0 0 8px 0', fontSize: '13px' }}>
                ✓ {dispatchResult.message}
              </p>
              <h4 style={{ margin: '6px 0', fontSize: '12px', color: '#38bdf8' }}>CAP-Style Standardized Output JSON:</h4>
              <pre style={{ background: '#020617', padding: '10px', borderRadius: '6px', color: '#a7f3d0', fontSize: '11px', overflowX: 'auto' }}>
                {JSON.stringify(dispatchResult.capPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertModal;