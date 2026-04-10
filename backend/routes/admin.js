const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All admin routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin dashboard stats
router.get('/dashboard', (req, res) => {
  const stats = db.getAdminDashboardStats();
  res.json(stats);
});

// Get all users
router.get('/users', (req, res) => {
  const users = db.getAllUsers();
  // Add campaign count and total messages for each user
  const enriched = users.map((u) => {
    const campaigns = db.getDb().prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(sent_count), 0) as total_sent FROM campaigns WHERE user_id = ?'
    ).get(u.id);
    return {
      ...u,
      campaign_count: campaigns.count,
      total_messages_sent: campaigns.total_sent,
    };
  });
  res.json(enriched);
});

// Get single user detail
router.get('/users/:id', (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const campaigns = db.getUserCampaigns(req.params.id);
  const creditRequests = db.getUserCreditRequests(req.params.id);
  const transactions = db.getCreditTransactions(req.params.id, 100);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    is_verified: user.is_verified,
    is_admin: user.is_admin,
    credits: user.credits,
    created_at: user.created_at,
    last_login: user.last_login,
    campaigns,
    creditRequests,
    transactions,
  });
});

// Manually add credits to a user
router.post('/users/:id/add-credits', (req, res) => {
  const { amount, note } = req.body;
  const creditAmount = parseInt(amount);
  if (!creditAmount || creditAmount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const newBalance = db.addCredits(
    parseInt(req.params.id),
    creditAmount,
    note || `Manual credit addition by admin`
  );
  res.json({ message: 'Credits added', balance: newBalance });
});

// Get all credit requests (optionally filter by status)
router.get('/credit-requests', (req, res) => {
  const { status } = req.query;
  const requests = db.getCreditRequests(status || null);
  res.json(requests);
});

// Process (approve/reject) a credit request
router.post('/credit-requests/:id/process', (req, res) => {
  const { status, admin_note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const result = db.processCreditRequest(
    parseInt(req.params.id),
    status,
    admin_note,
    req.user.id
  );

  if (!result) return res.status(404).json({ error: 'Request not found' });
  res.json({ message: `Request ${status}`, request: result });
});

// Serve receipt images
router.get('/receipts/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', '..', 'uploads', 'receipts', req.params.filename);
  res.sendFile(filePath);
});

// Get all campaigns (admin view)
router.get('/campaigns', (req, res) => {
  const campaigns = db.getAllCampaigns();
  res.json(campaigns);
});

module.exports = router;
