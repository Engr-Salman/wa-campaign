import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

export default function RateLimitWarning({ rateLimit }) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!rateLimit || !rateLimit.delay || rateLimit.delay <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(Math.ceil(rateLimit.delay / 1000));
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimit]);

  if (!rateLimit || countdown <= 0) return null;

  const reasonText = {
    minute_limit: 'Per-minute rate limit reached',
    hour_limit: 'Per-hour rate limit reached',
    daily_limit: 'Daily sending limit reached',
    cooldown: 'Cooldown pause (anti-ban protection)',
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
      <div>
        <p className="font-medium text-yellow-800 dark:text-yellow-200">
          {reasonText[rateLimit.reason] || 'Rate limit active'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-sm text-yellow-600 dark:text-yellow-300">
          <Clock size={14} />
          <span>
            Resuming in {Math.floor(countdown / 60)}m {countdown % 60}s
          </span>
        </div>
      </div>
    </div>
  );
}
