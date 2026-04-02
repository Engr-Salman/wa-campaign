const db = require('../db/database');

class RateLimiter {
  constructor() {
    this.minuteTimestamps = [];
    this.hourTimestamps = [];
    this.batchCount = 0;
    this.paused = false;
    this.pauseUntil = null;
  }

  getSettings() {
    return {
      messagesPerMinute: parseInt(db.getSetting('messages_per_minute')) || 5,
      messagesPerHour: parseInt(db.getSetting('messages_per_hour')) || 60,
      messagesPerDay: parseInt(db.getSetting('messages_per_day')) || 200,
      delayMin: parseInt(db.getSetting('delay_min')) || 10,
      delayMax: parseInt(db.getSetting('delay_max')) || 20,
      cooldownAfter: parseInt(db.getSetting('cooldown_after')) || 20,
      cooldownMin: parseInt(db.getSetting('cooldown_min')) || 120,
      cooldownMax: parseInt(db.getSetting('cooldown_max')) || 300,
      maxRetries: parseInt(db.getSetting('max_retries')) || 2,
    };
  }

  /**
   * Returns delay in ms before next message can be sent, or 0 if ready.
   * Returns -1 if daily limit reached.
   */
  getDelay() {
    const settings = this.getSettings();
    const now = Date.now();

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailySent = db.getDailyStats(today);
    if (dailySent >= settings.messagesPerDay) {
      return { delay: -1, reason: 'daily_limit', resumeAt: null };
    }

    // Clean old timestamps
    this.minuteTimestamps = this.minuteTimestamps.filter(
      (t) => now - t < 60000
    );
    this.hourTimestamps = this.hourTimestamps.filter(
      (t) => now - t < 3600000
    );

    // Check per-minute limit
    if (this.minuteTimestamps.length >= settings.messagesPerMinute) {
      const waitUntil = this.minuteTimestamps[0] + 60000;
      return {
        delay: waitUntil - now,
        reason: 'minute_limit',
        resumeAt: waitUntil,
      };
    }

    // Check per-hour limit
    if (this.hourTimestamps.length >= settings.messagesPerHour) {
      const waitUntil = this.hourTimestamps[0] + 3600000;
      return {
        delay: waitUntil - now,
        reason: 'hour_limit',
        resumeAt: waitUntil,
      };
    }

    // Check cooldown after N messages
    if (
      this.batchCount > 0 &&
      this.batchCount % settings.cooldownAfter === 0
    ) {
      const cooldownMs =
        (settings.cooldownMin +
          Math.random() * (settings.cooldownMax - settings.cooldownMin)) *
        1000;
      this.batchCount++; // increment so we don't re-trigger
      return {
        delay: cooldownMs,
        reason: 'cooldown',
        resumeAt: now + cooldownMs,
      };
    }

    // Calculate randomized delay between messages
    const delaySeconds =
      settings.delayMin +
      Math.random() * (settings.delayMax - settings.delayMin);
    return { delay: delaySeconds * 1000, reason: 'normal', resumeAt: null };
  }

  recordSend() {
    const now = Date.now();
    this.minuteTimestamps.push(now);
    this.hourTimestamps.push(now);
    this.batchCount++;
    db.incrementDailyStats();
  }

  reset() {
    this.minuteTimestamps = [];
    this.hourTimestamps = [];
    this.batchCount = 0;
    this.paused = false;
    this.pauseUntil = null;
  }
}

module.exports = new RateLimiter();
