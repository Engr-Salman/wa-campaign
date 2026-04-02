import React, { useRef, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

const iconMap = {
  sent: <CheckCircle size={14} className="text-green-500" />,
  failed: <XCircle size={14} className="text-red-500" />,
  invalid: <AlertTriangle size={14} className="text-yellow-500" />,
  skipped: <AlertTriangle size={14} className="text-orange-500" />,
  retry: <Clock size={14} className="text-blue-500" />,
};

export default function LogFeed({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
        No activity yet. Start a campaign to see live logs.
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
      {logs.map((log, i) => (
        <div
          key={log.id || i}
          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/30"
        >
          {iconMap[log.status] || iconMap.sent}
          <span className="text-gray-400 w-36 flex-shrink-0">
            {log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : '--'}
          </span>
          <span className="font-medium">{log.phone_number || log.phone}</span>
          <span
            className={`ml-auto ${
              log.status === 'sent' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {log.status}
          </span>
          {log.error_message && (
            <span className="text-red-400 ml-2 truncate max-w-[200px]">
              {log.error_message}
            </span>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
