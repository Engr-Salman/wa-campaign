/**
 * Centralised runtime data paths.
 *
 * All mutable data (database, uploads, WhatsApp sessions) lives under
 * DATA_ROOT so that a single persistent volume covers everything.
 *
 * Local dev  : DATA_ROOT is not set → falls back to the repo root.
 * Railway    : set DATA_ROOT=/data and mount a Railway volume at /data.
 * Hostinger  : set DATA_ROOT to the writable project directory.
 */

const path = require('path');

// Default: two directories up from backend/utils/ → project root.
const DATA_ROOT = process.env.DATA_ROOT
  ? path.resolve(process.env.DATA_ROOT)
  : path.join(__dirname, '..', '..');

const DB_PATH       = path.join(DATA_ROOT, 'data.db');
const UPLOADS_DIR   = path.join(DATA_ROOT, 'uploads');
const RECEIPTS_DIR  = path.join(DATA_ROOT, 'uploads', 'receipts');
const WWEBJS_DIR    = path.join(DATA_ROOT, '.wwebjs_auth');

module.exports = { DATA_ROOT, DB_PATH, UPLOADS_DIR, RECEIPTS_DIR, WWEBJS_DIR };
