import React from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

export default function CampaignProgress({
  campaign,
  progress,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetry,
}) {
  if (!campaign) return null;

  const sent = progress?.sent ?? campaign.sent_count ?? 0;
  const failed = progress?.failed ?? campaign.failed_count ?? 0;
  const skipped = progress?.skipped ?? campaign.skipped_count ?? 0;
  const total = progress?.total ?? campaign.total_contacts ?? 0;
  const processed = sent + failed + skipped;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const status = campaign.status;

  const formatEta = (seconds) => {
    if (!seconds || seconds <= 0) return '--';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">{campaign.name}</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            status === 'running'
              ? 'bg-green-100 text-green-700'
              : status === 'paused'
              ? 'bg-yellow-100 text-yellow-700'
              : status === 'completed'
              ? 'bg-blue-100 text-blue-700'
              : status === 'stopped'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>
            {sent} sent / {total} total
          </span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div className="flex h-full">
            <div
              className="bg-whatsapp transition-all duration-500"
              style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }}
            />
            <div
              className="bg-red-400 transition-all duration-500"
              style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }}
            />
            <div
              className="bg-yellow-400 transition-all duration-500"
              style={{ width: `${total > 0 ? (skipped / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-green-600">{sent}</div>
          <div className="text-xs text-gray-500">Sent</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-red-600">{failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-yellow-600">{skipped}</div>
          <div className="text-xs text-gray-500">Skipped</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-blue-600">
            {formatEta(progress?.eta)}
          </div>
          <div className="text-xs text-gray-500">ETA</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {status === 'draft' && (
          <button onClick={onStart} className="btn-primary flex items-center gap-2">
            <Play size={16} /> Start Campaign
          </button>
        )}
        {status === 'running' && (
          <>
            <button
              onClick={onPause}
              className="btn-secondary flex items-center gap-2"
            >
              <Pause size={16} /> Pause
            </button>
            <button
              onClick={onStop}
              className="btn-danger flex items-center gap-2"
            >
              <Square size={16} /> Stop
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="btn-primary flex items-center gap-2"
            >
              <Play size={16} /> Resume
            </button>
            <button
              onClick={onStop}
              className="btn-danger flex items-center gap-2"
            >
              <Square size={16} /> Stop
            </button>
          </>
        )}
        {(status === 'completed' || status === 'stopped') && failed > 0 && (
          <button onClick={onRetry} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={16} /> Retry Failed ({failed})
          </button>
        )}
      </div>
    </div>
  );
}
