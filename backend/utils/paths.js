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
const fs = require('fs');

// Default: two directories up from backend/utils/ → project root.
function resolveDataRoot() {
  if (process.env.DATA_ROOT) {
    return path.resolve(process.env.DATA_ROOT);
  }

  const railwayDefault = '/data';
  if ((process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) && fs.existsSync(railwayDefault)) {
    return railwayDefault;
  }

  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
    console.warn('[paths] Railway detected without DATA_ROOT or mounted /data volume. Runtime data will not persist across redeploys.');
  }

  return path.join(__dirname, '..', '..');
}

const DATA_ROOT = resolveDataRoot();

const DB_PATH       = path.join(DATA_ROOT, 'data.db');
const UPLOADS_DIR   = path.join(DATA_ROOT, 'uploads');
const RECEIPTS_DIR  = path.join(DATA_ROOT, 'uploads', 'receipts');
const WWEBJS_DIR    = path.join(DATA_ROOT, '.wwebjs_auth');

for (const dir of [DATA_ROOT, UPLOADS_DIR, RECEIPTS_DIR, WWEBJS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { DATA_ROOT, DB_PATH, UPLOADS_DIR, RECEIPTS_DIR, WWEBJS_DIR };
