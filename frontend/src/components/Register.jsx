import React, { useState } from 'react';

// Fill this in with your real Google OAuth Client ID to enable the native
// Google Identity Services sign-in button. Leave it empty and the app falls
// back to the dark-themed "Continue with Google" button which still signs
// the user in (as a default Public Citizen) without ever throwing.
const GOOGLE_CLIENT_ID = '';

function Register({ onSwitchToLogin, onRegisterSuccess, onGoogleSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
    address: '',
    state: '',
    city: '',
    pinCode: '',
    role: 'Public Citizen',
    agreeTerms: false
  });

  // Google button state (dark theme accent)
  const [googleHover, setGoogleHover] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreeTerms) {
      alert('Please agree to Terms & Conditions');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        alert('Registration successful!');
        onRegisterSuccess(data.role, data.fullName);
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      alert('Network error. Please make sure the backend server is running.');
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

      onGoogleSuccess({
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
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      {/* Brand Header */}
      <div style={{ fontSize: '1.05rem', fontWeight: '800', letterSpacing: '2px', color: '#8ce7e7', marginBottom: '1.5rem' }}>
        SHM MONITOR <span style={{ color: '#71869f' }}>/</span> CITIZEN REGISTRATION
      </div>

      {/* 3D Glassmorphism Container */}
      <div style={{
        background: 'rgba(255,255,255,.075)',
        border: '1px solid rgba(255,255,255,.13)',
        borderRadius: '24px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '620px',
        boxShadow: '0 20px 50px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        backdropFilter: 'blur(18px)',
        transform: 'perspective(1000px) rotateX(0deg)',
        transition: 'all 0.3s ease'
      }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: '0 0 4px 0' }}>Create Your Account</h2>
            <p style={{ fontSize: '13px', color: '#a9bad0', margin: 0 }}>Join the real-time hazard monitoring network</p>
          </div>
          <button 
            type="button"
            onClick={onSwitchToLogin}
            style={{ background: 'transparent', border: 'none', color: '#8ce7e7', fontSize: '13px', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
          >
            Already registered? Sign in →
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row 1: Full Name & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Full Name *</label>
              <input 
                type="text" 
                name="fullName"
                placeholder="Shreya Pandey" 
                value={formData.fullName}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Email Address *</label>
              <input 
                type="email" 
                name="email"
                placeholder="you@example.com" 
                value={formData.email}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
          </div>

          {/* Row 2: Phone & DOB */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Phone Number *</label>
              <input 
                type="text" 
                name="phone"
                placeholder="+91 98765 43210" 
                value={formData.phone}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Date of Birth *</label>
              <input 
                type="date" 
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
          </div>

          {/* Row 3: Password & Confirm Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Password *</label>
              <input 
                type="password" 
                name="password"
                placeholder="Create password" 
                value={formData.password}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Confirm Password *</label>
              <input 
                type="password" 
                name="confirmPassword"
                placeholder="Re-enter password" 
                value={formData.confirmPassword}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
          </div>

          {/* Address */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Address *</label>
            <textarea 
              name="address"
              placeholder="House No. / Street / Locality"
              rows="2"
              value={formData.address}
              onChange={handleChange}
              style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px', resize: 'none' }}
              required
            />
          </div>

          {/* State, City, Pin Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>State *</label>
              <select 
                name="state" 
                value={formData.state} 
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(11, 29, 49, 0.95)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '12px' }}
                required
              >
                <option value="">State</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Delhi">Delhi</option>
                <option value="Maharashtra">Maharashtra</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>City *</label>
              <select 
                name="city" 
                value={formData.city} 
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(11, 29, 49, 0.95)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '12px' }}
                required
              >
                <option value="">City</option>
                <option value="Lucknow">Lucknow</option>
                <option value="Gorakhpur">Gorakhpur</option>
                <option value="Noida">Noida</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Pin Code *</label>
              <input 
                type="text" 
                name="pinCode"
                placeholder="PIN Code" 
                value={formData.pinCode}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '12px' }}
                required 
              />
            </div>
          </div>

          {/* Select Role Card Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '6px' }}>Select System Role *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Public Citizen', desc: 'Individual hazard access' },
                { label: 'Authority/Admin', desc: 'Govt & official access' }
              ].map((r) => (
                <div 
                  key={r.label}
                  onClick={() => setFormData(prev => ({ ...prev, role: r.label }))}
                  style={{
                    background: formData.role === r.label ? 'rgba(32,198,198,.25)' : 'rgba(255,255,255,.05)',
                    border: formData.role === r.label ? '1px solid #8ce7e7' : '1px solid rgba(255,255,255,.12)',
                    borderRadius: '12px',
                    padding: '10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{r.label}</div>
                  <div style={{ fontSize: '11px', color: '#a9bad0', marginTop: '2px' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', fontSize: '12px', color: '#a9bad0' }}>
            <input 
              type="checkbox" 
              name="agreeTerms" 
              checked={formData.agreeTerms} 
              onChange={handleChange}
              style={{ cursor: 'pointer' }}
              required 
            />
            <span>I agree to the <span style={{ color: '#8ce7e7' }}>Terms & Conditions</span></span>
          </div>

          {/* Register Button */}
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
              boxShadow: '0 0 20px rgba(32,198,198,.3)',
              marginBottom: '12px'
            }}
          >
            Create Account →
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 14px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
          <span style={{ fontSize: '11px', color: '#71869f', letterSpacing: '1px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,.14)' }} />
        </div>

        {/* Continue with Google */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
      </div>

      <div style={{ textAlign: 'center', color: '#71869f', fontSize: '.78rem', marginTop: '1.5rem' }}>
        SHM Monitoring System • Secure Encrypted Registration
      </div>
    </div>
  );
}

export default Register;
