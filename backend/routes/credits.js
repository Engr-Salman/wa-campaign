const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt_${req.user.id}_${Date.now()}${ext}`);
  },
});

const receiptUpload = multer({
  storage: receiptStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG) and PDF are allowed for receipts'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Get credit balance and rate
router.get('/balance', authMiddleware, (req, res) => {
  const credits = db.getUserCredits(req.user.id);
  const rate = parseInt(db.getSetting('credit_rate_pkr')) || 5;
  res.json({ credits, rate_per_credit: 1, credits_per_pkr: rate });
});

// Get credit transaction history
router.get('/transactions', authMiddleware, (req, res) => {
  const transactions = db.getCreditTransactions(req.user.id, 100);
  res.json(transactions);
});

// Get user's credit requests
router.get('/requests', authMiddleware, (req, res) => {
  const requests = db.getUserCreditRequests(req.user.id);
  res.json(requests);
});

// Request credits with receipt upload
router.post('/request', authMiddleware, receiptUpload.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Payment receipt image is required' });
  }

  const { amount } = req.body;
  const creditAmount = parseInt(amount);
  if (!creditAmount || creditAmount < 1) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid credit amount' });
  }

  try {
    const requestId = db.createCreditRequest(req.user.id, creditAmount, req.file.path);
    res.json({
      message: 'Credit request submitted. Admin will review your payment receipt.',
      requestId,
      amount: creditAmount,
      pkr_amount: creditAmount / 5,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
