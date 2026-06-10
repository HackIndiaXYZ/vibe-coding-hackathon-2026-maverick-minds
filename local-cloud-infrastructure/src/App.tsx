import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import StorageMetrics from './components/StorageMetrics';
import CameraFeed from './components/CameraFeed';
import BackupConsole from './components/BackupConsole';
import ChatbotConsole from './components/ChatbotConsole';
import FileManager from './components/FileManager';
import DashboardOverview from './components/DashboardOverview';
import VpnManager from './components/VpnManager';

type Tab = 'overview' | 'storage' | 'camera' | 'backup' | 'chatbot' | 'files' | 'vpn';

export default function App() {
  const { isAuthenticated, login, logout, loading } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    return Number(localStorage.getItem('sidebar_width')) || 260;
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
      });
    } else {
      setTheme(prev => prev === 'light' ? 'dark' : 'light');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(80, Math.min(360, startWidth + delta));
      const snappedWidth = newWidth < 160 ? 80 : newWidth;
      setSidebarWidth(snappedWidth);
      localStorage.setItem('sidebar_width', String(snappedWidth));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const res = await login(pin);
    if (!res.success) {
      setAuthError(res.error || 'Authentication failed');
      setPin('');
    }
  };

  // Passcode authentication bypassed by user request to prevent issues in surveillance feed
  const bypassAuth = true;

  return (
    <div className="dashboard" data-active-tab={activeTab} style={{ gridTemplateColumns: `${sidebarWidth}px 4px 1fr` }}>
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Sidebar */}
      <aside className="sidebar" style={{ width: `${sidebarWidth}px` }} data-collapsed={sidebarWidth < 160}>
        <div className="sidebar-logo">
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="24" height="24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
          </svg>
          <span className="logo-text">Vault Console</span>
          <span className="logo-pulse"></span>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveTab('overview')}
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            aria-label="Console Hub Overview"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-1.8 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
            </svg>
            <span className="sidebar-label">Console Hub</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`sidebar-item ${activeTab === 'storage' ? 'active' : ''}`}
            aria-label="Storage Settings"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
            <span className="sidebar-label">Storage Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('camera')}
            className={`sidebar-item ${activeTab === 'camera' ? 'active' : ''}`}
            aria-label="Camera"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 012.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="sidebar-label">Surveillance Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`sidebar-item ${activeTab === 'backup' ? 'active' : ''}`}
            aria-label="Backup"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m-6.75 2.25h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 20.25zm7.5-12.75l.75-.75L13.5 6.75M12 7.5V3" />
            </svg>
            <span className="sidebar-label">System Backup</span>
          </button>
          <button
            onClick={() => setActiveTab('chatbot')}
            className={`sidebar-item ${activeTab === 'chatbot' ? 'active' : ''}`}
            aria-label="Chatbot"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="sidebar-label">Local AI Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`sidebar-item ${activeTab === 'files' ? 'active' : ''}`}
            aria-label="Files"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="sidebar-label">File Explorer</span>
          </button>
          <button
            onClick={() => setActiveTab('vpn')}
            className={`sidebar-item ${activeTab === 'vpn' ? 'active' : ''}`}
            aria-label="VPN"
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="sidebar-label">VPN Access</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button onClick={toggleTheme} className="sidebar-bottom-item" aria-label="Toggle Theme" title="Toggle Theme">
            {theme === 'light' ? (
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m9.75-9h-2.25m-13.5 0H3m16.257-7.257l-1.591 1.591M5.222 18.778l1.591-1.591m12.066 0l1.591 1.591M6.813 6.813l-1.591-1.591M12 18.75a6.75 6.75 0 110-13.5 6.75 6.75 0 010 13.5z" />
              </svg>
            )}
            <span className="sidebar-bottom-label">Theme Mode</span>
          </button>
          <button onClick={logout} className="sidebar-bottom-item" aria-label="Logout" title="Logout">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span className="sidebar-bottom-label">Sign Out</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-resizer" onMouseDown={handleMouseDown} />

      {/* Main Content */}
      <main className="main-content" id="main-content">
        <div className="dashboard-main">
          <div style={{ background: 'var(--accent-yellow)', borderBottom: '2.5px solid var(--border-primary)', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: '800', color: '#1A1A1A' }}>
            <span>SECURE LOCAL CLOUD NODE</span>
            <span>SYSTEM ENCRYPTED: ON</span>
          </div>
          <section className="detail-column">
            {activeTab === 'overview' && <DashboardOverview onNavigate={setActiveTab} />}
            {activeTab === 'storage' && <StorageMetrics />}
            {activeTab === 'camera' && <CameraFeed />}
            {activeTab === 'backup' && <BackupConsole />}
            {activeTab === 'chatbot' && <ChatbotConsole />}
            {activeTab === 'files' && <FileManager />}
            {activeTab === 'vpn' && <VpnManager />}
          </section>
        </div>
      </main>
    </div>
  );
}
