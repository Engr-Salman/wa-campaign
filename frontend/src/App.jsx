import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard, PlusCircle, History as HistoryIcon,
  Settings as SettingsIcon, MessageCircle, Coins,
  Shield, Users, CreditCard, LogOut,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import ConnectionStatus from './components/ConnectionStatus';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import NewCampaign from './pages/NewCampaign';
import CampaignDetail from './pages/CampaignDetail';
import History from './pages/History';
import Settings from './pages/Settings';
import Credits from './pages/Credits';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminCredits from './pages/AdminCredits';
import { readJsonResponse } from './utils/api';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400">
        <MessageCircle className="animate-pulse text-whatsapp mr-3" size={32} />
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* Public auth routes — only accessible when NOT logged in */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />

      {/* All other routes require auth — redirect to login if not authed */}
      <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function AppLayout() {
  const { socket, on } = useSocket();
  const { user, logout, authFetch } = useAuth();
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
    const unsub2 = on('whatsapp:qr', (qr) => setQrCode(qr));
    return () => { unsub1?.(); unsub2?.(); };
  }, [on]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    authFetch('/api/whatsapp/status')
      .then((r) => readJsonResponse(r))
      .then((data) => {
        setWaStatus(data.status);
        if (data.info) setWaInfo(data.info);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await authFetch('/api/whatsapp/logout', { method: 'POST' });
      setWaStatus('disconnected');
      setWaInfo(null);
    } catch {}
  };

  const navLink = (to, icon, label) => (
    <NavLink
      to={to}
      end={to === '/' || to === '/admin'}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-whatsapp text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`
      }
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-whatsapp" size={24} />
            <span className="font-bold text-lg hidden sm:inline">WA Bulk Sender</span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus status={waStatus} info={waInfo} onLogout={handleLogout} />
            {user && (
              <div className="flex items-center gap-3 ml-4 border-l pl-4 dark:border-gray-600">
                <span className="text-xs text-gray-500 hidden sm:inline">{user.name}</span>
                <span className="bg-whatsapp/10 text-whatsapp text-xs font-bold px-2 py-0.5 rounded-full">
                  {user.credits} credits
                </span>
                <button onClick={logout} className="text-gray-400 hover:text-red-500" title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        <nav className="w-14 md:w-52 min-h-[calc(100vh-3.5rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 space-y-1 flex-shrink-0">
          {navLink('/', <LayoutDashboard size={18} />, 'Dashboard')}
          {navLink('/campaign/new', <PlusCircle size={18} />, 'New Campaign')}
          {navLink('/history', <HistoryIcon size={18} />, 'History')}
          {navLink('/credits', <Coins size={18} />, 'Credits')}
          {navLink('/settings', <SettingsIcon size={18} />, 'Settings')}

          {user?.is_admin && (
            <>
              <div className="border-t dark:border-gray-700 my-3" />
              <p className="text-xs text-gray-400 px-4 font-bold uppercase tracking-wider mb-1">Admin</p>
              {navLink('/admin', <Shield size={18} />, 'Dashboard')}
              {navLink('/admin/users', <Users size={18} />, 'Users')}
              {navLink('/admin/credits', <CreditCard size={18} />, 'Credit Requests')}
            </>
          )}
        </nav>

        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Dashboard waStatus={waStatus} />} />
            <Route path="/campaign/new" element={<NewCampaign waStatus={waStatus} waInfo={waInfo} qrCode={qrCode} />} />
            <Route path="/campaign/:id" element={<CampaignDetail socket={socket} />} />
            <Route path="/history" element={<History />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/settings" element={<Settings theme={theme} setTheme={setTheme} />} />
            {user?.is_admin && (
              <>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/credits" element={<AdminCredits />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
