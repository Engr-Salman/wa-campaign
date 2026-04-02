const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all settings
router.get('/', (req, res) => {
  const settings = db.getAllSettings();
  res.json(settings);
});

// Update settings
router.put('/', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    db.setSetting(key, value);
  }
  res.json(db.getAllSettings());
});

// Get dashboard stats
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({
    today: db.getDailyStats(today),
    weekly: db.getWeeklyStats(),
    allTime: db.getAllTimeStats(),
  });
});

module.exports = router;
