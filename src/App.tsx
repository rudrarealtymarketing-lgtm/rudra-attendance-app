import React, { useState, useEffect } from 'react';
import { User, Screen } from './types';
import { LoginScreen } from './components/LoginScreen';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AdminConsole } from './components/AdminConsole';
import { DirectorPortal } from './components/DirectorPortal';
import { CurvedBottomNav } from './components/CurvedBottomNav';
import { LeaveModal } from './components/LeaveModal';

export function App() {
  // Current user state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('staffsync_current_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // Current screen state
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Theme state ('light' by default as requested by user, with dark mode toggle)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('staffsync_theme') as 'light' | 'dark') || 'light';
  });

  // Language state ('en' | 'hi' globally)
  const [lang, setLang] = useState<'en' | 'hi'>(() => {
    return (localStorage.getItem('staffsync_lang') as 'en' | 'hi') || 'en';
  });

  // Sync theme with HTML class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('staffsync_theme', theme);
  }, [theme]);

  // Sync language
  useEffect(() => {
    localStorage.setItem('staffsync_lang', lang);
  }, [lang]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleToggleLang = () => {
    setLang(prev => (prev === 'en' ? 'hi' : 'en'));
  };

  // Sync state if user role changes or login
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'super_admin') {
      setCurrentScreen('admin');
    } else if (user.role === 'director') {
      setCurrentScreen('director');
    } else {
      setCurrentScreen('home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staffsync_current_user');
    setCurrentUser(null);
    setCurrentScreen('home');
  };

  const handleUpdateUser = (updated: User) => {
    setCurrentUser(updated);
    localStorage.setItem('staffsync_current_user', JSON.stringify(updated));
  };

  const handleTriggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // If not authenticated, render unified mobile login screen
  if (!currentUser) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onToggleLang={handleToggleLang}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 selection:bg-blue-600 selection:text-white font-sans antialiased ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Active Screen View */}
      <main className="w-full">
        {currentScreen === 'home' && (
          <HomeScreen
            key={`home-${refreshTrigger}`}
            currentUser={currentUser}
            onOpenLeaveModal={() => setShowLeaveModal(true)}
            onNavigateHistory={() => setCurrentScreen('history')}
            onNavigateProfile={() => setCurrentScreen('profile')}
            onRefreshData={handleTriggerRefresh}
            lang={lang}
          />
        )}

        {currentScreen === 'history' && (
          <HistoryScreen
            key={`history-${refreshTrigger}`}
            currentUser={currentUser}
            lang={lang}
          />
        )}

        {currentScreen === 'profile' && (
          <ProfileScreen
            currentUser={currentUser}
            onLogout={handleLogout}
            onUpdateUser={handleUpdateUser}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            lang={lang}
            onToggleLang={handleToggleLang}
          />
        )}

        {currentScreen === 'admin' && (
          <AdminConsole
            key={`admin-${refreshTrigger}`}
            currentUser={currentUser}
            onRefreshData={handleTriggerRefresh}
            lang={lang}
          />
        )}

        {currentScreen === 'director' && (
          <DirectorPortal
            key={`director-${refreshTrigger}`}
            currentUser={currentUser}
            onRefreshData={handleTriggerRefresh}
            lang={lang}
          />
        )}
      </main>

      {/* Leave Application & Quota Workflow Modal */}
      {showLeaveModal && (
        <LeaveModal
          currentUser={currentUser}
          onClose={() => setShowLeaveModal(false)}
          onRequestSubmitted={() => {
            handleTriggerRefresh();
          }}
          lang={lang}
        />
      )}

      {/* Modern Curved Bottom Navigation */}
      <CurvedBottomNav
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        currentUser={currentUser}
        onOpenLeaveModal={() => setShowLeaveModal(true)}
        lang={lang}
      />

    </div>
  );
}

export default App;
