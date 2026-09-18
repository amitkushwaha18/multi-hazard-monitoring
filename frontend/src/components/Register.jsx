import React, { useState } from 'react';
import { GOOGLE_CLIENT_ID, API_BASE_URL } from '../config';

// Dynamic India States and Cities mapping dictionary
const INDIA_STATES_AND_CITIES = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Anantapur", "Kakinada", "Eluru"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Tezu", "Bomdila"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Jagdalpur", "Ambikapur"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Panchkula"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Bilaspur", "Kullu", "Hamirpur", "Chamba"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh", "Deoghar", "Giridih"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Ballari", "Davangere", "Shivamogga"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Palakkad", "Alappuzha", "Kannur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Solapur", "Amravati", "Navi Mumbai"],
  "Manipur": ["Imphal", "Thoubal", "Bishnupur", "Churachandpur"],
  "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongpoh"],
  "Mizoram": ["Aizawl", "Lunglei", "Saiha", "Champhai"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot", "Hoshiarpur"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar"],
  "Sikkim": ["Gangtok", "Namchi", "Geyzing", "Mangan"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Tirunelveli"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Khammam", "Mahbubnagar"],
  "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Kailasahar"],
  "Uttar Pradesh": ["Lucknow", "Gorakhpur", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Noida", "Ghaziabad", "Meerut", "Bareilly", "Aligarh", "Mathura", "Ayodhya"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudraprayag", "Rishikesh", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman", "Kharagpur", "Malda"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", "Central Delhi"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur"],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Puducherry", "Karaikal", "Mahe", "Yanam"]
};

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
    
    // If state changes, reset selected city dynamically
    if (name === 'state') {
      setFormData(prev => ({
        ...prev,
        state: value,
        city: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
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
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        alert(formData.role === 'Authority/Admin' ? 'Admin Registration request successful!' : 'Registration successful!');
        onRegisterSuccess(data.role, data.fullName);
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      alert('Network error. Please make sure the backend server is running.');
    }
  };

  // --- Continue with Google (Google OAuth 2.0) - PUBLIC ONLY ----------------
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

  const syncGoogleProfile = async (accessToken, profile) => {
    const body = { fallbackName: profile.fullName };
    if (accessToken) body.accessToken = accessToken;
    const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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
    setGoogleLoading(true);

    const clientId = (GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      try {
        const data = await syncGoogleProfile(null, { fullName: formData.fullName || 'Google User' });
        onGoogleSuccess({
          role: data.role || 'Public Citizen',
          fullName: data.fullName || formData.fullName || 'Google User',
          email: data.email || '',
          phone: data.phone || '',
          city: data.city || 'Gorakhpur',
          state: data.state || 'Uttar Pradesh',
          address: data.address || '',
          pinCode: data.pinCode || '',
          authProvider: 'google',
          token: data.token || null
        });
      } catch (err) {
        console.warn('Google guest sign-in failed:', err);
        setGoogleError(err?.message || 'Google sign-in failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    try {
      await loadGoogleScript();

      const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
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

  const availableCities = formData.state ? (INDIA_STATES_AND_CITIES[formData.state] || []) : [];
  const isAdminMode = formData.role === 'Authority/Admin';

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
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      {/* Brand Header */}
      <div style={{ fontSize: '1.05rem', fontWeight: '800', letterSpacing: '2px', color: '#8ce7e7', marginBottom: '1.5rem' }}>
        SHM MONITOR <span style={{ color: '#71869f' }}>/</span> {isAdminMode ? 'ADMIN REGISTRATION PORTAL' : 'CITIZEN REGISTRATION'}
      </div>

      {/* 3D Glassmorphism Container */}
      <div className="auth-panel" style={{
        background: isAdminMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255,255,255,.075)',
        border: isAdminMode ? '1px solid rgba(140, 231, 231, 0.4)' : '1px solid rgba(255,255,255,.13)',
        borderRadius: '24px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '620px',
        boxShadow: isAdminMode ? '0 20px 50px rgba(0,190,190,.15)' : '0 20px 50px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        backdropFilter: 'blur(18px)',
        transition: 'all 0.3s ease'
      }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: '0 0 4px 0' }}>
              {isAdminMode ? '🛡️ Admin Registration' : 'Create Your Account'}
            </h2>
            <p style={{ fontSize: '13px', color: '#a9bad0', margin: 0 }}>
              {isAdminMode ? 'Restricted official authority access window' : 'Join the real-time hazard monitoring network'}
            </p>
          </div>
          <button 
            type="button"
            onClick={onSwitchToLogin}
            style={{ background: 'transparent', border: 'none', color: '#8ce7e7', fontSize: '13px', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
          >
            Already registered? Sign in →
          </button>
        </div>

        {/* SELECT ROLE CARD SELECTOR - SHIFTED TO TOP */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#8ce7e7', fontWeight: 'bold', marginBottom: '6px' }}>SELECT SYSTEM ROLE *</label>
          <div className="reg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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

        <form onSubmit={handleSubmit}>
          {/* Row 1: Full Name & Email */}
          <div className="reg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Full Name *</label>
              <input 
                type="text" 
                name="fullName"
                placeholder="Enter your name" 
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
                placeholder={isAdminMode ? 'official.admin@gov.in' : 'you@example.com'} 
                value={formData.email}
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '13px' }}
                required 
              />
            </div>
          </div>

          {/* Row 2: Phone & DOB */}
          <div className="reg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>Phone Number *</label>
              <input 
                type="text" 
                name="phone"
                placeholder="enter your mobile no." 
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
          <div className="reg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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

          {/* State, City, Pin Code (Dynamic Indian States & Cities Dropdown) */}
          <div className="reg-statelist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>State *</label>
              <select 
                name="state" 
                value={formData.state} 
                onChange={handleChange}
                style={{ width: '100%', background: 'rgba(11, 29, 49, 0.95)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '12px' }}
                required
              >
                <option value="">Select State</option>
                {Object.keys(INDIA_STATES_AND_CITIES).map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#dce8f7', marginBottom: '4px' }}>City *</label>
              <select 
                name="city" 
                value={formData.city} 
                onChange={handleChange}
                disabled={!formData.state}
                style={{ width: '100%', background: 'rgba(11, 29, 49, 0.95)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '12px', opacity: formData.state ? 1 : 0.6 }}
                required
              >
                <option value="">{formData.state ? 'Select City' : 'Choose State first'}</option>
                {availableCities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
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
              background: isAdminMode ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #20c6c6, #4f8cff)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: isAdminMode ? '0 0 20px rgba(239,68,68,.3)' : '0 0 20px rgba(32,198,198,.3)',
              marginBottom: '12px'
            }}
          >
            {isAdminMode ? 'Register as Administrator 🛡️' : 'Create Account →'}
          </button>
        </form>

        {/* Google Sign-in Section: HIDDEN for Admin Window as requested */}
        {!isAdminMode && (
          <>
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
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', color: '#71869f', fontSize: '.78rem', marginTop: '1.5rem' }}>
        SHM Monitoring System • Secure Encrypted Registration
      </div>
    </div>
  );
}

export default Register;