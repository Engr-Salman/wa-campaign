import React, { useEffect, useState } from 'react';
import { Users, Search, Plus, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign } from '../hooks/useCampaign';
import { apiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminUsers() {
  const { getAdminUsers, addUserCredits, getAdminUser } = useCampaign();
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(null); // userId
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [viewUser, setViewUser] = useState(null);

  const load = () => getAdminUsers().then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCredits = async () => {
    if (!creditAmount || parseInt(creditAmount) < 1) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await addUserCredits(addModal, parseInt(creditAmount), creditNote);
      toast.success('Credits added!');
      setAddModal(null);
      setCreditAmount('');
      setCreditNote('');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleViewUser = async (userId) => {
    try {
      const detail = await getAdminUser(userId);
      setViewUser(detail);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const downloadProtectedFile = async (url, fallbackName) => {
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error('Download failed');
      }

      const blob = await res.blob();
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = fallbackName;
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={24} /> User Management
        </h1>
        <span className="text-sm text-gray-500">{users.length} users total</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
          placeholder="Search by name or email..."
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-left">
              <th className="py-2 px-3 font-medium text-gray-500">User</th>
              <th className="py-2 px-3 font-medium text-gray-500">Status</th>
              <th className="py-2 px-3 font-medium text-gray-500">Credits</th>
              <th className="py-2 px-3 font-medium text-gray-500">Campaigns</th>
              <th className="py-2 px-3 font-medium text-gray-500">Messages</th>
              <th className="py-2 px-3 font-medium text-gray-500">Joined</th>
              <th className="py-2 px-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                <td className="py-2 px-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="py-2 px-3">
                  {u.is_admin ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-bold">Admin</span>
                  ) : u.is_verified ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-bold">Verified</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-bold">Unverified</span>
                  )}
                </td>
                <td className="py-2 px-3 font-bold">{u.credits}</td>
                <td className="py-2 px-3">{u.campaign_count}</td>
                <td className="py-2 px-3">{u.total_messages_sent}</td>
                <td className="py-2 px-3 text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-2 px-3">
                  <button
                    onClick={() => setAddModal(u.id)}
                    className="text-xs text-whatsapp hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Credits
                  </button>
                  <button
                    onClick={() => handleViewUser(u.id)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    <Eye size={12} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Credits Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAddModal(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add Credits</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="input-field"
                  placeholder="Number of credits"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className="input-field"
                  placeholder="Reason for adding credits"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddCredits} className="btn-primary">Add Credits</button>
                <button onClick={() => setAddModal(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewUser(null)}>
          <div className="card w-full max-w-5xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{viewUser.name}</h3>
                <p className="text-sm text-gray-500">{viewUser.email}</p>
              </div>
              <button onClick={() => setViewUser(null)} className="btn-secondary">Close</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="card p-4">
                <p className="text-xs text-gray-500">Credits</p>
                <p className="text-xl font-bold">{viewUser.credits}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Campaigns</p>
                <p className="text-xl font-bold">{viewUser.campaigns?.length || 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Joined</p>
                <p className="text-sm font-medium">{new Date(viewUser.created_at).toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Last Login</p>
                <p className="text-sm font-medium">{viewUser.last_login ? new Date(viewUser.last_login).toLocaleString() : 'Never'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold">Campaigns</h4>
              {viewUser.campaigns?.length ? (
                <div className="space-y-3">
                  {viewUser.campaigns.map((campaign) => (
                    <div key={campaign.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{campaign.name}</p>
                          <p className="text-xs text-gray-500">
                            {campaign.status} | {campaign.sent_count}/{campaign.total_contacts} sent
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <a href={`/campaign/${campaign.id}`} className="btn-secondary text-sm">Open</a>
                          {campaign.source_file_download_url && (
                            <button
                              onClick={() => downloadProtectedFile(campaign.source_file_download_url, campaign.source_file_name || `campaign-${campaign.id}-source`)}
                              className="btn-secondary text-sm flex items-center gap-1"
                            >
                              <Download size={14} /> Source File
                            </button>
                          )}
                          <button
                            onClick={() => downloadProtectedFile(`/api/campaigns/${campaign.id}/export`, `${campaign.name || `campaign-${campaign.id}`}_results.csv`)}
                            className="btn-secondary text-sm flex items-center gap-1"
                          >
                            <Download size={14} /> Results CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No campaigns yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
