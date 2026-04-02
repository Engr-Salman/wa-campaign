const express = require('express');
const router = express.Router();
const db = require('../db/database');
const sender = require('../whatsapp/sender');
const Papa = require('papaparse');

// Get all campaigns
router.get('/', (req, res) => {
  const campaigns = db.getAllCampaigns();
  res.json(campaigns);
});

// Get single campaign with contacts
router.get('/:id', (req, res) => {
  const campaign = db.getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const contacts = db.getContactsByCampaign(req.params.id);
  const logs = db.getCampaignLogs(req.params.id, 200);
  res.json({ ...campaign, contacts, logs });
});

// Create campaign
router.post('/', (req, res) => {
  const { name, message, media_path, contacts } = req.body;

  if (!name || !message || !contacts || !contacts.length) {
    return res.status(400).json({ error: 'Name, message, and contacts are required' });
  }

  try {
    const campaignId = db.createCampaign(name, message, media_path, contacts.length);
    db.insertContacts(campaignId, contacts);
    const campaign = db.getCampaign(campaignId);
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start campaign
router.post('/:id/start', (req, res) => {
  try {
    sender.startCampaign(parseInt(req.params.id));
    res.json({ status: 'started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post('/:id/pause', (req, res) => {
  sender.pauseCampaign();
  res.json({ status: 'paused' });
});

// Resume campaign
router.post('/:id/resume', (req, res) => {
  sender.resumeCampaign(parseInt(req.params.id));
  res.json({ status: 'resumed' });
});

// Stop campaign
router.post('/:id/stop', (req, res) => {
  sender.stopCampaign();
  res.json({ status: 'stopped' });
});

// Retry failed
router.post('/:id/retry', (req, res) => {
  try {
    sender.retryFailed(parseInt(req.params.id));
    res.json({ status: 'retrying' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a contact from campaign
router.delete('/:campaignId/contacts/:contactId', (req, res) => {
  try {
    db.getDb()
      .prepare('DELETE FROM contacts WHERE id = ? AND campaign_id = ?')
      .run(req.params.contactId, req.params.campaignId);
    db.getDb()
      .prepare(
        'UPDATE campaigns SET total_contacts = total_contacts - 1 WHERE id = ?'
      )
      .run(req.params.campaignId);
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export campaign results as CSV
router.get('/:id/export', (req, res) => {
  const campaign = db.getCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

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
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${campaign.name}_results.csv"`
  );
  res.send(csv);
});

// Get campaign logs
router.get('/:id/logs', (req, res) => {
  const logs = db.getCampaignLogs(req.params.id, 500);
  res.json(logs);
});

module.exports = router;
