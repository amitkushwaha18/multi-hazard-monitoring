import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginRegister from './components/LoginRegister';
import Register from './components/Register';
import MapDashboard from './components/MapDashboard';
import AdminOverview from './components/AdminOverview';

const isAdminRole = (role) => /admin/i.test(role || '');

function App() {
  // --- Auth gate ---------------------------------------------------------
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [currentUser, setCurrentUser] = useState(null); // full profile { role, fullName, email, city, state, ... }

  const handleLoginSuccess = (profile) => {
    const p = profile || {};
    setCurrentUser({
      role: p.role || 'Public Citizen',
      fullName: p.fullName || 'User',
      email: p.email || '',
      phone: p.phone || '',
      city: p.city || '',
      state: p.state || '',
      address: p.address || '',
      pinCode: p.pinCode || '',
      authProvider: p.authProvider || 'local'
    });
  };

  const handleRegisterSuccess = () => {
    // Register.jsx already shows the "Registration successful!" alert itself.
    setAuthView('login');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthView('login');
  };

  // Not signed in yet -> Landing Page first (default entry point).
  // Sign In / Create Account open ONLY from the Landing Page buttons.
  if (!currentUser) {
    if (authView === 'landing') {
      return (
        <LandingPage
          onNavigate={(view) => {
            if (view === 'login' || view === 'register') setAuthView(view);
          }}
        />
      );
    }
    if (authView === 'register') {
      return (
        <Register
          onSwitchToLogin={() => setAuthView('login')}
          onRegisterSuccess={handleRegisterSuccess}
          onGoogleSuccess={handleLoginSuccess}
        />
      );
    }
    return (
      <LoginRegister
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView('register')}
      />
    );
  }

  // Role-based dashboard routing.
  // MapDashboard is EXCLUSIVELY for Public Citizens.
  // Administrators always land on the Admin Overview dashboard instead.
  if (isAdminRole(currentUser.role)) {
    return <AdminOverview user={currentUser} onLogout={handleLogout} />;
  }

  return <MapDashboard user={currentUser} onLogout={handleLogout} />;
}

export default App;