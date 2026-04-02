const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      media_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      name TEXT DEFAULT '',
      custom_field_1 TEXT DEFAULT '',
      custom_field_2 TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      sent_at TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      contact_id INTEGER,
      phone_number TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      messages_sent INTEGER DEFAULT 0
    );
  `);

  // Insert default settings if not exists
  const defaults = {
    messages_per_minute: '5',
    messages_per_hour: '60',
    messages_per_day: '200',
    delay_min: '10',
    delay_max: '20',
    cooldown_after: '20',
    cooldown_min: '120',
    cooldown_max: '300',
    max_retries: '2',
    default_template: '',
    theme: 'light',
    auto_resume: 'false',
  };

  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }
}

// Settings helpers
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// Campaign helpers
function createCampaign(name, message, mediaPath, totalContacts) {
  const result = getDb()
    .prepare(
      'INSERT INTO campaigns (name, message, media_path, total_contacts) VALUES (?, ?, ?, ?)'
    )
    .run(name, message, mediaPath || null, totalContacts);
  return result.lastInsertRowid;
}

function getCampaign(id) {
  return getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

function getAllCampaigns() {
  return getDb()
    .prepare('SELECT * FROM campaigns ORDER BY created_at DESC')
    .all();
}

function updateCampaignStatus(id, status) {
  const updates = { status };
  if (status === 'running') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'stopped')
    updates.completed_at = new Date().toISOString();

  const sets = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updates);
  getDb()
    .prepare(`UPDATE campaigns SET ${sets} WHERE id = ?`)
    .run(...values, id);
}

function updateCampaignCounts(id) {
  const stats = getDb()
    .prepare(
      `SELECT
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status IN ('skipped', 'invalid') THEN 1 END) as skipped_count
      FROM contacts WHERE campaign_id = ?`
    )
    .get(id);

  getDb()
    .prepare(
      'UPDATE campaigns SET sent_count = ?, failed_count = ?, skipped_count = ? WHERE id = ?'
    )
    .run(stats.sent_count, stats.failed_count, stats.skipped_count, id);
}

// Contact helpers
function insertContacts(campaignId, contacts) {
  const insert = getDb().prepare(
    'INSERT INTO contacts (campaign_id, phone_number, name, custom_field_1, custom_field_2, status) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertMany = getDb().transaction((contacts) => {
    for (const c of contacts) {
      insert.run(
        campaignId,
        c.phone_number,
        c.name || '',
        c.custom_field_1 || '',
        c.custom_field_2 || '',
        c.status || 'pending'
      );
    }
  });

  insertMany(contacts);
}

function getContactsByCampaign(campaignId) {
  return getDb()
    .prepare('SELECT * FROM contacts WHERE campaign_id = ? ORDER BY id')
    .all(campaignId);
}

function getPendingContacts(campaignId) {
  return getDb()
    .prepare(
      "SELECT * FROM contacts WHERE campaign_id = ? AND status = 'pending' ORDER BY id"
    )
    .all(campaignId);
}

function getFailedContacts(campaignId) {
  return getDb()
    .prepare(
      "SELECT * FROM contacts WHERE campaign_id = ? AND status = 'failed' ORDER BY id"
    )
    .all(campaignId);
}

function updateContactStatus(id, status, errorMessage) {
  const sentAt = status === 'sent' ? new Date().toISOString() : null;
  getDb()
    .prepare(
      'UPDATE contacts SET status = ?, error_message = ?, sent_at = COALESCE(?, sent_at) WHERE id = ?'
    )
    .run(status, errorMessage || null, sentAt, id);
}

function incrementContactRetry(id) {
  getDb()
    .prepare('UPDATE contacts SET retry_count = retry_count + 1 WHERE id = ?')
    .run(id);
}

// Log helpers
function addLog(campaignId, contactId, phoneNumber, status, errorMessage) {
  getDb()
    .prepare(
      'INSERT INTO message_log (campaign_id, contact_id, phone_number, status, error_message) VALUES (?, ?, ?, ?, ?)'
    )
    .run(campaignId, contactId, phoneNumber, status, errorMessage || null);
}

function getCampaignLogs(campaignId, limit = 100) {
  return getDb()
    .prepare(
      'SELECT * FROM message_log WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT ?'
    )
    .all(campaignId, limit);
}

// Daily stats
function incrementDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  getDb()
    .prepare(
      `INSERT INTO daily_stats (date, messages_sent) VALUES (?, 1)
       ON CONFLICT(date) DO UPDATE SET messages_sent = messages_sent + 1`
    )
    .run(today);
}

function getDailyStats(date) {
  const row = getDb()
    .prepare('SELECT * FROM daily_stats WHERE date = ?')
    .get(date);
  return row ? row.messages_sent : 0;
}

function getWeeklyStats() {
  const rows = getDb()
    .prepare(
      "SELECT SUM(messages_sent) as total FROM daily_stats WHERE date >= date('now', '-7 days')"
    )
    .get();
  return rows ? rows.total || 0 : 0;
}

function getAllTimeStats() {
  const rows = getDb()
    .prepare('SELECT SUM(messages_sent) as total FROM daily_stats')
    .get();
  return rows ? rows.total || 0 : 0;
}

module.exports = {
  getDb,
  getSetting,
  setSetting,
  getAllSettings,
  createCampaign,
  getCampaign,
  getAllCampaigns,
  updateCampaignStatus,
  updateCampaignCounts,
  insertContacts,
  getContactsByCampaign,
  getPendingContacts,
  getFailedContacts,
  updateContactStatus,
  incrementContactRetry,
  addLog,
  getCampaignLogs,
  incrementDailyStats,
  getDailyStats,
  getWeeklyStats,
  getAllTimeStats,
};
