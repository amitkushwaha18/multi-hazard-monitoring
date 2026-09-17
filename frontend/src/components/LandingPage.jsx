import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import FloodDetailModal from './FloodDetailModal';
import CycloneDetailModal from './CycloneDetailModal';
import EarthquakeDetailModal from './EarthquakeDetailModal';

const COLORS = {
  bg: '#000000',
  panel: 'rgba(5, 9, 18, 0.92)',
  panelDeep: 'rgba(2, 5, 12, 0.97)',
  border: '#111827',
  borderLight: '#1f2937',
  sky: '#38bdf8',
  skyDeep: '#0284c7',
  danger: '#ef4444',
  dangerBorder: '#7f1d1d',
  warning: '#f59e0b',
  safe: '#10b981',
  text: '#f8fafc',
  textSoft: '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#64748b'
};

const NAV_ITEMS = [
  { name: 'Home', target: 'home' },
  { name: 'About', target: 'about' },
  { name: 'Live Hazards', target: 'hazards-section' },
  { name: 'Features', target: 'features-section' },
  { name: 'Architecture', target: 'architecture-section' },
  { name: 'Emergency', target: 'emergency-section' },
  { name: 'Team', target: 'team-section' }
];

const TEAM_MEMBERS = [
  { name: 'Amit Kushwaha', role: 'Project Lead & Full-Stack Architect', desc: 'Overseeing system architecture, backend integration, and React routing.', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { name: 'Team Member 2', role: 'GIS & Map Integration Specialist', desc: 'Managing Leaflet 3D satellite tiles, seismic overlays, and spatial buffers.', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { name: 'Team Member 3', role: 'AI / ML & LSTM Forecaster', desc: 'Building neural network models for 12h weather and temperature trend forecasting.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
  { name: 'Team Member 4', role: 'Infrastructure Telemetry Engineer', desc: 'Handling structural health indexing for bridges, dams, and public buildings.', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { name: 'Team Member 5', role: 'Backend & API Developer', desc: 'Configuring USGS live feeds, MongoDB schemas, and secure authentication.', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { name: 'Team Member 6', role: 'UI/UX & Safety Portal Designer', desc: 'Designing responsive dark-mode dashboards and citizen safety workflows.', photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80' }
];

const LandingPage = ({ onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);
  const [totalToday, setTotalToday] = useState(0);
  const [liveWeather, setLiveWeather] = useState({ temp: 0, precip: 0, wind: 0 });
  const [isFloodModalOpen, setIsFloodModalOpen] = useState(false);
  const [isCycloneModalOpen, setIsCycloneModalOpen] = useState(false);
  const [isEarthquakeModalOpen, setIsEarthquakeModalOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(78);

  // Keep the spacer below the nav in sync with the nav's real rendered height
  useLayoutEffect(() => {
    const updateNavHeight = () => {
      if (navRef.current) {
        setNavHeight(navRef.current.offsetHeight);
      }
    };
    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    return () => window.removeEventListener('resize', updateNavHeight);
  }, []);

  // Full Screen Rotating Milky Way Galaxy Chakra Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const numParticles = 2200;
    const particles = [];
    const numArms = 4;

    for (let i = 0; i < numParticles; i++) {
      const armIndex = i % numArms;
      const r = Math.pow(Math.random(), 1.5) * (Math.max(width, height) * 0.7);
      const armAngle = armIndex * ((2 * Math.PI) / numArms);
      const spiralSpread = r * 0.005; 
      const theta = armAngle + spiralSpread + (Math.random() - 0.5) * 0.45;

      let starColor = '#ffffff';
      const randColor = Math.random();
      if (r < 120) {
        starColor = randColor > 0.3 ? '#ffffff' : '#fde047';
      } else {
        if (randColor > 0.6) starColor = '#38bdf8';
        else if (randColor > 0.35) starColor = '#ff7700';
        else starColor = '#ffffff';
      }

      particles.push({
        r,
        theta,
        baseAngle: theta,
        size: Math.random() * 3.8 + 1.2,
        color: starColor,
        alpha: Math.random() * 0.55 + 0.45
      });
    }

    let rotationAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      rotationAngle += 0.002;

      // Bright Core Glow
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 220);
      coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      coreGlow.addColorStop(0.3, 'rgba(56, 189, 248, 0.25)');
      coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 220, 0, Math.PI * 2);
      ctx.fill();

      // Render Larger & Brighter Stars
      particles.forEach((p) => {
        const currentAngle = p.baseAngle + rotationAngle;

        const x = centerX + p.r * Math.cos(currentAngle);
        const y = centerY + p.r * Math.sin(currentAngle) * 0.65;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.size > 2.2) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 14;
        }

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Robust Scroll Position Listener for Slow & Smooth Fly-In Animation
  useEffect(() => {
    const handleScrollFly = () => {
      setScrolled(window.scrollY > 12);

      const flyElements = document.querySelectorAll('.scroll-fly-element');
      flyElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        
        if (rect.top <= windowHeight * 0.88 && rect.bottom >= 0) {
          el.classList.add('fly-visible');
        } else {
          el.classList.remove('fly-visible');
        }
      });
    };

    window.addEventListener('scroll', handleScrollFly, { passive: true });
    handleScrollFly();

    return () => window.removeEventListener('scroll', handleScrollFly);
  }, []);

  useEffect(() => {
    const fetchLiveData = async () => {
      let backendOnline = true;

      try {
        const res = await axios.get('http://localhost:5000/api/hazards/seismic', { timeout: 5000 });
        if (res?.data?.features) {
          setTotalToday(res.data.features.length);
        } else {
          setTotalToday(0);
        }
      } catch (err) {
        console.warn('Backend offline — daily earthquake count set to 0:', err.message);
        backendOnline = false;
        setTotalToday(0);
      }

      if (!backendOnline) {
        setLiveWeather({ temp: 0, precip: 0, wind: 0 });
        return;
      }

      try {
        const meteo = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=20.5937&longitude=78.9629&current=temperature_2m,precipitation,wind_speed_10m', { timeout: 5000 });
        if (meteo?.data?.current) {
          setLiveWeather({
            temp: meteo.data.current.temperature_2m,
            precip: meteo.data.current.precipitation,
            wind: meteo.data.current.wind_speed_10m
          });
        } else {
          setLiveWeather({ temp: 0, precip: 0, wind: 0 });
        }
      } catch (err) {
        console.warn('Weather source offline — weather set to 0:', err.message);
        setLiveWeather({ temp: 0, precip: 0, wind: 0 });
      }
    };
    fetchLiveData();
    const intervalId = setInterval(fetchLiveData, 20000);
    return () => clearInterval(intervalId);
  }, []);

  const scrollToSection = (targetId) => {
    if (targetId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      onNavigate('dashboard');
    }
  };

  return (
    <div className="deep-space-bg" style={{ minHeight: '100vh', color: COLORS.text, fontFamily: 'sans-serif', overflowX: 'hidden', position: 'relative', background: '#000000' }}>
      
      {/* Full-Screen Rotating Milky Way Galaxy Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <style>{`
        html, body {
          scroll-behavior: smooth;
          overflow-x: hidden;
          margin: 0;
          padding: 0;
          background: #000000;
        }

        section, header {
          scroll-margin-top: 100px;
        }

        ::-webkit-scrollbar {
          width: 0px;
          height: 0px;
          background: transparent;
        }

        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .deep-space-bg {
          background: #000000;
          position: relative;
          perspective: 1800px;
          width: 100%;
          overflow: hidden;
        }

        .deep-space-bg::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
            radial-gradient(3px 3px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(4px 4px at 70px 100px, #38bdf8, rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 140px 70px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(3.5px 3.5px at 220px 180px, #ef4444, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 280px 280px;
          opacity: 0.75;
          z-index: 0;
          pointer-events: none;
        }

        .scroll-fly-element {
          opacity: 0;
          transform: translateY(120px) translateZ(-160px) rotateX(20deg);
          transition: opacity 1.6s cubic-bezier(0.16, 1, 0.3, 1), transform 1.6s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
        }

        .scroll-fly-element.fly-visible {
          opacity: 1;
          transform: translateY(0) translateZ(0px) rotateX(0deg);
        }

        @keyframes fallMeteor {
          0% { transform: translateY(-180px) translateX(0) rotate(40deg); opacity: 0.95; }
          100% { transform: translateY(120vh) translateX(-50vw) rotate(40deg); opacity: 0.15; }
        }
        .meteor {
          position: fixed;
          width: 7px;
          height: 190px;
          background: linear-gradient(to bottom, rgba(255,255,255,1), rgba(56,189,248,0.8), rgba(2,132,199,0));
          box-shadow: 0 0 25px #38bdf8;
          border-radius: 50%;
          animation: fallMeteor linear infinite;
          z-index: 1;
          pointer-events: none;
        }
        .meteor:nth-child(1) { top: -15%; left: 90%; animation-duration: 6s; animation-delay: 0s; }
        .meteor:nth-child(2) { top: -15%; left: 70%; animation-duration: 7.5s; animation-delay: 2s; }
        .meteor:nth-child(3) { top: -15%; left: 50%; animation-duration: 6.8s; animation-delay: 1s; }
        .meteor:nth-child(4) { top: -15%; left: 30%; animation-duration: 8s; animation-delay: 3s; }
        .meteor:nth-child(5) { top: -15%; left: 10%; animation-duration: 7s; animation-delay: 1.5s; }
        .meteor:nth-child(6) { top: -15%; left: 85%; animation-duration: 6.2s; animation-delay: 4s; }

        @keyframes fallAndRotateStone {
          0% { transform: translateY(-250px) translateX(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(0.95); opacity: 1; }
          50% { transform: translateY(50vh) translateX(-25vw) rotateX(180deg) rotateY(360deg) rotateZ(180deg) scale(1.15); opacity: 0.9; }
          100% { transform: translateY(125vh) translateX(-50vw) rotateX(360deg) rotateY(720deg) rotateZ(360deg) scale(1); opacity: 0.3; }
        }

        .real-stone {
          position: fixed;
          background: radial-gradient(circle at 35% 35%, #94a3b8 0%, #475569 45%, #0f172a 90%);
          border-radius: 35% 65% 50% 50% / 40% 45% 55% 60%;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.85), inset 8px 8px 18px rgba(255,255,255,0.45), 0 0 25px rgba(56, 189, 248, 0.5);
          animation: fallAndRotateStone linear infinite;
          z-index: 1;
          pointer-events: none;
          filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.6));
        }

        .stone-lg-1 { width: 90px; height: 80px; top: -20%; left: 80%; animation-duration: 14s; animation-delay: 0s; }
        .stone-lg-2 { width: 110px; height: 95px; top: -20%; left: 45%; animation-duration: 18s; animation-delay: 5s; }
        .stone-lg-3 { width: 75px; height: 70px; top: -20%; left: 15%; animation-duration: 12s; animation-delay: 2s; }
        .stone-lg-4 { width: 100px; height: 90px; top: -20%; left: 65%; animation-duration: 16s; animation-delay: 8s; }

        @keyframes liveBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.4); }
        }
        @keyframes pulse3D {
          0% { transform: scale(0.95) rotateX(10deg) rotateY(-10deg); box-shadow: 0 10px 30px rgba(56,189,248,0.15); }
          50% { transform: scale(1.02) rotateX(5deg) rotateY(-5deg); box-shadow: 0 20px 40px rgba(239,68,68,0.25); }
          100% { transform: scale(0.95) rotateX(10deg) rotateY(-10deg); box-shadow: 0 10px 30px rgba(56,189,248,0.15); }
        }
        .mhai-nav-link { 
          position: relative; 
          cursor: pointer; 
          transition: all 0.3s ease; 
        }
        .mhai-nav-link:hover { 
          color: #38bdf8 !important; 
          transform: translateY(-2px);
          text-shadow: 0 0 12px rgba(56,189,248,0.8);
        }
        .card-3d {
          transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
          transform: perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px);
          backdrop-filter: blur(14px);
        }
        .card-3d:hover {
          transform: perspective(1200px) translateY(-10px) rotateX(4deg) rotateY(-4deg) translateZ(30px);
          border-color: #38bdf8;
          box-shadow: 0 30px 60px -12px rgba(56, 189, 248, 0.4);
        }
        .btn-3d {
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
        }
        .btn-3d:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.7);
        }
      `}</style>

      <div className="meteor"></div>
      <div className="meteor"></div>
      <div className="meteor"></div>
      <div className="meteor"></div>
      <div className="meteor"></div>
      <div className="meteor"></div>
      
      <div className="real-stone stone-lg-1"></div>
      <div className="real-stone stone-lg-2"></div>
      <div className="real-stone stone-lg-3"></div>
      <div className="real-stone stone-lg-4"></div>

      {/* ---------------- NAVBAR (locked to viewport top, rendered via portal so the parent's 3D perspective can't unstick it) ---------------- */}
      {createPortal(
        <nav ref={navRef} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          boxSizing: 'border-box',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 40px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: scrolled ? 'rgba(0, 0, 0, 0.98)' : 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.95)'
        }}>
          <div onClick={() => scrollToSection('home')} style={{ fontSize: '18px', fontWeight: 'bold', color: COLORS.sky, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textShadow: '0 0 15px rgba(56,189,248,0.6)' }}>
            🛡️ MultiHazard AI
          </div>
          <div style={{ display: 'flex', gap: '28px', fontSize: '14px', color: COLORS.textMuted, fontWeight: 500, flexWrap: 'wrap' }}>
            {NAV_ITEMS.map((item) => (
              <span 
                key={item.name} 
                className="mhai-nav-link" 
                onClick={() => scrollToSection(item.target)}
              >
                {item.name}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate('login')}
              className="btn-3d"
              style={{
                background: 'transparent',
                color: COLORS.sky,
                border: `1px solid ${COLORS.borderLight}`,
                padding: '8px 18px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="btn-3d"
              style={{
                background: COLORS.skyDeep,
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Register
            </button>
          </div>
        </nav>,
        document.body
      )}

      {/* Spacer so hero content sits exactly where it did before, now that the nav is fixed/out of flow */}
      <div style={{ height: `${navHeight}px` }} />

      {/* ---------------- HERO ---------------- */}
      <header id="home" className="scroll-fly-element fly-visible" style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: '48px',
        alignItems: 'center',
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '90px 40px 70px',
        position: 'relative',
        zIndex: 2
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.08)',
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '12px',
            color: COLORS.sky,
            marginBottom: '20px',
            boxShadow: '0 0 20px rgba(56,189,248,0.2)'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS.safe, display: 'inline-block', animation: 'liveBlink 1.4s ease-in-out infinite' }}></span>
            {totalToday} seismic events monitored live globally
          </div>

          <h1 style={{ fontSize: '44px', fontWeight: 800, color: '#fff', marginBottom: '20px', lineHeight: 1.15, textShadow: '0 2px 20px rgba(0,0,0,0.95)' }}>
            Know the Risk. Act Before Disaster.
          </h1>
          <p style={{ fontSize: '15.5px', color: COLORS.textMuted, marginBottom: '32px', lineHeight: 1.7, maxWidth: '46ch' }}>
            An advanced AI-powered multi-hazard monitoring and early warning platform designed to safeguard civil infrastructure, predict environmental extremes, and protect communities in real time.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn-3d"
              style={{
                background: COLORS.skyDeep,
                color: '#fff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Launch Dashboard
            </button>
            <button
              onClick={() => scrollToSection('hazards-section')}
              className="btn-3d"
              style={{
                background: 'transparent',
                color: COLORS.sky,
                border: `1px solid ${COLORS.borderLight}`,
                padding: '14px 28px',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              View Live Hazards
            </button>
          </div>
        </div>

        <div style={{
          position: 'relative',
          background: 'linear-gradient(145deg, rgba(3, 5, 12, 0.98) 0%, rgba(0, 0, 0, 1) 100%)',
          border: '1px solid #38bdf844',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 30px rgba(56, 189, 248, 0.15)',
          height: '380px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: 'pulse3D 6s ease-in-out infinite',
          transformStyle: 'preserve-3d',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: COLORS.sky, letterSpacing: '1px', fontWeight: 'bold' }}>
            <span>  SEISMIC DETECTOR</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 10px', borderRadius: '12px', border: '1px solid #059669' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.safe, animation: 'liveBlink 1s infinite' }}></span>
              LIVE SENSORS ACTIVE
            </span>
          </div>

          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '20px 0',
            perspective: '800px'
          }}>
            <div style={{
              position: 'absolute',
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              border: '2px dashed rgba(56, 189, 248, 0.35)',
              animation: 'liveBlink 3s infinite linear'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              border: '2px solid rgba(239, 68, 68, 0.45)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.35)'
            }}></div>
            <div style={{
              position: 'absolute',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ef4444 0%, #7f1d1d 100%)',
              boxShadow: '0 0 30px #ef4444',
              animation: 'liveBlink 1s infinite'
            }}></div>

            <div style={{ position: 'absolute', bottom: '5px', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '40px' }}>
              {[40, 70, 20, 90, 50, 100, 60, 30, 80, 45, 85, 35].map((h, i) => (
                <div key={i} style={{
                  width: '6px',
                  height: `${h}%`,
                  background: h > 75 ? '#ef4444' : '#38bdf8',
                  borderRadius: '3px',
                  boxShadow: '0 0 8px currentColor',
                  opacity: 0.8
                }}></div>
              ))}
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.98)',
            border: `1px solid ${COLORS.dangerBorder}`,
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px'
          }}>
            <span style={{ color: COLORS.textMuted }}>Magnitude Frequency Waveform</span>
            <span style={{ color: COLORS.danger, fontWeight: 'bold' }}>M 5.4 (Peak Alert Active)</span>
          </div>
        </div>
      </header>

      {/* ---------------- STAT STRIP ---------------- */}
      <section className="scroll-fly-element" style={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(2, 4, 10, 0.95)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 2 }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '30px 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px'
        }}>
          <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.95)', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: COLORS.danger }}>{totalToday}</div>
            <div style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '4px' }}>earthquakes tracked today (live USGS)</div>
          </div>
          <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.95)', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: COLORS.sky }}>3</div>
            <div style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '4px' }}>critical structures (Dams & Bridges) monitored</div>
          </div>
          <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.95)', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: COLORS.warning }}>12h</div>
            <div style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '4px' }}>LSTM neural forecasting horizon</div>
          </div>
          <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.95)', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: COLORS.safe }}>Dual-Role</div>
            <div style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '4px' }}>Admin telemetry & Citizen safety portals</div>
          </div>
        </div>
      </section>

      {/* ---------------- ABOUT SECTION ---------------- */}
      <section id="about" className="scroll-fly-element" style={{ maxWidth: '1180px', margin: '0 auto', padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div className="card-3d" style={{
          background: 'rgba(3, 6, 14, 0.95)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '24px',
          padding: '50px 60px',
          boxShadow: '0 25px 70px rgba(0,0,0,0.95)'
        }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '20px', borderBottom: `2px solid ${COLORS.sky}`, paddingBottom: '12px' }}>
            About MultiHazard AI & Core Hazard Pillars
          </h2>
          
          <p style={{ color: COLORS.textSoft, fontSize: '16px', lineHeight: 1.8, marginBottom: '24px' }}>
            <strong>MultiHazard AI</strong> is a next-generation civil infrastructure resilience and disaster mitigation platform. In an era marked by escalating climate anomalies and unpredictable seismic movements, traditional disaster management systems often suffer from delayed reporting, fragmented data sources, and a lack of proactive forecasting. Our platform bridges this critical gap by fusing real-time satellite telemetry, global seismic feeds, and deep-learning predictive models into a single unified command center.
          </p>

          <h3 style={{ fontSize: '20px', color: COLORS.sky, marginBottom: '14px', marginTop: '30px' }}>
            The Three Critical Hazard Pillars Monitored:
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            
            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <h4 style={{ color: COLORS.sky, margin: '0 0 8px 0', fontSize: '16px' }}>🌊 1. Flood & Hydrological Risk</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                Continuous evaluation of riverine, coastal, and flash flood probabilities using Open-Meteo precipitation feeds, catchment basin tracking, and HAND elevation models to issue early red-zone alerts.
              </p>
            </div>

            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <h4 style={{ color: COLORS.warning, margin: '0 0 8px 0', fontSize: '16px' }}>⚡ 2. Earthquake & Seismic Risk</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                Real-time monitoring of global tectonic shifts and seismic magnitudes via direct USGS feeds, evaluating peak ground acceleration and structural vulnerability indices.
              </p>
            </div>

            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <h4 style={{ color: COLORS.danger, margin: '0 0 8px 0', fontSize: '16px' }}>🌀 3. Cyclone & High Wind Risk</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                Advanced telemetry tracking of sustained wind velocities, cyclonic rotation vectors, and storm surge warnings to protect high-rise structures, bridges, and coastal communities.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ---------------- LIVE HAZARD PILLARS (CLICKABLE FLOOD, EARTHQUAKE & CYCLONE CARDS) ---------------- */}
      <section id="hazards-section" className="scroll-fly-element" style={{ background: 'rgba(2, 4, 10, 0.92)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              Live Climate & Multi-Hazard Risk Pillars
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '15px', maxWidth: '650px', margin: '0 auto' }}>
              Continuous monitoring and real-time telemetry tracking across major environmental hazards. Click on Flood, Earthquake, or Cyclone Risk for detailed analysis.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' }}>
            
            {/* FLOOD RISK (CLICKABLE) */}
            <div 
              className="card-3d" 
              onClick={() => setIsFloodModalOpen(true)}
              style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '20px', padding: '30px', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(56, 189, 248, 0.15)', color: COLORS.sky, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>Click for Analysis ↗</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '32px' }}>🌊</span>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: COLORS.sky, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                  Live Rain: {liveWeather.precip} mm
                </span>
              </div>
              <h3 style={{ color: COLORS.sky, fontSize: '22px', marginBottom: '12px' }}>Flood & Hydrological Risk</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
                Evaluates riverine, coastal, and flash flood probabilities using Open-Meteo precipitation metrics and HAND elevation analysis.
              </p>
              <ul style={{ color: COLORS.textSoft, fontSize: '13px', lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
                <li>Real-time precipitation accumulation tracking.</li>
                <li>GIS buffer zone and catchment basin monitoring.</li>
                <li>Automated high-risk red zone alerts for vulnerable sectors.</li>
              </ul>
            </div>

            {/* EARTHQUAKE RISK (CLICKABLE - REPLACED THERMAL) */}
            <div 
              className="card-3d" 
              onClick={() => setIsEarthquakeModalOpen(true)}
              style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '20px', padding: '30px', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(245, 158, 11, 0.15)', color: COLORS.warning, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>Click for Analysis ↗</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '32px' }}>⚡</span>
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: COLORS.warning, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                  USGS Feed Active
                </span>
              </div>
              <h3 style={{ color: COLORS.warning, fontSize: '22px', marginBottom: '12px' }}>Earthquake & Seismic Risk</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
                Tracks live global USGS seismic feeds, magnitude frequencies, and tectonic fault line activity with real-time GPS telemetry analysis.
              </p>
              <ul style={{ color: COLORS.textSoft, fontSize: '13px', lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
                <li>Live global magnitude and frequency waveform logging.</li>
                <li>Automated composite risk score evaluation.</li>
                <li>Immediate tectonic anomaly and peak alert flagging.</li>
              </ul>
            </div>

            {/* CYCLONE RISK (CLICKABLE) */}
            <div 
              className="card-3d" 
              onClick={() => setIsCycloneModalOpen(true)}
              style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '20px', padding: '30px', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(239, 68, 68, 0.15)', color: COLORS.danger, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>Click for Analysis ↗</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '32px' }}>🌀</span>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: COLORS.danger, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                  Live Wind: {liveWeather.wind} km/h
                </span>
              </div>
              <h3 style={{ color: COLORS.danger, fontSize: '22px', marginBottom: '12px' }}>Cyclone & High Wind Risk</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
                Tracks wind velocity anomalies, storm surges, and cyclonic rotation patterns to issue severe wind warnings.
              </p>
              <ul style={{ color: COLORS.textSoft, fontSize: '13px', lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
                <li>Sustained wind speed telemetry tracking.</li>
                <li>Severe cyclone and gale-force wind alerts.</li>
                <li>Structural wind vulnerability assessments for bridges and towers.</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ---------------- FEATURES SECTION ---------------- */}
      <section id="features-section" className="scroll-fly-element" style={{ maxWidth: '1180px', margin: '0 auto', padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
            Comprehensive System Features
          </h2>
          <p style={{ color: COLORS.textMuted, fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
            Engineered with cutting-edge 3D UI principles, real-time telemetry pipelines, and predictive AI models.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {[
            { title: '🌪️ Multi-Hazard Risk Analyzer', desc: 'Search any city worldwide. Instantly computes Flood risk, Seismic earthquake anomalies, and Cyclone high-wind warnings using live meteorology.', color: COLORS.sky },
            { title: '⚡ Live USGS Seismic Stream', desc: 'Direct global earthquake stream integration featuring slow-red blinking beacon markers and real-time magnitude sorting.', color: COLORS.danger },
            { title: '🏗️ Infrastructure Structural Health', desc: 'Continuous telemetry monitoring for critical assets including Dams, Bridges, and Buildings, tracking vibration, tilt, and crack width.', color: COLORS.safe },
            { title: '📈 LSTM Neural Forecaster', desc: 'Advanced time-series forecasting charts project temperature and rainfall trends 12 hours ahead, flagging emerging hazards proactively.', color: COLORS.warning },
            { title: '🗺️ 3D Satellite Command Map', desc: 'Powered by Leaflet and Google Satellite terrain tiles. Dynamically generates GIS risk buffer circles and centers smoothly onto searched locations.', color: COLORS.sky },
            { title: '🚨 Automated Early Warnings', desc: 'Threshold breaches trigger instant popup modal alerts with automated dispatcher logs simulating SMS & Email alerts to response teams.', color: COLORS.danger }
          ].map((f, i) => (
            <div key={i} className="card-3d" style={{
              background: 'rgba(3, 6, 14, 0.95)',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '16px',
              padding: '26px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
            }}>
              <h3 style={{ color: f.color, fontSize: '18px', marginBottom: '10px' }}>{f.title}</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- ARCHITECTURE SECTION (NEWLY DETAILED) ---------------- */}
      <section id="architecture-section" className="scroll-fly-element" style={{ background: 'rgba(2, 4, 10, 0.92)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              System Architecture & Data Pipelines
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '15px', maxWidth: '650px', margin: '0 auto' }}>
              An end-to-end telemetry pipeline connecting global live IoT feeds, predictive neural models, and instant citizen dispatchers.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '20px', padding: '30px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛰️</div>
              <h3 style={{ color: COLORS.sky, fontSize: '20px', marginBottom: '10px' }}>1. Real-Time Telemetry Data Layer</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6 }}>
                Ingests live USGS GeoJSON seismic feeds and Open-Meteo meteorological endpoints every 30 seconds via asynchronous WebSocket streams.
              </p>
            </div>

            <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '20px', padding: '30px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧠</div>
              <h3 style={{ color: COLORS.warning, fontSize: '20px', marginBottom: '10px' }}>2. AI / LSTM Neural Forecaster</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6 }}>
                Processes sequential time-series weather metrics to project 12-hour rainfall, temperature, and cyclonic wind shear anomalies.
              </p>
            </div>

            <div className="card-3d" style={{ background: 'rgba(1, 3, 8, 0.98)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '20px', padding: '30px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌐</div>
              <h3 style={{ color: COLORS.danger, fontSize: '20px', marginBottom: '10px' }}>3. 3D GIS & Command Map Engine</h3>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6 }}>
                Renders Leaflet high-resolution satellite tiles with dynamic radial risk buffers, fault overlays, and structural health telemetry markers.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ---------------- EMERGENCY SECTION (NEWLY DETAILED) ---------------- */}
      <section id="emergency-section" className="scroll-fly-element" style={{ maxWidth: '1180px', margin: '0 auto', padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div className="card-3d" style={{
          background: 'rgba(3, 6, 14, 0.95)',
          border: `1px solid ${COLORS.dangerBorder}`,
          borderRadius: '24px',
          padding: '50px 60px',
          boxShadow: '0 25px 70px rgba(239, 68, 68, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <span style={{ fontSize: '36px' }}>🚨</span>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: COLORS.danger, margin: 0 }}>
              Emergency Response & Immediate Action Center
            </h2>
          </div>
          
          <p style={{ color: COLORS.textSoft, fontSize: '16px', lineHeight: 1.8, marginBottom: '30px' }}>
            In case of critical seismic events, severe flood surges, or cyclonic wind warnings, our platform automatically triggers automated dispatch logs, citizen evacuation protocols, and emergency service notifications.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
              <h4 style={{ color: COLORS.danger, margin: '0 0 10px 0', fontSize: '18px' }}>📞 24/7 Disaster Helpline</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px 0' }}>Direct connection to national disaster management authorities and emergency dispatchers.</p>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>Toll-Free: 108 / 112</div>
            </div>

            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
              <h4 style={{ color: COLORS.sky, margin: '0 0 10px 0', fontSize: '18px' }}>🏃 Safe Evacuation Routes</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px 0' }}>Real-time GPS routing to high-ground shelters away from coastal & riverine red zones.</p>
              <button 
                onClick={() => onNavigate('dashboard')} 
                style={{ background: COLORS.skyDeep, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                View Shelter Map ↗
              </button>
            </div>

            <div style={{ background: 'rgba(1, 3, 8, 0.9)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
              <h4 style={{ color: COLORS.warning, margin: '0 0 10px 0', fontSize: '18px' }}>⚡ Automated SOS Dispatcher</h4>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', lineHeight: 1.6, margin: '0 0 12px 0' }}>Broadcasts real-time SMS & Email alerts to nearby emergency response units upon threshold breach.</p>
              <div style={{ color: COLORS.safe, fontWeight: 'bold', fontSize: '13px' }}>● Dispatch System Active</div>
            </div>

          </div>
        </div>
      </section>

      {/* ---------------- TEAM SECTION ---------------- */}
      <section id="team-section" className="scroll-fly-element" style={{ background: 'rgba(2, 4, 10, 0.92)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${COLORS.border}`, padding: '100px 40px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              Meet Our Development Team
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              The brilliant minds behind MultiHazard AI engineering, data pipelines, and interface design.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {TEAM_MEMBERS.map((member, idx) => (
              <div key={idx} className="card-3d" style={{
                background: 'rgba(1, 3, 8, 0.98)',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.7)'
              }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 16px',
                  border: `2px solid ${COLORS.sky}`,
                  boxShadow: '0 0 15px rgba(56,189,248,0.25)'
                }}>
                  <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>{member.name}</h3>
                <p style={{ fontSize: '13px', color: COLORS.sky, fontWeight: 600, marginBottom: '12px' }}>{member.role}</p>
                <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>{member.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="scroll-fly-element" style={{ borderTop: `1px solid ${COLORS.border}`, background: 'rgba(0, 0, 0, 0.98)', padding: '40px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <span style={{ color: COLORS.sky, fontWeight: 'bold' }}>🛡️ MultiHazard AI Platform</span>
          <span style={{ fontSize: '12px', color: COLORS.textFaint }}>© 2026 MultiHazard AI · Built for Hackathon Excellence.</span>
        </div>
      </footer>

      {/* Modal Components */}
      <FloodDetailModal 
        isOpen={isFloodModalOpen} 
        onClose={() => setIsFloodModalOpen(false)} 
        selectedCity="Lucknow" 
        coordinates={{ lat: 26.8467, lng: 80.9462 }} 
      />
      <EarthquakeDetailModal 
        isOpen={isEarthquakeModalOpen} 
        onClose={() => setIsEarthquakeModalOpen(false)} 
      />
      <CycloneDetailModal 
        isOpen={isCycloneModalOpen} 
        onClose={() => setIsCycloneModalOpen(false)} 
      />
    </div>
  );
};

export default LandingPage;