import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight } from 'lucide-react';
import { useCampaign } from '../hooks/useCampaign';

const statusBadge = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  stopped: 'bg-red-100 text-red-700',
};

export default function History() {
  const { getCampaigns } = useCampaign();
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    getCampaigns().then(setCampaigns).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Campaign History</h1>
      {campaigns.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <Clock className="mx-auto mb-3" size={40} />
          <p>No campaigns yet</p>
          <Link to="/campaign/new" className="text-whatsapp hover:underline text-sm mt-2 inline-block">
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              to={`/campaign/${c.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <p className="font-bold text-lg">{c.name}</p>
                <p className="text-sm text-gray-500">
                  {new Date(c.created_at).toLocaleDateString()} &middot;{' '}
                  {c.total_contacts} contacts &middot; {c.sent_count} sent
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      statusBadge[c.status] || statusBadge.draft
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.total_contacts > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.round((c.sent_count / c.total_contacts) * 100)}%
                      success
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
