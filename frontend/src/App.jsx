import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import LoginRegister from './components/LoginRegister';
import Register from './components/Register';
import MapDashboard from './components/MapDashboard';
import AdminOverview from './components/AdminOverview';
import AIChatbotCopilot from './components/AIChatbotCopilot';
import { pushInternalPage, closeTopOverlay } from './utils/historyBack';

const isAdminRole = (role) => /admin/i.test(role || '');

function App() {
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [currentUser, setCurrentUser] = useState(null); // profile object

  // ==========================================
  // MOBILE BACK BUTTON HISTORY TRAP
  // Listen for the browser Back button. While an overlay (modal / profile
  // menu) is open, Back closes it instead of leaving the page. Otherwise,
  // if the user is inside the Dashboard or Login/Register view, Back steps
  // back to the Landing page. On the plain Landing page itself, the default
  // browser behaviour is preserved so the user can still navigate away.
  // ==========================================
  useEffect(() => {
    const handlePopState = () => {
      if (closeTopOverlay()) return;

      if (currentUser) {
        setCurrentUser(null);
        setAuthView('landing');
        return;
      }

      if (authView === 'login' || authView === 'register') {
        setAuthView('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, authView]);

  /**
   * Change the auth view. Entering the Login/Register screens pushes a
   * history entry so the mobile Back button can step back to Landing.
   * Returning to 'landing' never pushes (it is the base view).
   */
  const navigateToAuthView = (view) => {
    if ((view === 'login' || view === 'register') && authView === 'landing') {
      pushInternalPage();
    }
    setAuthView(view);
  };

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
    // Entering the Dashboard is an internal step — push a history entry so
    // Back returns to the Landing page instead of exiting the website.
    pushInternalPage();
  };

  const handleRegisterSuccess = () => {
    navigateToAuthView('login');
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
            if (view === 'login' || view === 'register') navigateToAuthView(view);
          }}
        />
      );
    }

    if (authView === 'register') {
      return (
        <Register
          onSwitchToLogin={() => navigateToAuthView('login')}
          onRegisterSuccess={handleRegisterSuccess}
          onGoogleSuccess={handleLoginSuccess}
        />
      );
    }

    return (
      <LoginRegister
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => navigateToAuthView('register')}
        onBackToLanding={() => navigateToAuthView('landing')}
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