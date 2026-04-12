import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CreditCard, MessageSquare, TrendingUp,
  DollarSign, AlertCircle, BarChart3, Layers,
} from 'lucide-react';
import { useCampaign } from '../hooks/useCampaign';

export default function AdminDashboard() {
  const { getAdminDashboard, getAdminCreditRequests, getSettings } = useCampaign();
  const [stats, setStats] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [creditRate, setCreditRate] = useState(null);

  useEffect(() => {
    getAdminDashboard().then(setStats).catch(() => {});
    getAdminCreditRequests('pending').then(setPendingRequests).catch(() => {});
    getSettings().then((settings) => setCreditRate(settings.credit_rate_pkr || null)).catch(() => {});
  }, []);

  if (!stats) return <div className="text-center py-10 text-gray-400">Loading...</div>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
    { label: 'Verified Users', value: stats.verifiedUsers, icon: Users, color: 'green' },
    { label: 'Credits Issued', value: stats.totalCreditsIssued, icon: CreditCard, color: 'purple' },
    { label: 'Credits Used', value: stats.totalCreditsUsed, icon: BarChart3, color: 'orange' },
    { label: 'Credits Remaining', value: stats.totalCreditsRemaining, icon: Layers, color: 'teal' },
    { label: 'Revenue (PKR)', value: `Rs. ${stats.totalRevenuePKR}`, icon: DollarSign, color: 'green' },
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: TrendingUp, color: 'indigo' },
    { label: 'Messages Sent', value: stats.totalMessagesSent, icon: MessageSquare, color: 'whatsapp' },
  ];

  const colorMap = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600',
    whatsapp: 'bg-green-100 dark:bg-green-900/30 text-whatsapp',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colorMap[c.color]}`}>
                <c.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-xl font-bold">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Credit Requests */}
      {pendingRequests.length > 0 && (
        <div className="card border-yellow-300 border-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <AlertCircle className="text-yellow-500" size={18} />
              Pending Credit Requests ({pendingRequests.length})
            </h2>
            <Link to="/admin/credits" className="text-sm text-whatsapp hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                <div>
                  <p className="font-medium">{r.user_name} ({r.email})</p>
                  <p className="text-sm text-gray-500">{r.amount} credits - Rs. {r.pkr_amount}</p>
                </div>
                <Link to="/admin/credits" className="btn-primary text-sm py-1">Review</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/admin/users" className="card hover:shadow-md transition-shadow text-center">
          <Users className="mx-auto text-blue-500 mb-2" size={32} />
          <p className="font-bold">Manage Users</p>
          <p className="text-sm text-gray-500">{stats.totalUsers} registered</p>
        </Link>
        <Link to="/admin/credits" className="card hover:shadow-md transition-shadow text-center">
          <CreditCard className="mx-auto text-purple-500 mb-2" size={32} />
          <p className="font-bold">Credit Requests</p>
          <p className="text-sm text-gray-500">{stats.pendingRequests} pending</p>
        </Link>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <p className="font-bold">Credit Price</p>
          <p className="text-sm text-gray-500">
            {creditRate ? `${creditRate} credits per PKR` : 'Set from admin settings'}
          </p>
        </div>
        <Link to="/settings" className="btn-secondary text-sm py-1">
          Update Price
        </Link>
      </div>
    </div>
  );
}
