import React from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';

const statusConfig = {
  connected: { color: 'bg-green-500', text: 'Connected', icon: Wifi },
  disconnected: { color: 'bg-red-500', text: 'Disconnected', icon: WifiOff },
  qr: { color: 'bg-yellow-500', text: 'Scan QR Code', icon: RefreshCw },
  authenticated: { color: 'bg-blue-500', text: 'Authenticating...', icon: RefreshCw },
  auth_failure: { color: 'bg-red-500', text: 'Auth Failed', icon: WifiOff },
  error: { color: 'bg-red-500', text: 'Error', icon: WifiOff },
  reconnecting: { color: 'bg-yellow-500', text: 'Reconnecting...', icon: RefreshCw },
};

export default function ConnectionStatus({ status, info, onLogout }) {
  const config = statusConfig[status] || statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${config.color} animate-pulse`} />
        <Icon size={16} />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
      {info && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {info.pushname} ({info.phone})
        </span>
      )}
      {status === 'connected' && (
        <button
          onClick={onLogout}
          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 ml-2"
        >
          <LogOut size={12} />
          Logout
        </button>
      )}
    </div>
  );
}
