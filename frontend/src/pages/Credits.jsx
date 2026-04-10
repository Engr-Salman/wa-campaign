import React, { useEffect, useState, useRef } from 'react';
import { CreditCard, Upload, Clock, CheckCircle, XCircle, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign } from '../hooks/useCampaign';
import { useAuth } from '../context/AuthContext';

const statusBadge = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function Credits() {
  const { refreshUser } = useAuth();
  const { getCreditBalance, getCreditRequests, getCreditTransactions, requestCredits } = useCampaign();
  const fileRef = useRef(null);

  const [balance, setBalance] = useState({ credits: 0, rate_per_credit: 1, credits_per_pkr: 5 });
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('buy');

  const load = async () => {
    try {
      const [b, r, t] = await Promise.all([
        getCreditBalance(),
        getCreditRequests(),
        getCreditTransactions(),
      ]);
      setBalance(b);
      setRequests(r);
      setTransactions(t);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const pkrAmount = amount ? (parseInt(amount) / balance.credits_per_pkr).toFixed(1) : '0';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseInt(amount) < 1) {
      toast.error('Enter a valid credit amount');
      return;
    }
    if (!receiptFile) {
      toast.error('Please upload your payment receipt');
      return;
    }
    setSubmitting(true);
    try {
      await requestCredits(parseInt(amount), receiptFile);
      toast.success('Credit request submitted! Admin will review your receipt.');
      setAmount('');
      setReceiptFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
      refreshUser();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Credits</h1>

      {/* Balance Card */}
      <div className="card bg-gradient-to-r from-whatsapp to-whatsapp-dark text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Available Credits</p>
            <p className="text-4xl font-bold">{balance.credits}</p>
            <p className="text-sm opacity-80 mt-1">1 credit = 1 message | {balance.credits_per_pkr} credits = 1 PKR</p>
          </div>
          <Coins size={48} className="opacity-50" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {['buy', 'requests', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              tab === t ? 'bg-whatsapp text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {t === 'buy' ? 'Buy Credits' : t === 'requests' ? 'My Requests' : 'Transaction History'}
          </button>
        ))}
      </div>

      {/* Buy Credits */}
      {tab === 'buy' && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={20} /> Purchase Credits
          </h2>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">How to buy credits:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Enter the number of credits you want to purchase</li>
              <li>Transfer the PKR amount to our payment account</li>
              <li>Upload your payment receipt (screenshot/photo)</li>
              <li>Admin will verify and approve your credits</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Credits Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                placeholder="e.g., 100"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PKR Amount</label>
              <div className="input-field bg-gray-50 dark:bg-gray-600 flex items-center">
                <span className="text-lg font-bold">Rs. {pkrAmount}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Receipt (JPG/PNG/PDF)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files[0])}
              className="input-field"
            />
            {receiptFile && (
              <p className="text-xs text-gray-500 mt-1">Selected: {receiptFile.name}</p>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
            <Upload size={16} />
            {submitting ? 'Submitting...' : 'Submit Credit Request'}
          </button>
        </form>
      )}

      {/* My Requests */}
      {tab === 'requests' && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">My Credit Requests</h2>
          {requests.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No requests yet</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="font-medium">{r.amount} credits (Rs. {r.pkr_amount})</p>
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
                    {r.admin_note && <p className="text-xs text-gray-500 mt-1">Note: {r.admin_note}</p>}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge[r.status]}`}>
                    {r.status === 'pending' && <Clock size={12} className="inline mr-1" />}
                    {r.status === 'approved' && <CheckCircle size={12} className="inline mr-1" />}
                    {r.status === 'rejected' && <XCircle size={12} className="inline mr-1" />}
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      {tab === 'history' && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="text-sm">{t.description}</p>
                    <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount}
                    </p>
                    <p className="text-xs text-gray-400">Balance: {t.balance_after}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
