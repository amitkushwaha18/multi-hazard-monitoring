import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginRegister from './components/LoginRegister';
import Register from './components/Register';
import MapDashboard from './components/MapDashboard';
import AdminOverview from './components/AdminOverview';
import AIChatbotCopilot from './components/AIChatbotCopilot';

const isAdminRole = (role) => /admin/i.test(role || '');

function App() {
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [currentUser, setCurrentUser] = useState(null); // profile object

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
    setAuthView('login');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthView('landing');
  };

  // ==========================================
  // STRICT AUTH GUARD: 
  // If user is logged in, ONLY render the respective dashboard. 
  // No login/register screen can ever overlap.
  // ==========================================
  const renderView = () => {
    if (currentUser) {
      if (isAdminRole(currentUser.role)) {
        return <AdminOverview user={currentUser} onLogout={handleLogout} />;
      }
      return <MapDashboard user={currentUser} onLogout={handleLogout} />;
    }

    // Not logged in -> Render Landing Page or Auth screens
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
        onBackToLanding={() => setAuthView('landing')}
      />
    );
  };

  return (
    <>
      {renderView()}
      <AIChatbotCopilot />
    </>
  );
}

export default App;