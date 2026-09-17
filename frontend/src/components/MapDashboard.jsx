import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

// Import sub-components
import HazardSearchPanel from './HazardSearchPanel';
import EarthquakeDetailPanel from './EarthquakeDetailPanel';
import TimeSeriesChart from './TimeSeriesChart';
import AssetHealthPanel from './AssetHealthPanel';
import JarvisAssistant from './JarvisAssistant';
import FloodDetailModal from './FloodDetailModal';
import EarthquakeDetailModal from './EarthquakeDetailModal';
import CycloneDetailModal from './CycloneDetailModal';

const { BaseLayer } = LayersControl;

const redAssetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const createSlowRedIcon = () => {
  return L.divIcon({
    className: 'custom-red-marker',
    html: `<div class="slow-red-beacon"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

const MapFlyTo = ({ targetLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (targetLocation && targetLocation.lat && targetLocation.lng) {
      map.flyTo([targetLocation.lat, targetLocation.lng], 10, { duration: 2 });
    }
  }, [targetLocation, map]);
  return null;
};

const getInitials = (fullName) => {
  return String(fullName || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
};

const MapDashboard = ({ user, onLogout }) => {
  const [seismicEvents, setSeismicEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [externalRequest, setExternalRequest] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const selectedLocationRef = useRef(null);
  const pendingVoiceSeqRef = useRef(null);

  const profile = user || {};
  const fullName = profile.fullName || 'Public Citizen';
  const role = profile.role || 'Public Citizen';
  const avatarText = getInitials(fullName);

  const indiaCenter = [20.5937, 78.9629];

  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  });

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc);
    if (pendingVoiceSeqRef.current) {
      setVoiceResult({ seq: pendingVoiceSeqRef.current, result: loc });
      pendingVoiceSeqRef.current = null;
    }
  };

  const handleDashCommand = (command) => {
    if (!command) return;
    if (command.type === 'ANALYZE_RISK' && command.city) {
      const seq = command.seq || Date.now();
      pendingVoiceSeqRef.current = seq;
      setExternalRequest({ city: command.city, seq });
    } else if (command.type === 'OPEN_MODAL' && command.modal) {
      setActiveModal(command.modal);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [seismicRes, assetRes] = await Promise.all([
          axios.get('http://localhost:5000/api/hazards/seismic', { timeout: 5000 }).catch(() => null),
          axios.get('http://localhost:5000/api/assets', { timeout: 5000 }).catch(() => null)
        ]);

        if (!seismicRes && !assetRes) {
          throw new Error('Backend unreachable');
        }

        let events = [];
        if (seismicRes?.data?.features) {
          events = seismicRes.data.features;
        }

        setSeismicEvents(events);
        if (assetRes?.data && assetRes.data.length > 0) {
          setAssets(assetRes.data);
        } else {
          setAssets([]);
        }

        const loc = selectedLocationRef.current;
        if (loc?.lat && loc?.lng) {
          try {
            const floodRes = await axios.get(
              `http://localhost:5000/api/hazards/flood-analysis?lat=${loc.lat}&lng=${loc.lng}`,
              { timeout: 5000 }
            );
            if (floodRes?.data) {
              setSelectedLocation(prev =>
                prev ? { ...prev, telemetry: floodRes.data } : prev
              );
            }
          } catch (e) {
            console.warn('Telemetry refresh failed, keeping existing data:', e.message);
          }
        }
      } catch (err) {
        console.warn('Backend offline — clearing map overlays to 0:', err.message);
        setSeismicEvents([]);
        setAssets([]);
        setSelectedLocation(null);
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 20000);

    return () => clearInterval(intervalId);
  }, []);

  // Close the profile menu when clicking elsewhere.
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
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif', paddingBottom: '50px', position: 'relative' }}>

      {/* Top Navigation Bar with Profile Menu */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 40px',
        borderBottom: '1px solid #1e293b',
        background: '#0f172a',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>🛡️ MultiHazard AI Dashboard</span>
          <span style={{
            fontSize: '11px',
            background: '#0284c7',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: 'bold'
          }}>
            Role: {role}
          </span>
        </div>

        {/* Profile Menu */}
        <div data-profile-menu style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowProfileMenu(v => !v); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
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
              background: 'linear-gradient(135deg, #20c6c6, #4f8cff)',
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
              <span style={{ display: 'block', fontSize: '11px', color: '#38bdf8' }}>{role}</span>
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>{showProfileMenu ? '▲' : '▼'}</span>
          </button>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: '260px',
              background: '#0f172a',
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
                  background: 'rgba(2, 132, 199, 0.2)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '20px',
                  padding: '3px 10px'
                }}>
                  {role}
                </div>
                {profile.city && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                    📍 {profile.city}{profile.state ? `, ${profile.state}` : ''}
                  </div>
                )}
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

        {/* PUBLIC CITIZEN VIEW ONLY */}
        <div>
          <div style={{
            background: 'rgba(2, 132, 199, 0.1)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ color: '#38bdf8', margin: '0 0 6px 0', fontSize: '20px' }}>📍 Citizen Live Safety & Risk Portal</h2>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>
                  Analyze regional flood and seismic risks, track live earthquake activity, and view safety overlays.
                </p>
              </div>

              {/* Live Profile Summary */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '12px',
                padding: '12px 14px'
              }}>
                <ProfilePill label="Profile" value={fullName} accent="#38bdf8" />
                <ProfilePill label="Role" value={role} accent="#34d399" />
                <ProfilePill label="City" value={profile.city || '—'} accent="#eab308" />
                <ProfilePill label="Email" value={profile.email || '—'} accent="#a78bfa" small />
              </div>
            </div>
          </div>

          {/* Hazard Search Panel */}
          <HazardSearchPanel onLocationSelect={handleLocationSelect} externalRequest={externalRequest} />

          {/* Map Container */}
          <div style={{ height: '70vh', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <MapContainer center={indiaCenter} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <MapFlyTo targetLocation={selectedLocation} />

              <LayersControl position="topright">
                <BaseLayer checked name="Satellite 3D Terrain (Google)">
                  <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" maxZoom={20} />
                </BaseLayer>
              </LayersControl>

              {selectedLocation && selectedLocation.lat && (
                <Circle
                  center={[selectedLocation.lat, selectedLocation.lng]}
                  radius={18000}
                  pathOptions={{
                    color: selectedLocation.risk?.floodRisk?.includes('High') ? '#ef4444' : '#38bdf8',
                    fillColor: selectedLocation.risk?.floodRisk?.includes('High') ? '#ef4444' : '#38bdf8',
                    fillOpacity: 0.45,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div>
                      <h4 style={{ margin: 0, color: '#0284c7' }}>{selectedLocation.cityName}</h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                        Flood Risk: {selectedLocation.risk?.floodRisk || '0'}<br/>
                        Earthquake / Seismic Risk: {selectedLocation.risk?.seismicRisk || selectedLocation.risk?.thermalRisk || '0'}
                      </p>
                    </div>
                  </Popup>
                </Circle>
              )}

              {assets.map((asset) => (
                <Marker key={asset._id} position={[asset.location.lat, asset.location.lng]} icon={redAssetIcon}>
                  <Popup>
                    <div>
                      <h3 style={{ color: '#dc2626', margin: 0 }}>{asset.name}</h3>
                      <p><b>Type:</b> {asset.type}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {seismicEvents.map((event) => {
                const [lng, lat] = event.geometry.coordinates;
                return (
                  <Marker key={event.id} position={[lat, lng]} icon={createSlowRedIcon()}>
                    <Popup>
                      <div>
                        <h4 style={{ color: 'red', margin: 0 }}>Earthquake Warning</h4>
                        <p><b>Magnitude:</b> {event.properties.mag}</p>
                        <p><b>Place:</b> {event.properties.place}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Live Chart Connected to Searched Location */}
          <TimeSeriesChart
            locationName={selectedLocation?.cityName}
            baseTemp={selectedLocation?.risk?.temperatureC}
            baseRain={selectedLocation?.risk?.precipitationMm}
            telemetry={selectedLocation?.telemetry}
          />

          {/* Full Width Earthquake Feed & Asset Health Panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px', marginBottom: '24px' }}>
            <div style={{ width: '100%' }}>
              <EarthquakeDetailPanel seismicEvents={seismicEvents} />
            </div>
            <div style={{ width: '100%' }}>
              <AssetHealthPanel />
            </div>
          </div>
        </div>

      </div>

      {/* Floating AI Jarvis Assistant Box */}
      <JarvisAssistant
        onDashCommand={handleDashCommand}
        voiceResult={voiceResult}
      />

      {/* Hazard Detail Modals (voice-openable) */}
      <FloodDetailModal isOpen={activeModal === 'flood'} onClose={() => setActiveModal(null)} />
      <EarthquakeDetailModal isOpen={activeModal === 'earthquake'} onClose={() => setActiveModal(null)} />
      <CycloneDetailModal isOpen={activeModal === 'cyclone'} onClose={() => setActiveModal(null)} />
    </div>
  );
};

const ProfilePill = ({ label, value, accent, small }) => (
  <div style={{
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${accent}55`,
    borderRadius: '10px',
    padding: '8px 12px',
    textAlign: 'left'
  }}>
    <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: small ? '11px' : '13px', fontWeight: 'bold', color: accent, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
  </div>
);

export default MapDashboard;