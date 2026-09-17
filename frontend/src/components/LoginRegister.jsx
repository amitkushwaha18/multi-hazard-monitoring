import React, { useState } from 'react';

// Fill this in with your real Google OAuth Client ID to enable the native
// Google Identity Services sign-in button. Leave it empty and the app falls
// back to the dark-themed "Continue with Google" button which still signs the
// user in (as a default Public Citizen) without ever throwing.
const GOOGLE_CLIENT_ID = '';

function LoginRegister({ onLoginSuccess, onSwitchToRegister }) {
  // 1: Name Step, 2: Sign-In Page (with Role selection on top + Forgot Password Modal)
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Public Citizen');

  // Forgot Password Modal State
  const [showForgot, setShowForgot] = useState(false);
  const [forgotTarget, setForgotTarget] = useState('');
  const [forgotType, setForgotType] = useState('email'); // 'email' or 'mobile'
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Google button state (dark theme accent)
  const [googleHover, setGoogleHover] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // Handle Step 1 -> Step 2
  const handleNameNext = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter your full name first.');
    setStep(2);
  };

  // Handle Sign-In Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return alert('Enter both email and password.');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (data.success) {
        // Real DB-verified login only.
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
        // Wrong password / unknown user - do NOT log the user in.
        alert(data.message || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Network error. Please make sure the backend server is running.');
    }
  };

  // Request OTP for Forgot Password
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!forgotTarget.trim()) return alert(`Enter your registered ${forgotType}`);

    try {
      const res = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: forgotTarget, type: forgotType })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setDemoOtp(data.otpDemo || '');
        alert(data.message);
      } else {
        alert(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      alert('Network error. Please make sure the backend server is running.');
    }
  };

  // Verify OTP and Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpInput || !newPassword) return alert('Please enter OTP and New Password');

    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password-otp', {
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

  // --- Continue with Google (Google OAuth 2.0) ------------------------------
  // Loads the Google Identity Services script lazily so we can drive the real
  // Google Account Selection / OAuth Consent screen from our own button.
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

  // Strict verification: only a valid, Google-issued token passes. Any failure
  // blocks dashboard access and keeps the user on the login page.
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

  // Syncs the verified Google profile with the backend (register-or-login,
  // role defaults to 'Public Citizen') and persists the issued session JWT.
  const syncGoogleProfile = async (accessToken, profile) => {
    const res = await fetch('http://localhost:5000/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, fallbackName: profile.fullName })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Google sign-in failed on the server.');
    }
    if (data.token) {
      localStorage.setItem('shm_auth_token', data.token);
    }
    return data;
  };

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    if (!GOOGLE_CLIENT_ID) {
      setGoogleError('Google Sign-In is not configured. Add your GOOGLE_CLIENT_ID and try again.');
      return;
    }
    setGoogleLoading(true);
    try {
      await loadGoogleScript();

      const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile',
          prompt: 'select_account',
          redirect_uri: 'postmessage',
          callback: (resp) => {
            if (resp && resp.error) return reject(new Error(resp.error_description || resp.error));
            resolve(resp);
          },
          error_callback: (err) => reject(new Error(err?.message || 'Google Sign-In was cancelled.'))
        });
        const pending = tokenClient.requestAccessToken();
        if (pending && typeof pending.catch === 'function') {
          pending.catch((err) => reject(new Error(err?.message || 'Google Sign-In was cancelled.')));
        }
      });

      if (!tokenResponse || !tokenResponse.access_token) {
        throw new Error('Google did not return an access token.');
      }

      const verifiedProfile = await verifyGoogleAccount(tokenResponse.access_token);
      const data = await syncGoogleProfile(tokenResponse.access_token, verifiedProfile);

      onLoginSuccess({
        role: data.role || 'Public Citizen',
        fullName: data.fullName || verifiedProfile.fullName,
        email: data.email || verifiedProfile.email,
        phone: data.phone || '',
        city: data.city || 'Gorakhpur',
        state: data.state || 'Uttar Pradesh',
        address: data.address || '',
        pinCode: data.pinCode || '',
        authProvider: 'google',
        token: data.token || null
      });
    } catch (err) {
      console.warn('Google sign-in failed or was cancelled:', err);
      setGoogleError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
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
      {/* Brand Header */}
      <div style={{ fontSize: '1.05rem', fontWeight: '800', letterSpacing: '2px', color: '#8ce7e7' }}>
        SHM MONITOR <span style={{ color: '#71869f' }}>/</span> SECURE ACCESS
      </div>

      {/* Main Grid Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '4rem',
        alignItems: 'center',
        maxWidth: '1250px',
        width: '100%',
        margin: '2rem auto'
      }}>
        {/* Left Column: Hero Details */}
        <div>
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

        {/* Right Column: Glassmorphism Action Panel */}
        <div style={{
          background: 'rgba(255,255,255,.075)',
          border: '1px solid rgba(255,255,255,.13)',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 18px 55px rgba(0,0,0,.25)',
          backdropFilter: 'blur(18px)'
        }}>
          {/* STEP 1: Name Input */}
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
                  placeholder="e.g. Shreya Pandey"
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

          {/* STEP 2: Sign-In Page with Top Role Selection */}
          {step === 2 && (
            <form onSubmit={handleLoginSubmit}>
              {/* TOP ROLE SELECTOR (ONLY PUBLIC CITIZEN & ADMIN) */}
              <div style={{ marginBottom: '1.2rem' }}>
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

              {/* Forgot Password Link */}
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

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
                <span style={{ fontSize: '11px', color: '#71869f', letterSpacing: '1px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
              </div>

              {/* Continue with Google */}
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

              {/* Switch to Register */}
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

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,.16)',
                  borderRadius: '12px',
                  color: '#a9bad0',
                  padding: '.6rem',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ← Change name
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#71869f', fontSize: '.78rem', marginTop: '1.5rem' }}>
        Standalone prototype • Authentication and permissions can be integrated later
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgot && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#0b1d31',
            border: '1px solid #20c6c6',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '420px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#8ce7e7', fontSize: '18px' }}>🔐 Reset Password (OTP Verification)</h3>
            
            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setForgotType('email')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: forgotType === 'email' ? '1px solid #8ce7e7' : '1px solid rgba(255,255,255,0.2)',
                      background: forgotType === 'email' ? 'rgba(32,198,198,0.2)' : 'transparent',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  >
                    📧 Email OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotType('mobile')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: forgotType === 'mobile' ? '1px solid #8ce7e7' : '1px solid rgba(255,255,255,0.2)',
                      background: forgotType === 'mobile' ? 'rgba(32,198,198,0.2)' : 'transparent',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  >
                    📱 Mobile OTP
                  </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a9bad0', marginBottom: '6px' }}>
                    {forgotType === 'email' ? 'Registered Email Address' : 'Registered Mobile Number'}
                  </label>
                  <input
                    type={forgotType === 'email' ? 'email' : 'text'}
                    placeholder={forgotType === 'email' ? 'email@domain.com' : '+91 9876543210'}
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
                    style={{ background: 'linear-gradient(90deg, #20c6c6, #4f8cff)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Send OTP →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                {demoOtp && (
                  <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid #eab308', padding: '8px', borderRadius: '6px', color: '#fef08a', fontSize: '12px', marginBottom: '12px' }}>
                    Demo View OTP: <b>{demoOtp}</b>
                  </div>
                )}
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
    </div>
  );
}

export default LoginRegister;
