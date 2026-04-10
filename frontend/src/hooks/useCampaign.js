import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useCampaign() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api${url}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const getCampaigns = () => request('/campaigns');
  const getCampaign = (id) => request(`/campaigns/${id}`);
  const createCampaign = (data) =>
    request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
  const startCampaign = (id) =>
    request(`/campaigns/${id}/start`, { method: 'POST' });
  const pauseCampaign = (id) =>
    request(`/campaigns/${id}/pause`, { method: 'POST' });
  const resumeCampaign = (id) =>
    request(`/campaigns/${id}/resume`, { method: 'POST' });
  const stopCampaign = (id) =>
    request(`/campaigns/${id}/stop`, { method: 'POST' });
  const retryCampaign = (id) =>
    request(`/campaigns/${id}/retry`, { method: 'POST' });
  const deleteContact = (campaignId, contactId) =>
    request(`/campaigns/${campaignId}/contacts/${contactId}`, { method: 'DELETE' });
  const getSettings = () => request('/settings');
  const updateSettings = (data) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) });
  const getStats = () => request('/settings/stats');

  const uploadContacts = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authFetch('/api/contacts/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  };

  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append('media', file);
    const res = await authFetch('/api/contacts/upload-media', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  };

  // Credit-related
  const getCreditBalance = () => request('/credits/balance');
  const getCreditTransactions = () => request('/credits/transactions');
  const getCreditRequests = () => request('/credits/requests');
  const requestCredits = async (amount, receiptFile) => {
    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('receipt', receiptFile);
    const res = await authFetch('/api/credits/request', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  // Admin
  const getAdminDashboard = () => request('/admin/dashboard');
  const getAdminUsers = () => request('/admin/users');
  const getAdminUser = (id) => request(`/admin/users/${id}`);
  const addUserCredits = (userId, amount, note) =>
    request(`/admin/users/${userId}/add-credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    });
  const getAdminCreditRequests = (status) =>
    request(`/admin/credit-requests${status ? `?status=${status}` : ''}`);
  const processCreditRequest = (id, status, admin_note) =>
    request(`/admin/credit-requests/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status, admin_note }),
    });

  return {
    loading, error,
    getCampaigns, getCampaign, createCampaign,
    startCampaign, pauseCampaign, resumeCampaign, stopCampaign, retryCampaign,
    deleteContact, getSettings, updateSettings, getStats,
    uploadContacts, uploadMedia,
    getCreditBalance, getCreditTransactions, getCreditRequests, requestCredits,
    getAdminDashboard, getAdminUsers, getAdminUser, addUserCredits,
    getAdminCreditRequests, processCreditRequest,
  };
}
