const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');
const { DB_PATH } = require('../utils/paths');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH, {
      enableForeignKeyConstraints: true,
    });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      is_verified INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_expires TEXT,
      password_reset_code TEXT,
      password_reset_expires TEXT,
      credits INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS credit_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      pkr_amount REAL NOT NULL,
      receipt_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT,
      processed_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      reference_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      media_path TEXT,
      source_file_path TEXT,
      source_file_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      credits_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

  // Migrate: add user_id to campaigns if missing
  try {
    db.prepare("SELECT user_id FROM campaigns LIMIT 1").get();
  } catch {
    try { db.exec("ALTER TABLE campaigns ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE campaigns ADD COLUMN credits_used INTEGER DEFAULT 0"); } catch {}
  }
  try { db.prepare("SELECT source_file_path FROM campaigns LIMIT 1").get(); } catch { try { db.exec("ALTER TABLE campaigns ADD COLUMN source_file_path TEXT"); } catch {} }
  try { db.prepare("SELECT source_file_name FROM campaigns LIMIT 1").get(); } catch { try { db.exec("ALTER TABLE campaigns ADD COLUMN source_file_name TEXT"); } catch {} }
  try { db.prepare("SELECT password_reset_code FROM users LIMIT 1").get(); } catch { try { db.exec("ALTER TABLE users ADD COLUMN password_reset_code TEXT"); } catch {} }
  try { db.prepare("SELECT password_reset_expires FROM users LIMIT 1").get(); } catch { try { db.exec("ALTER TABLE users ADD COLUMN password_reset_expires TEXT"); } catch {} }

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
    credit_rate_pkr: '5',
  };

  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }

  // Create default admin if none exists
  const adminExists = db.prepare("SELECT id FROM users WHERE is_admin = 1").get();
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      "INSERT OR IGNORE INTO users (email, password_hash, name, is_verified, is_admin) VALUES (?, ?, ?, 1, 1)"
    ).run('admin@admin.com', hash, 'Super Admin');
    console.log('Default admin created: admin@admin.com / admin123');
  }
}

// ==================== Settings ====================
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// ==================== Users ====================
function createUser(email, passwordHash, name) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const starterCredits = 250;
  const result = getDb().prepare(
    'INSERT INTO users (email, password_hash, name, verification_code, verification_expires, credits) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(email, passwordHash, name, code, expires, starterCredits);
  const userId = Number(result.lastInsertRowid);
  getDb().prepare(
    'INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, 'credit', starterCredits, starterCredits, 'Starter credits for new account', null);
  return { id: userId, verification_code: code };
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function verifyUser(email, code) {
  const user = getUserByEmail(email);
  if (!user) return { success: false, error: 'User not found' };
  if (user.is_verified) return { success: false, error: 'Already verified' };
  if (user.verification_code !== code) return { success: false, error: 'Invalid code' };
  if (new Date(user.verification_expires) < new Date()) return { success: false, error: 'Code expired' };
  getDb().prepare('UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?').run(user.id);
  return { success: true };
}

function resendVerification(email) {
  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  getDb().prepare('UPDATE users SET verification_code = ?, verification_expires = ? WHERE email = ?').run(code, expires, email);
  return code;
}

function createPasswordReset(email) {
  const user = getUserByEmail(email);
  if (!user) return null;

  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  getDb().prepare(
    'UPDATE users SET password_reset_code = ?, password_reset_expires = ? WHERE id = ?'
  ).run(code, expires, user.id);

  return { user, code };
}

function resetPassword(email, code, passwordHash) {
  const user = getUserByEmail(email);
  if (!user) return { success: false, error: 'User not found' };
  if (!user.password_reset_code || !user.password_reset_expires) {
    return { success: false, error: 'No password reset requested' };
  }
  if (user.password_reset_code !== code) {
    return { success: false, error: 'Invalid reset code' };
  }
  if (new Date(user.password_reset_expires) < new Date()) {
    return { success: false, error: 'Reset code expired' };
  }

  getDb().prepare(
    `UPDATE users
     SET password_hash = ?, password_reset_code = NULL, password_reset_expires = NULL
     WHERE id = ?`
  ).run(passwordHash, user.id);

  return { success: true, user: getUserById(user.id) };
}

function updateLastLogin(id) {
  getDb().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);
}

function getAllUsers() {
  return getDb().prepare('SELECT id, email, name, is_verified, is_admin, credits, created_at, last_login FROM users ORDER BY created_at DESC').all();
}

function getUserCount() {
  return getDb().prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count;
}

// ==================== Credits ====================
function getUserCredits(userId) {
  const row = getDb().prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  return row ? row.credits : 0;
}

function addCredits(userId, amount, description, referenceId) {
  const current = getUserCredits(userId);
  const newBalance = current + amount;
  getDb().prepare('UPDATE users SET credits = ? WHERE id = ?').run(newBalance, userId);
  getDb().prepare(
    'INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, 'credit', amount, newBalance, description, referenceId || null);
  return newBalance;
}

function deductCredits(userId, amount, description, referenceId) {
  const current = getUserCredits(userId);
  if (current < amount) return { success: false, balance: current };
  const newBalance = current - amount;
  getDb().prepare('UPDATE users SET credits = ? WHERE id = ?').run(newBalance, userId);
  getDb().prepare(
    'INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, 'debit', -amount, newBalance, description, referenceId || null);
  return { success: true, balance: newBalance };
}

function getCreditTransactions(userId, limit = 50) {
  return getDb().prepare(
    'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit);
}

// ==================== Credit Requests ====================
function createCreditRequest(userId, amount, receiptPath) {
  const rate = parseInt(getSetting('credit_rate_pkr')) || 5;
  const pkrAmount = amount / rate;
  const result = getDb().prepare(
    'INSERT INTO credit_requests (user_id, amount, pkr_amount, receipt_path) VALUES (?, ?, ?, ?)'
  ).run(userId, amount, pkrAmount, receiptPath);
  return Number(result.lastInsertRowid);
}

function getCreditRequests(status) {
  let query = `SELECT cr.*, u.email, u.name as user_name, u.credits as user_credits
    FROM credit_requests cr JOIN users u ON cr.user_id = u.id`;
  if (status) {
    query += ` WHERE cr.status = ?`;
    query += ' ORDER BY cr.created_at DESC';
    return getDb().prepare(query).all(status);
  }
  query += ' ORDER BY cr.created_at DESC';
  return getDb().prepare(query).all();
}

function getCreditRequestById(requestId) {
  return getDb().prepare(
    `SELECT cr.*, u.email, u.name as user_name, u.credits as user_credits
     FROM credit_requests cr
     JOIN users u ON cr.user_id = u.id
     WHERE cr.id = ?`
  ).get(requestId);
}

function getUserCreditRequests(userId) {
  return getDb().prepare(
    'SELECT * FROM credit_requests WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}

function processCreditRequest(requestId, status, adminNote, adminId) {
  const request = getDb().prepare('SELECT * FROM credit_requests WHERE id = ?').get(requestId);
  if (!request) return null;

  getDb().prepare(
    "UPDATE credit_requests SET status = ?, admin_note = ?, processed_at = datetime('now'), processed_by = ? WHERE id = ?"
  ).run(status, adminNote || null, adminId, requestId);

  if (status === 'approved') {
    addCredits(request.user_id, request.amount, `Credit purchase approved (Request #${requestId})`, requestId);
  }

  return getDb().prepare('SELECT * FROM credit_requests WHERE id = ?').get(requestId);
}

// ==================== Campaigns (user-scoped) ====================
function createCampaign(userId, name, message, mediaPath, totalContacts, sourceFilePath = null, sourceFileName = null) {
  const result = getDb().prepare(
    'INSERT INTO campaigns (user_id, name, message, media_path, source_file_path, source_file_name, total_contacts) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, name, message, mediaPath || null, sourceFilePath, sourceFileName, totalContacts);
  return Number(result.lastInsertRowid);
}

function getCampaign(id) {
  return getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

function getCampaignForUser(id, userId, isAdmin = false) {
  if (isAdmin) {
    return getCampaign(id);
  }
  return getDb().prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(id, userId);
}

function getUserCampaigns(userId) {
  return getDb().prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function getAllCampaigns() {
  return getDb().prepare(
    `SELECT c.*, u.email as user_email, u.name as user_name
     FROM campaigns c LEFT JOIN users u ON c.user_id = u.id
     ORDER BY c.created_at DESC`
  ).all();
}

function getCampaignSourceFile(campaignId) {
  return getDb().prepare('SELECT id, user_id, source_file_path, source_file_name FROM campaigns WHERE id = ?').get(campaignId);
}

function updateCampaignStatus(id, status) {
  const updates = { status };
  if (status === 'running') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'stopped') updates.completed_at = new Date().toISOString();
  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  getDb().prepare(`UPDATE campaigns SET ${sets} WHERE id = ?`).run(...values, id);
}

function updateCampaignCounts(id) {
  const stats = getDb().prepare(
    `SELECT
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
      COUNT(CASE WHEN status IN ('skipped', 'invalid') THEN 1 END) as skipped_count
    FROM contacts WHERE campaign_id = ?`
  ).get(id);
  getDb().prepare(
    'UPDATE campaigns SET sent_count = ?, failed_count = ?, skipped_count = ? WHERE id = ?'
  ).run(stats.sent_count, stats.failed_count, stats.skipped_count, id);
}

function incrementCampaignCreditsUsed(campaignId) {
  getDb().prepare('UPDATE campaigns SET credits_used = credits_used + 1 WHERE id = ?').run(campaignId);
}

function recoverInterruptedCampaigns() {
  return getDb()
    .prepare("UPDATE campaigns SET status = 'paused' WHERE status = 'running'")
    .run().changes;
}

// ==================== Contacts ====================
function insertContacts(campaignId, contacts) {
  const database = getDb();
  const insert = database.prepare(
    'INSERT INTO contacts (campaign_id, phone_number, name, custom_field_1, custom_field_2, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  database.exec('BEGIN');
  try {
    for (const c of contacts) {
      insert.run(campaignId, c.phone_number, c.name || '', c.custom_field_1 || '', c.custom_field_2 || '', c.status || 'pending');
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function getContactsByCampaign(campaignId) {
  return getDb().prepare('SELECT * FROM contacts WHERE campaign_id = ? ORDER BY id').all(campaignId);
}

function getPendingContacts(campaignId) {
  return getDb().prepare("SELECT * FROM contacts WHERE campaign_id = ? AND status = 'pending' ORDER BY id").all(campaignId);
}

function getFailedContacts(campaignId) {
  return getDb().prepare("SELECT * FROM contacts WHERE campaign_id = ? AND status = 'failed' ORDER BY id").all(campaignId);
}

function updateContactStatus(id, status, errorMessage) {
  const sentAt = status === 'sent' ? new Date().toISOString() : null;
  getDb().prepare(
    'UPDATE contacts SET status = ?, error_message = ?, sent_at = COALESCE(?, sent_at) WHERE id = ?'
  ).run(status, errorMessage || null, sentAt, id);
}

function incrementContactRetry(id) {
  getDb().prepare('UPDATE contacts SET retry_count = retry_count + 1 WHERE id = ?').run(id);
}

function deleteContactFromCampaign(campaignId, contactId) {
  const existing = getDb()
    .prepare('SELECT id FROM contacts WHERE id = ? AND campaign_id = ?')
    .get(contactId, campaignId);

  if (!existing) {
    return { deleted: false };
  }

  getDb().prepare('DELETE FROM contacts WHERE id = ? AND campaign_id = ?').run(contactId, campaignId);
  getDb().prepare(
    'UPDATE campaigns SET total_contacts = (SELECT COUNT(*) FROM contacts WHERE campaign_id = ?) WHERE id = ?'
  ).run(campaignId, campaignId);
  updateCampaignCounts(campaignId);

  return { deleted: true };
}

// ==================== Logs ====================
function addLog(campaignId, contactId, phoneNumber, status, errorMessage) {
  getDb().prepare(
    'INSERT INTO message_log (campaign_id, contact_id, phone_number, status, error_message) VALUES (?, ?, ?, ?, ?)'
  ).run(campaignId, contactId, phoneNumber, status, errorMessage || null);
}

function getCampaignLogs(campaignId, limit = 100) {
  return getDb().prepare(
    'SELECT * FROM message_log WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(campaignId, limit);
}

// ==================== Daily Stats ====================
function incrementDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  getDb().prepare(
    `INSERT INTO daily_stats (date, messages_sent) VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET messages_sent = messages_sent + 1`
  ).run(today);
}

function getDailyStats(date) {
  const row = getDb().prepare('SELECT * FROM daily_stats WHERE date = ?').get(date);
  return row ? row.messages_sent : 0;
}

function getWeeklyStats() {
  const rows = getDb().prepare("SELECT SUM(messages_sent) as total FROM daily_stats WHERE date >= date('now', '-7 days')").get();
  return rows ? rows.total || 0 : 0;
}

function getAllTimeStats() {
  const rows = getDb().prepare('SELECT SUM(messages_sent) as total FROM daily_stats').get();
  return rows ? rows.total || 0 : 0;
}

// ==================== Admin Stats ====================
function getAdminDashboardStats() {
  const d = getDb();
  const totalUsers = d.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin = 0").get().c;
  const verifiedUsers = d.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin = 0 AND is_verified = 1").get().c;
  const totalCreditsIssued = d.prepare("SELECT COALESCE(SUM(amount), 0) as c FROM credit_transactions WHERE type = 'credit'").get().c;
  const totalCreditsUsed = d.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as c FROM credit_transactions WHERE type = 'debit'").get().c;
  const pendingRequests = d.prepare("SELECT COUNT(*) as c FROM credit_requests WHERE status = 'pending'").get().c;
  const totalRevenuePKR = d.prepare("SELECT COALESCE(SUM(pkr_amount), 0) as c FROM credit_requests WHERE status = 'approved'").get().c;
  const totalCampaigns = d.prepare("SELECT COUNT(*) as c FROM campaigns").get().c;
  const totalMessagesSent = d.prepare("SELECT COALESCE(SUM(sent_count), 0) as c FROM campaigns").get().c;

  return {
    totalUsers,
    verifiedUsers,
    totalCreditsIssued,
    totalCreditsUsed,
    totalCreditsRemaining: totalCreditsIssued - totalCreditsUsed,
    pendingRequests,
    totalRevenuePKR,
    totalCampaigns,
    totalMessagesSent,
  };
}

function getUserMessageStats(userId) {
  const dbConn = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weeklyThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const todayStats = dbConn.prepare(
    `SELECT COUNT(*) as total
     FROM contacts ct
     JOIN campaigns c ON c.id = ct.campaign_id
     WHERE c.user_id = ? AND ct.status = 'sent' AND substr(ct.sent_at, 1, 10) = ?`
  ).get(userId, today);

  const weeklyStats = dbConn.prepare(
    `SELECT COUNT(*) as total
     FROM contacts ct
     JOIN campaigns c ON c.id = ct.campaign_id
     WHERE c.user_id = ? AND ct.status = 'sent' AND ct.sent_at >= ?`
  ).get(userId, weeklyThreshold);

  const allTimeStats = dbConn.prepare(
    `SELECT COUNT(*) as total
     FROM contacts ct
     JOIN campaigns c ON c.id = ct.campaign_id
     WHERE c.user_id = ? AND ct.status = 'sent'`
  ).get(userId);

  return {
    today: todayStats?.total || 0,
    weekly: weeklyStats?.total || 0,
    allTime: allTimeStats?.total || 0,
  };
}

module.exports = {
  getDb,
  getSetting, setSetting, getAllSettings,
  createUser, getUserByEmail, getUserById, verifyUser, resendVerification, createPasswordReset, resetPassword, updateLastLogin, getAllUsers, getUserCount,
  getUserCredits, addCredits, deductCredits, getCreditTransactions,
  createCreditRequest, getCreditRequests, getCreditRequestById, getUserCreditRequests, processCreditRequest,
  createCampaign, getCampaign, getCampaignForUser, getUserCampaigns, getAllCampaigns,
  getCampaignSourceFile,
  updateCampaignStatus, updateCampaignCounts, incrementCampaignCreditsUsed, recoverInterruptedCampaigns,
  insertContacts, getContactsByCampaign, getPendingContacts, getFailedContacts,
  updateContactStatus, incrementContactRetry, deleteContactFromCampaign,
  addLog, getCampaignLogs,
  incrementDailyStats, getDailyStats, getWeeklyStats, getAllTimeStats,
  getAdminDashboardStats, getUserMessageStats,
};
