import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Eye, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign } from '../hooks/useCampaign';

const statusBadge = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function AdminCredits() {
  const { getAdminCreditRequests, processCreditRequest } = useCampaign();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('');
  const [processing, setProcessing] = useState(null);
  const [note, setNote] = useState('');
  const [viewReceipt, setViewReceipt] = useState(null);

  const load = () => getAdminCreditRequests(filter).then(setRequests).catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const handleProcess = async (id, status) => {
    setProcessing(id);
    try {
      await processCreditRequest(id, status, note);
      toast.success(`Request ${status}!`);
      setNote('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CreditCard size={24} /> Credit Requests
      </h1>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f.value ? 'bg-whatsapp text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          No credit requests found
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg">{r.user_name}</p>
                  <p className="text-sm text-gray-500">{r.email}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span><strong>{r.amount}</strong> credits</span>
                    <span><strong>Rs. {r.pkr_amount}</strong></span>
                    <span className="text-gray-400">Current balance: {r.user_credits}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Requested: {new Date(r.created_at).toLocaleString()}
                    {r.processed_at && ` | Processed: ${new Date(r.processed_at).toLocaleString()}`}
                  </p>
                  {r.admin_note && (
                    <p className="text-xs text-gray-500 mt-1 italic">Admin note: {r.admin_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const filename = r.receipt_path.split('/').pop().split('\\').pop();
                      setViewReceipt(`/api/admin/receipts/${filename}`);
                    }}
                    className="btn-secondary text-sm py-1 flex items-center gap-1"
                  >
                    <Eye size={14} /> Receipt
                  </button>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge[r.status]}`}>
                    {r.status}
                  </span>
                </div>
              </div>

              {r.status === 'pending' && (
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">Admin Note (optional)</label>
                      <input
                        type="text"
                        value={processing === r.id ? note : ''}
                        onChange={(e) => { setProcessing(r.id); setNote(e.target.value); }}
                        className="input-field text-sm"
                        placeholder="Optional note for user"
                      />
                    </div>
                    <button
                      onClick={() => handleProcess(r.id, 'approved')}
                      disabled={processing === r.id && processing !== null}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button
                      onClick={() => handleProcess(r.id, 'rejected')}
                      disabled={processing === r.id && processing !== null}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt Viewer Modal */}
      {viewReceipt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewReceipt(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl max-h-[90vh] overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
            <img src={viewReceipt} alt="Payment Receipt" className="w-full rounded-lg" />
            <button onClick={() => setViewReceipt(null)} className="btn-secondary w-full mt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
