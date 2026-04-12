import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import CampaignProgress from '../components/CampaignProgress';
import ContactTable from '../components/ContactTable';
import LogFeed from '../components/LogFeed';
import RateLimitWarning from '../components/RateLimitWarning';
import { useCampaign } from '../hooks/useCampaign';
import { useAuth } from '../context/AuthContext';

export default function CampaignDetail({ socket }) {
  const { id } = useParams();
  const {
    getCampaign: fetchCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    retryCampaign,
  } = useCampaign();
  const { authFetch } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(null);
  const [rateLimit, setRateLimit] = useState(null);

  const loadCampaign = async () => {
    try {
      const data = await fetchCampaign(id);
      setCampaign(data);
      setContacts(data.contacts || []);
      setLogs(data.logs || []);
    } catch {
      toast.error('Failed to load campaign');
    }
  };

  useEffect(() => {
    loadCampaign();
  }, [id]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleProgress = (data) => {
      if (String(data.campaignId) === String(id)) {
        setProgress(data);
      }
    };

    const handleStatus = (data) => {
      if (String(data.campaignId) === String(id)) {
        setCampaign((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    };

    const handleSent = (data) => {
      if (String(data.campaignId) === String(id)) {
        setContacts((prev) =>
          prev.map((c) =>
            String(c.id) === String(data.contactId)
              ? { ...c, status: 'sent' }
              : c
          )
        );
        setLogs((prev) => [data, ...prev].slice(0, 200));
      }
    };

    const handleFailed = (data) => {
      if (String(data.campaignId) === String(id)) {
        setContacts((prev) =>
          prev.map((c) =>
            String(c.id) === String(data.contactId)
              ? { ...c, status: 'failed', error_message: data.error }
              : c
          )
        );
        setLogs((prev) => [data, ...prev].slice(0, 200));
      }
    };

    const handleRateLimit = (data) => {
      if (String(data.campaignId) === String(id)) {
        setRateLimit(data);
      }
    };

    const handleError = (data) => {
      if (String(data.campaignId) === String(id)) {
        toast.error(data.error || 'Campaign encountered an error');
        loadCampaign();
      }
    };

    socket.on('campaign:progress', handleProgress);
    socket.on('campaign:status', handleStatus);
    socket.on('campaign:message_sent', handleSent);
    socket.on('campaign:message_failed', handleFailed);
    socket.on('campaign:rate_limit', handleRateLimit);
    socket.on('campaign:error', handleError);

    return () => {
      socket.off('campaign:progress', handleProgress);
      socket.off('campaign:status', handleStatus);
      socket.off('campaign:message_sent', handleSent);
      socket.off('campaign:message_failed', handleFailed);
      socket.off('campaign:rate_limit', handleRateLimit);
      socket.off('campaign:error', handleError);
    };
  }, [socket, id]);

  if (!campaign) {
    return <div className="text-center py-10 text-gray-400">Loading...</div>;
  }

  const successRate =
    campaign.sent_count > 0 && campaign.total_contacts > 0
      ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
      : 0;

  const downloadResults = async () => {
    try {
      const res = await authFetch(`/api/campaigns/${id}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${campaign.name || `campaign-${id}`}_results.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/history"
        className="text-sm text-gray-500 hover:text-whatsapp flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <CampaignProgress
        campaign={campaign}
        progress={progress}
        onStart={() => startCampaign(id).then(loadCampaign)}
        onPause={() => pauseCampaign(id).then(loadCampaign)}
        onResume={() => resumeCampaign(id).then(loadCampaign)}
        onStop={() => stopCampaign(id).then(loadCampaign)}
        onRetry={() => retryCampaign(id).then(loadCampaign)}
      />

      <RateLimitWarning rateLimit={rateLimit} />

      {/* Summary (show when completed/stopped) */}
      {(campaign.status === 'completed' || campaign.status === 'stopped') && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Campaign Summary</h3>
            <button
              onClick={downloadResults}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download size={16} /> Export Results CSV
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {campaign.sent_count}
              </div>
              <div className="text-xs text-gray-500">Sent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {campaign.failed_count}
              </div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {campaign.skipped_count}
              </div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {successRate}%
              </div>
              <div className="text-xs text-gray-500">Success Rate</div>
            </div>
          </div>
          {campaign.started_at && campaign.completed_at && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Duration:{' '}
              {Math.round(
                (new Date(campaign.completed_at) -
                  new Date(campaign.started_at)) /
                  60000
              )}{' '}
              minutes
            </p>
          )}
        </div>
      )}

      {/* Log Feed */}
      <div className="card">
        <h3 className="font-bold mb-3">Activity Log</h3>
        <LogFeed logs={logs} />
      </div>

      {/* Contacts Table */}
      <div className="card">
        <h3 className="font-bold mb-3">
          Contacts ({contacts.length})
        </h3>
        <ContactTable contacts={contacts} readOnly />
      </div>
    </div>
  );
}
