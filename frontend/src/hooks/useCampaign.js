import { useState, useCallback } from 'react';

const API = '/api';

export function useCampaign() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

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
    request(`/campaigns/${campaignId}/contacts/${contactId}`, {
      method: 'DELETE',
    });
  const getSettings = () => request('/settings');
  const updateSettings = (data) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) });
  const getStats = () => request('/settings/stats');
  const uploadContacts = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/contacts/upload`, {
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
    const res = await fetch(`${API}/contacts/upload-media`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  };

  return {
    loading,
    error,
    getCampaigns,
    getCampaign,
    createCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    retryCampaign,
    deleteContact,
    getSettings,
    updateSettings,
    getStats,
    uploadContacts,
    uploadMedia,
  };
}
