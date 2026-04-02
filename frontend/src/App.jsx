import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard,
  PlusCircle,
  History as HistoryIcon,
  Settings as SettingsIcon,
  MessageCircle,
} from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import ConnectionStatus from './components/ConnectionStatus';
import Dashboard from './pages/Dashboard';
import NewCampaign from './pages/NewCampaign';
import CampaignDetail from './pages/CampaignDetail';
import History from './pages/History';
import Settings from './pages/Settings';

export default function App() {
  const { socket, on } = useSocket();
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waInfo, setWaInfo] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (!on) return;

    const unsub1 = on('whatsapp:status', (data) => {
      setWaStatus(data.status);
      if (data.info) setWaInfo(data.info);
      if (data.status === 'connected') setQrCode(null);
    });

    const unsub2 = on('whatsapp:qr', (qr) => {
      setQrCode(qr);
    });

    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [on]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Fetch initial WA status
  useEffect(() => {
    fetch('http://localhost:3001/api/whatsapp/status')
      .then((r) => r.json())
      .then((data) => {
        setWaStatus(data.status);
        if (data.info) setWaInfo(data.info);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/whatsapp/logout', {
        method: 'POST',
      });
      setWaStatus('disconnected');
      setWaInfo(null);
    } catch {
      // ignore
    }
  };

  const navLink = (to, icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-whatsapp text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`
      }
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </NavLink>
  );

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="text-whatsapp" size={24} />
              <span className="font-bold text-lg hidden sm:inline">
                WA Bulk Sender
              </span>
            </div>
            <ConnectionStatus
              status={waStatus}
              info={waInfo}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <div className="max-w-7xl mx-auto flex">
          {/* Sidebar */}
          <nav className="w-14 md:w-52 min-h-[calc(100vh-3.5rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 space-y-1 flex-shrink-0">
            {navLink('/', <LayoutDashboard size={18} />, 'Dashboard')}
            {navLink(
              '/campaign/new',
              <PlusCircle size={18} />,
              'New Campaign'
            )}
            {navLink('/history', <HistoryIcon size={18} />, 'History')}
            {navLink('/settings', <SettingsIcon size={18} />, 'Settings')}
          </nav>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <Routes>
              <Route
                path="/"
                element={<Dashboard waStatus={waStatus} />}
              />
              <Route
                path="/campaign/new"
                element={
                  <NewCampaign
                    waStatus={waStatus}
                    waInfo={waInfo}
                    qrCode={qrCode}
                  />
                }
              />
              <Route
                path="/campaign/:id"
                element={<CampaignDetail socket={socket} />}
              />
              <Route path="/history" element={<History />} />
              <Route
                path="/settings"
                element={<Settings theme={theme} setTheme={setTheme} />}
              />
            </Routes>
          </main>
        </div>

        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '10px',
              background: theme === 'dark' ? '#1f2937' : '#fff',
              color: theme === 'dark' ? '#f3f4f6' : '#111827',
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}
