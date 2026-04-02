import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  TrendingUp,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { useCampaign } from '../hooks/useCampaign';

export default function Dashboard({ waStatus }) {
  const { getCampaigns, getStats } = useCampaign();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ today: 0, weekly: 0, allTime: 0 });

  useEffect(() => {
    getCampaigns().then(setCampaigns).catch(() => {});
    getStats().then(setStats).catch(() => {});
  }, []);

  const activeCampaign = campaigns.find(
    (c) => c.status === 'running' || c.status === 'paused'
  );
  const recentCampaigns = campaigns.slice(0, 5);

  const statusBadge = {
    draft: 'bg-gray-100 text-gray-600',
    running: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    stopped: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/campaign/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Campaign
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <MessageSquare className="text-whatsapp" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.today}</div>
            <div className="text-sm text-gray-500">Sent Today</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Calendar className="text-blue-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.weekly}</div>
            <div className="text-sm text-gray-500">This Week</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <BarChart3 className="text-purple-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.allTime}</div>
            <div className="text-sm text-gray-500">All Time</div>
          </div>
        </div>
      </div>

      {/* WhatsApp Status Card */}
      <div className="card">
        <h2 className="font-bold mb-2">WhatsApp Connection</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              waStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="capitalize">{waStatus || 'disconnected'}</span>
          {waStatus !== 'connected' && (
            <Link
              to="/campaign/new"
              className="text-sm text-whatsapp hover:underline ml-4"
            >
              Connect now
            </Link>
          )}
        </div>
      </div>

      {/* Active Campaign */}
      {activeCampaign && (
        <div className="card border-whatsapp border-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold flex items-center gap-2">
              <TrendingUp className="text-whatsapp" size={18} />
              Active Campaign
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                statusBadge[activeCampaign.status]
              }`}
            >
              {activeCampaign.status}
            </span>
          </div>
          <p className="text-lg font-medium">{activeCampaign.name}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-whatsapp h-2 rounded-full transition-all"
              style={{
                width: `${
                  activeCampaign.total_contacts > 0
                    ? (activeCampaign.sent_count /
                        activeCampaign.total_contacts) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {activeCampaign.sent_count} / {activeCampaign.total_contacts} sent
          </p>
          <Link
            to={`/campaign/${activeCampaign.id}`}
            className="text-sm text-whatsapp hover:underline mt-2 inline-block"
          >
            View Details
          </Link>
        </div>
      )}

      {/* Recent Campaigns */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Recent Campaigns</h2>
          <Link
            to="/history"
            className="text-sm text-whatsapp hover:underline"
          >
            View All
          </Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            No campaigns yet. Create your first one!
          </p>
        ) : (
          <div className="space-y-2">
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                to={`/campaign/${c.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleDateString()} &middot;{' '}
                    {c.total_contacts} contacts
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {c.sent_count}/{c.total_contacts}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      statusBadge[c.status] || statusBadge.draft
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
