import React, { useState } from 'react';
import { GOOGLE_CLIENT_ID, API_BASE_URL } from '../config';
import { useOverlayHistory } from '../utils/historyBack';

function LoginRegister({ onLoginSuccess, onSwitchToRegister, onBackToLanding }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Public Citizen');

  const [showForgot, setShowForgot] = useState(false);
  const [forgotTarget, setForgotTarget] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertAction, setAlertAction] = useState(null);

  const [googleHover, setGoogleHover] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [googlePassword, setGooglePassword] = useState('');
  const [googlePasswordLoading, setGooglePasswordLoading] = useState(false);
  const [googlePasswordError, setGooglePasswordError] = useState('');
  const [pendingGoogle, setPendingGoogle] = useState(null);

  // Mobile Back button closes any open auth dialog (OTP / Google password /
  // access-denied alert) instead of leaving the website.
  const authSubModalOpen = showForgot || showGooglePassword || showAlert;
  useOverlayHistory(authSubModalOpen, () => {
    setShowForgot(false);
    setShowGooglePassword(false);
    setShowAlert(false);
  });

  const handleNameNext = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter your full name first.');
    setStep(2);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return alert('Enter both email and password.');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, selectedRole: role })
      });
      const data = await response.json();

      if (data.success) {
        alert(`Signed in successfully! Welcome back, ${data.fullName || name}`);
        onLoginSuccess({
          role: data.role || role || 'Public Citizen',
          fullName: data.fullName || name,
          email: data.email || email,
          phone: data.phone || '',
          city: data.city || '',
          state: data.state || '',
          address: data.address || '',
          pinCode: data.pinCode || ''
        });
      } else {
        setAlertMsg('Please register and login');
        setAlertAction(() => () => {
          if (onSwitchToRegister) onSwitchToRegister();
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Network error. Please make sure the backend server is running.');
    }
  };

  const getApiBaseUrl = () => {
    // Local dev (react-scripts proxy on :5000) must hit the local backend;
    // otherwise fall back to the runtime-configured API_BASE_URL (Render).
    const runtimeConfig = (typeof window !== 'undefined' && window.__MH_CONFIG__) || {};
    const localHost =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (localHost && !runtimeConfig.API_BASE_URL && !process.env.REACT_APP_API_BASE_URL) {
      return 'http://localhost:5000';
    }
    return API_BASE_URL;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const email = String(forgotTarget || '').trim();
    if (!email) return alert('Enter your registered email address');

    console.log('Sending OTP to:', email);
    console.log('OTP endpoint:', `${getApiBaseUrl()}/api/auth/send-password-otp`);

    if (forgotSending) return; // Prevent duplicate submissions
    setForgotSending(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/send-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: email, type: 'email' }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setOtpSent(true);
        alert(data.message);
      } else {
        alert(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        console.error('Send OTP error: request timed out after 15s');
        alert('OTP request timed out. Please make sure the backend server is running, then try again.');
      } else {
        console.error('Send OTP error:', err);
        alert('Network error. Please make sure the backend server is running.');
      }
    } finally {
      clearTimeout(timeoutId);
      setForgotSending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpInput || !newPassword) return alert('Please enter OTP and New Password');

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/reset-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: forgotTarget, otp: otpInput, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert('Password reset successfully! Please sign in with your new password.');
        setShowForgot(false);
        setOtpSent(false);
        setForgotTarget('');
        setOtpInput('');
        setNewPassword('');
      } else {
        alert(data.message || 'Invalid OTP');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      alert('Network error. Please make sure the backend server is running, then try again.');
    }
  };

  const loadGoogleScript = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load the Google Sign-In library.'));
      document.body.appendChild(script);
    });

  const verifyGoogleAccount = async (accessToken) => {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Google could not verify this account. Please try again.');
    const profileData = await res.json();
    if (!profileData || !profileData.email || profileData.email_verified === false) {
      throw new Error('Your Google email could not be verified. Please try again.');
    }
    return {
      fullName: profileData.name || profileData.email.split('@')[0],
      email: profileData.email.toLowerCase().trim()
    };
  };

  const googleAuthRequest = async (body) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  };

  const syncGoogleProfile = async (accessToken, profile) => {
    const body = { fallbackName: profile.fullName, fallbackEmail: profile.email };
    if (accessToken) body.accessToken = accessToken;
    const { ok, status, data } = await googleAuthRequest(body);
    if (!ok || !data.success) {
      const err = new Error('Please register and login');
      err.accountNotFound = true;
      throw err;
    }
    if (data.token) {
      localStorage.setItem('shm_auth_token', data.token);
    }
    return data;
  };

  const handleGooglePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pendingGoogle) return;
    if (!googlePassword.trim()) return alert('Please enter your account password to complete Google login.');

    setGooglePasswordLoading(true);
    setGooglePasswordError('');
    try {
      const { accessToken, profile } = pendingGoogle;
      const { ok, data } = await googleAuthRequest({
        accessToken,
        email: profile.email,
        password: googlePassword
      });
      if (!ok || !data.success) {
        throw new Error(data.message || 'Password verification failed. Please try again.');
      }
      if (data.token) {
        localStorage.setItem('shm_auth_token', data.token);
      }
      alert(`Signed in successfully via Google! Welcome back, ${data.fullName || profile.fullName}`);
      onLoginSuccess({
        role: data.role || role || 'Public Citizen',
        fullName: data.fullName || profile.fullName,
        email: data.email || profile.email,
        phone: data.phone || '',
        city: data.city || 'Lucknow',
        state: data.state || 'Uttar Pradesh',
        address: data.address || '',
        pinCode: data.pinCode || '',
        authProvider: 'google',
        token: data.token || null
      });
      setShowGooglePassword(false);
      setPendingGoogle(null);
      setGooglePassword('');
    } catch (err) {
      console.warn('Google password verification failed:', err?.message);
      setGooglePasswordError(err?.message || 'Password verification failed. Please try again.');
      setGooglePassword('');
    } finally {
      setGooglePasswordLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleLoading(true);

    const clientId = (GOOGLE_CLIENT_ID || '1095227319145-f8efi0aa283hlu3815faad6c17omjv3e.apps.googleusercontent.com').trim();

    try {
      await loadGoogleScript();

      const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile',
          prompt: 'select_account',
          callback: (resp) => {
            if (resp && resp.error) return reject(new Error(resp.error_description || resp.error));
            resolve(resp);
          },
          error_callback: (err) => reject(new Error(err?.message || 'Google Sign-In was cancelled.'))
        });
        tokenClient.requestAccessToken();
      });

      if (!tokenResponse || !tokenResponse.access_token) {
        throw new Error('Google did not return an access token.');
      }

      const verifiedProfile = await verifyGoogleAccount(tokenResponse.access_token);
      const data = await syncGoogleProfile(tokenResponse.access_token, verifiedProfile);

      if (data.needsPassword) {
        setPendingGoogle({ accessToken: tokenResponse.access_token, profile: verifiedProfile });
        setGooglePassword('');
        setGooglePasswordError('');
        setShowGooglePassword(true);
        return;
      }

      onLoginSuccess({
        role: data.role || role || 'Public Citizen',
        fullName: data.fullName || verifiedProfile.fullName,
        email: data.email || verifiedProfile.email,
        phone: data.phone || '',
        city: data.city || 'Lucknow',
        state: data.state || 'Uttar Pradesh',
        address: data.address || '',
        pinCode: data.pinCode || '',
        authProvider: 'google',
        token: data.token || null
      });
    } catch (err) {
      console.warn('Google sign-in error:', err);
      setAlertMsg('Please register and login');
      setAlertAction(() => () => {
        if (onSwitchToRegister) onSwitchToRegister();
      });
      setShowAlert(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-shell" style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at 10% 10%, rgba(0, 190, 190, .16), transparent 28%),
        radial-gradient(circle at 90% 90%, rgba(60, 90, 220, .18), transparent 30%),
        linear-gradient(135deg, #07111f 0%, #0b1d31 48%, #102744 100%)
      `,
      color: '#f5f8ff',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '2rem 5vw 3rem',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={() => {
              if (onBackToLanding) {
                onBackToLanding();
              } else {
                window.location.reload();
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#8ce7e7',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: '0.2s'
            }}
            title="Back to Home"
          >
            ←
          </button>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', letterSpacing: '2px', color: '#8ce7e7' }}>
            SHM MONITOR <span style={{ color: '#71869f' }}>/</span> SECURE ACCESS
          </div>
        </div>
      </div>

      <div className="auth-main" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '4rem',
        alignItems: 'center',
        maxWidth: '1250px',
        width: '100%',
        margin: '2rem auto'
      }}>
        <div className="auth-hero">
          <span style={{
            display: 'inline-block',
            padding: '.4rem .8rem',
            border: '1px solid rgba(140,231,231,.35)',
            borderRadius: '999px',
            color: '#8ce7e7',
            fontSize: '.78rem',
            fontWeight: '700',
            letterSpacing: '1px',
            background: 'rgba(140,231,231,.07)',
            marginBottom: '1rem'
          }}>
            SMART INDIA HACKATHON 2026
          </span>

          <h1 style={{ fontSize: '2.8rem', lineHeight: '1.1', fontWeight: '800', margin: '0 0 1rem 0' }}>
            Protecting structures.<br />
            <span style={{ color: '#8ce7e7' }}>Saving lives.</span>
          </h1>

          <p style={{ color: '#b9c9dc', fontSize: '1.05rem', lineHeight: '1.7', maxWidth: '650px', marginBottom: '1.5rem' }}>
            A real-time structural health monitoring platform powered by deep learning, sensor intelligence and soft computing.
          </p>

          <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', marginBottom: '1rem' }}>
            <strong style={{ color: '#8ce7e7' }}>🏗️ Structural Intelligence</strong><br />
            <span style={{ fontSize: '.88rem', color: '#a9bad0' }}>Detect abnormal behaviour before it becomes a serious risk.</span>
          </div>

          <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', marginBottom: '1rem' }}>
            <strong style={{ color: '#8ce7e7' }}>⚡ Real-Time Alerts</strong><br />
            <span style={{ fontSize: '.88rem', color: '#a9bad0' }}>Monitor structural conditions and support faster decisions.</span>
          </div>

          <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
            <strong style={{ color: '#8ce7e7' }}>🔐 Role-Based Security</strong><br />
            <span style={{ fontSize: '.88rem', color: '#a9bad0' }}>Give every user access to the tools they actually need.</span>
          </div>
        </div>

        <div className="auth-panel" style={{
          background: 'rgba(255,255,255,.075)',
          border: '1px solid rgba(255,255,255,.13)',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 18px 55px rgba(0,0,0,.25)',
          backdropFilter: 'blur(18px)'
        }}>
          {step === 1 && (
            <form onSubmit={handleNameNext}>
              <h2 style={{ marginTop: 0, fontSize: '1.55rem', color: '#fff' }}>Welcome aboard</h2>
              <p style={{ color: '#a9bad0', fontSize: '.88rem', marginBottom: '1.5rem' }}>
                Let us personalize your secure workspace. Enter your name to continue.
              </p>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', color: '#dce8f7', fontSize: '13px', marginBottom: '6px' }}>Your full name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)',
                    borderRadius: '12px',
                    padding: '.75rem 1rem',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              <button
                type="submit"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  border: 0,
                  padding: '.75rem 1rem',
                  fontWeight: '700',
                  background: 'linear-gradient(90deg, #20c6c6, #4f8cff)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Continue →
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleLoginSubmit}>
              <div className="auth-signin-top" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', color: '#8ce7e7', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  SELECT ACCESS ROLE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['Public Citizen', 'Admin'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        background: role === r ? 'linear-gradient(90deg, #20c6c6, #4f8cff)' : 'rgba(255,255,255,.05)',
                        border: role === r ? 'none' : '1px solid rgba(255,255,255,.16)',
                        color: '#fff',
                        padding: '8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: '0.2s'
                      }}
                    >
                      {r === 'Public Citizen' ? '👤 Citizen' : '🛡️ Admin'}
                    </button>
                  ))}
                </div>
              </div>

              <h2 style={{ marginTop: 0, fontSize: '1.4rem', color: '#fff' }}>Welcome, {name} 👋</h2>
              <p style={{ color: '#a9bad0', fontSize: '.85rem', marginBottom: '1.2rem' }}>
                Sign in to access the SHM Monitor workspace.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#dce8f7', fontSize: '13px', marginBottom: '6px' }}>Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)',
                    borderRadius: '12px',
                    padding: '.75rem 1rem',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '.6rem' }}>
                <label style={{ display: 'block', color: '#dce8f7', fontSize: '13px', marginBottom: '6px' }}>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)',
                    borderRadius: '12px',
                    padding: '.75rem 1rem',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  style={{ background: 'transparent', border: 'none', color: '#8ce7e7', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  border: 0,
                  padding: '.75rem 1rem',
                  fontWeight: '700',
                  background: 'linear-gradient(90deg, #20c6c6, #4f8cff)',
                  color: 'white',
                  cursor: 'pointer',
                  marginBottom: '.8rem'
                }}
              >
                Sign in securely →
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
                <span style={{ fontSize: '11px', color: '#71869f', letterSpacing: '1px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '.8rem' }}>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  onMouseEnter={() => setGoogleHover(true)}
                  onMouseLeave={() => setGoogleHover(false)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    borderRadius: '12px',
                    border: `1px solid ${googleHover ? '#38bdf8' : 'rgba(56,189,248,.45)'}`,
                    background: googleHover ? '#12305c' : '#0f172a',
                    color: '#e2f2ff',
                    padding: '.7rem 1rem',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: googleLoading ? 'progress' : 'pointer',
                    opacity: googleLoading ? 0.85 : 1,
                    boxShadow: googleHover ? '0 0 14px rgba(56,189,248,.28)' : '0 0 8px rgba(56,189,248,.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.5 35.6 26.9 36.5 24 36.5c-5.4 0-9.9-3.1-11.4-8.1l-6.5 5C9.4 40.6 16.1 45 24 45z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.8 4.9l6.5 5.4C41.4 34.8 45 30 45 24c0-1.4-.1-2.7-.4-3.5z"/>
                  </svg>
                  {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
                </button>
                {googleError && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#fecaca', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)' }}>
                    {googleError}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '.8rem', fontSize: '12px', color: '#a9bad0' }}>
                New to SHM Monitor?{' '}
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  style={{ background: 'transparent', border: 'none', color: '#8ce7e7', fontSize: '12px', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
                >
                  Create an account →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#71869f', fontSize: '.78rem', marginTop: '1.5rem' }}>
        Standalone prototype • Authentication and permissions integrated
      </div>

      {showForgot && (
        <div className="auth-modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="auth-modal-card" style={{
            background: '#0b1d31',
            border: '1px solid #20c6c6',
            borderRadius: '16px',
            padding: '24px',
            width: 'min(90%, 420px)',
            maxWidth: '420px',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#8ce7e7', fontSize: '18px' }}>🔐 Reset Password (OTP Verification)</h3>
            
            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a9bad0', marginBottom: '6px' }}>
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={forgotTarget}
                    onChange={(e) => setForgotTarget(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,.08)',
                      border: '1px solid rgba(255,255,255,.16)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSending}
                    style={{ background: 'linear-gradient(90deg, #20c6c6, #4f8cff)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: forgotSending ? 'not-allowed' : 'pointer', opacity: forgotSending ? 0.6 : 1 }}
                  >
                    {forgotSending ? 'Sending…' : 'Send OTP →'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a9bad0', marginBottom: '6px' }}>Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    required
                    maxLength="6"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,.08)',
                      border: '1px solid rgba(255,255,255,.16)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a9bad0', marginBottom: '6px' }}>Create New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,.08)',
                      border: '1px solid rgba(255,255,255,.16)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setShowForgot(false); }}
                    style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ background: 'linear-gradient(90deg, #20c6c6, #4f8cff)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Verify & Reset Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showGooglePassword && (
        <div className="auth-modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="auth-modal-card" style={{
            background: '#0b1d31',
            border: '1px solid #8ce7e7',
            borderRadius: '16px',
            padding: '24px',
            width: 'min(90%, 420px)',
            maxWidth: '420px',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#8ce7e7', fontSize: '18px' }}>🔐 Verify Your Account</h3>
            <p style={{ color: '#a9bad0', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Your Google account <strong style={{ color: '#e2e8f0' }}>{pendingGoogle?.profile?.email || ''}</strong> is already registered.
              Please enter your account password to complete the secure Google login.
            </p>

            <form onSubmit={handleGooglePasswordSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#a9bad0', marginBottom: '6px' }}>Registered Account Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={googlePassword}
                  onChange={(e) => setGooglePassword(e.target.value)}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {googlePasswordError && (
                <div style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fecaca',
                  background: 'rgba(239,68,68,.12)',
                  border: '1px solid rgba(239,68,68,.35)'
                }}>
                  {googlePasswordError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowGooglePassword(false); setPendingGoogle(null); setGooglePassword(''); }}
                  style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={googlePasswordLoading}
                  style={{
                    background: 'linear-gradient(90deg, #20c6c6, #4f8cff)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    cursor: googlePasswordLoading ? 'progress' : 'pointer',
                    fontWeight: 'bold',
                    opacity: googlePasswordLoading ? 0.85 : 1
                  }}
                >
                  {googlePasswordLoading ? 'Verifying…' : 'Verify & Sign In →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAlert && (
        <div className="auth-modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999
        }}>
          <div className="auth-modal-card" style={{
            background: '#0b1d31',
            border: '1px solid #f59e0b',
            borderRadius: '16px',
            padding: '24px',
            width: 'min(90%, 420px)',
            maxWidth: '420px',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '18px' }}>⚠️ Access Denied</h3>
            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.6 }}>
              {alertMsg}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAlert(false);
                  if (alertAction) alertAction();
                  setAlertAction(null);
                }}
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                OK — Go to Register →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginRegister;