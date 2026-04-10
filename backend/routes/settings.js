const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get all settings
router.get('/', (req, res) => {
  const settings = db.getAllSettings();
  res.json(settings);
});

// Update settings (admin only)
router.put('/', (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    db.setSetting(key, value);
  }
  res.json(db.getAllSettings());
});

// Get dashboard stats for current user
router.get('/stats', (req, res) => {
  const userStats = db.getDb().prepare(
    'SELECT COUNT(*) as total_campaigns FROM campaigns WHERE user_id = ?'
  ).get(req.user.id);
  const messageStats = db.getUserMessageStats(req.user.id);

  res.json({
    today: messageStats.today,
    weekly: messageStats.weekly,
    allTime: messageStats.allTime,
    totalCampaigns: userStats.total_campaigns,
    credits: db.getUserCredits(req.user.id),
  });
});

module.exports = router;
