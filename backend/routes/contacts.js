const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseCSV, parseExcel } = require('../utils/csvParser');
const { authMiddleware } = require('../middleware/auth');
const { UPLOADS_DIR: uploadsDir } = require('../utils/paths');

router.use(authMiddleware);

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const contactsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `contacts_${req.user.id}_${Date.now()}${ext}`);
  },
});

const contactsUpload = multer({
  storage: contactsStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `media_${req.user.id}_${Date.now()}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
      '.pdf',
      '.mp4', '.avi', '.mov', '.mkv', '.3gp',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: images, PDF, video'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for media
});

// Upload and parse contacts file
router.post('/upload', contactsUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result;

    if (ext === '.csv') {
      result = parseCSV(req.file.path);
    } else {
      result = parseExcel(req.file.path);
    }

    res.json({
      ...result,
      sourceFile: {
        path: req.file.path,
        filename: req.file.filename,
        originalName: req.file.originalname,
      },
    });
  } catch (err) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Upload media file
router.post('/upload-media', mediaUpload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ path: req.file.path, filename: req.file.filename });
});

module.exports = router;
