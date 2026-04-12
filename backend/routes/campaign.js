const express = require('express');
const router = express.Router();
const db = require('../db/database');
const sender = require('../whatsapp/sender');
const { authMiddleware } = require('../middleware/auth');
const Papa = require('papaparse');
const path = require('path');

// All campaign routes require auth
router.use(authMiddleware);

function getOwnedCampaign(req, res) {
  const campaign = db.getCampaignForUser(req.params.id || req.params.campaignId, req.user.id, req.user.is_admin);
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return null;
  }
  return campaign;
}

// Get user's campaigns
router.get('/', (req, res) => {
  const campaigns = db.getUserCampaigns(req.user.id);
  res.json(campaigns);
});

// Get single campaign with contacts (only if owned by user)
router.get('/:id', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;
  const contacts = db.getContactsByCampaign(req.params.id);
  const logs = db.getCampaignLogs(req.params.id, 200);
  res.json({ ...campaign, contacts, logs });
});

// Create campaign (check credits)
router.post('/', (req, res) => {
  const { name, message, media_path, contacts, source_file_path, source_file_name } = req.body;

  if (!name || !message || !contacts || !contacts.length) {
    return res.status(400).json({ error: 'Name, message, and contacts are required' });
  }

  // Check credit balance — need 1 credit per valid (pending) contact
  const pendingCount = contacts.filter((c) => c.status === 'pending').length;
  const userCredits = db.getUserCredits(req.user.id);

  if (userCredits < pendingCount) {
    return res.status(402).json({
      error: `Insufficient credits. You need ${pendingCount} credits but have ${userCredits}.`,
      required: pendingCount,
      available: userCredits,
    });
  }

  try {
    const campaignId = db.createCampaign(
      req.user.id,
      name,
      message,
      media_path,
      contacts.length,
      source_file_path || null,
      source_file_name || null
    );
    db.insertContacts(campaignId, contacts);
    const campaign = db.getCampaign(campaignId);
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start campaign
router.post('/:id/start', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;

  // Check credits before starting
  const pendingContacts = db.getPendingContacts(campaign.id);
  const userCredits = db.getUserCredits(campaign.user_id);
  if (userCredits < pendingContacts.length) {
    return res.status(402).json({
      error: `Insufficient credits. Need ${pendingContacts.length}, have ${userCredits}.`,
    });
  }

  try {
    sender.startCampaign(parseInt(req.params.id), campaign.user_id);
    res.json({ status: 'started' });
  } catch (err) {
    const status = err.message.includes('already active') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Pause campaign
router.post('/:id/pause', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;
  const paused = sender.pauseCampaign(parseInt(req.params.id), req.user.id, req.user.is_admin);
  if (!paused) {
    return res.status(409).json({ error: 'Campaign is not currently active' });
  }
  res.json({ status: 'paused' });
});

// Resume campaign
router.post('/:id/resume', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;

  try {
    sender.resumeCampaign(parseInt(req.params.id), campaign.user_id);
    res.json({ status: 'resumed' });
  } catch (err) {
    const status = err.message.includes('already active') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Stop campaign
router.post('/:id/stop', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;
  const stopped = sender.stopCampaign(parseInt(req.params.id), req.user.id, req.user.is_admin);
  if (!stopped) {
    return res.status(409).json({ error: 'Campaign is not currently active' });
  }
  res.json({ status: 'stopped' });
});

// Retry failed
router.post('/:id/retry', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;
  try {
    sender.retryFailed(parseInt(req.params.id), campaign.user_id);
    res.json({ status: 'retrying' });
  } catch (err) {
    const status = err.message.includes('already active') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Delete a contact from campaign
router.delete('/:campaignId/contacts/:contactId', (req, res) => {
  try {
    const campaign = getOwnedCampaign(req, res);
    if (!campaign) return;
    if (campaign.status === 'running') {
      return res.status(409).json({ error: 'Cannot delete contacts while campaign is running' });
    }

    const result = db.deleteContactFromCampaign(req.params.campaignId, req.params.contactId);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export campaign results as CSV
router.get('/:id/export', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;

  const contacts = db.getContactsByCampaign(req.params.id);
  const csvData = contacts.map((c) => ({
    phone_number: c.phone_number,
    name: c.name,
    custom_field_1: c.custom_field_1,
    custom_field_2: c.custom_field_2,
    status: c.status,
    error_message: c.error_message || '',
    sent_at: c.sent_at || '',
  }));

  const csv = Papa.unparse(csvData);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}_results.csv"`);
  res.send(csv);
});

router.get('/:id/source-file', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;

  const file = db.getCampaignSourceFile(req.params.id);
  if (!file || !file.source_file_path) {
    return res.status(404).json({ error: 'Source file not found' });
  }

  res.download(file.source_file_path, file.source_file_name || path.basename(file.source_file_path));
});

// Get campaign logs
router.get('/:id/logs', (req, res) => {
  const campaign = getOwnedCampaign(req, res);
  if (!campaign) return;
  const logs = db.getCampaignLogs(req.params.id, 500);
  res.json(logs);
});

module.exports = router;
