import React, { useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign } from '../hooks/useCampaign';

const SAFE_LIMITS = {
  messages_per_minute: 8,
  messages_per_hour: 100,
  messages_per_day: 300,
};

export default function Settings({ theme, setTheme }) {
  const { getSettings, updateSettings } = useCampaign();
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const isUnsafe = (key) => {
    if (!SAFE_LIMITS[key]) return false;
    return parseInt(settings[key]) > SAFE_LIMITS[key];
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/whatsapp/logout', {
        method: 'POST',
      });
      toast.success('Logged out from WhatsApp');
    } catch {
      toast.error('Logout failed');
    }
  };

  const inputRow = (label, key, type = 'number', help) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={settings[key] || ''}
        onChange={(e) => update(key, e.target.value)}
        className="input-field"
      />
      {help && <p className="text-xs text-gray-400 mt-1">{help}</p>}
      {isUnsafe(key) && (
        <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
          <AlertTriangle size={12} /> Exceeds recommended safe limit (
          {SAFE_LIMITS[key]})
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-4">
        <h2 className="font-bold text-lg">Rate Limits</h2>
        <p className="text-sm text-gray-500">
          Adjust sending speed. Lower values are safer but slower.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {inputRow('Messages per minute', 'messages_per_minute', 'number', 'Safe: 5-8')}
          {inputRow('Messages per hour', 'messages_per_hour', 'number', 'Safe: 60-100')}
          {inputRow('Messages per day', 'messages_per_day', 'number', 'Safe: 200-300')}
          {inputRow('Max retries per number', 'max_retries')}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-lg">Delay Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          {inputRow('Min delay between messages (seconds)', 'delay_min')}
          {inputRow('Max delay between messages (seconds)', 'delay_max')}
          {inputRow('Cooldown after N messages', 'cooldown_after')}
          {inputRow('Cooldown min duration (seconds)', 'cooldown_min')}
          {inputRow('Cooldown max duration (seconds)', 'cooldown_max')}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-lg">Default Message Template</h2>
        <textarea
          value={settings.default_template || ''}
          onChange={(e) => update('default_template', e.target.value)}
          placeholder="Enter a default message template..."
          className="input-field h-24"
        />
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-lg">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => {
              update('theme', 'light');
              setTheme('light');
            }}
            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
              (settings.theme || theme) === 'light'
                ? 'border-whatsapp bg-green-50'
                : 'border-gray-200'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => {
              update('theme', 'dark');
              setTheme('dark');
            }}
            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
              (settings.theme || theme) === 'dark'
                ? 'border-whatsapp bg-green-50'
                : 'border-gray-200'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-lg">Other</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.auto_resume === 'true'}
            onChange={(e) =>
              update('auto_resume', e.target.checked ? 'true' : 'false')
            }
            className="rounded text-whatsapp focus:ring-whatsapp"
          />
          Auto-resume paused campaigns on reconnect
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button onClick={handleLogout} className="btn-danger">
          Logout WhatsApp
        </button>
      </div>
    </div>
  );
}
