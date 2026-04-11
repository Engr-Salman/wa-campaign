const waClient = require('./client');
const { RateLimiter } = require('../utils/rateLimiter');
const db = require('../db/database');

const activeRunsByCampaign = new Map();
const activeCampaignByUser = new Map();
let io = null;

function setIo(socketIo) {
  io = socketIo;
}

function getRun(campaignId) {
  return activeRunsByCampaign.get(campaignId) || null;
}

function getActiveCampaign(campaignId) {
  if (campaignId) {
    const run = getRun(campaignId);
    return run ? { campaignId: run.campaignId, userId: run.userId, status: run.status } : null;
  }

  return Array.from(activeRunsByCampaign.values()).map((run) => ({
    campaignId: run.campaignId,
    userId: run.userId,
    status: run.status,
  }));
}

function emitToCampaignUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function createRun(campaignId, userId) {
  const run = {
    campaignId,
    userId,
    status: 'running',
    isPaused: false,
    isStopped: false,
    rateLimiter: new RateLimiter(),
  };

  activeRunsByCampaign.set(campaignId, run);
  activeCampaignByUser.set(userId, campaignId);
  return run;
}

function clearRun(campaignId) {
  const run = getRun(campaignId);
  if (!run) return;

  run.rateLimiter.reset();
  activeRunsByCampaign.delete(campaignId);
  if (activeCampaignByUser.get(run.userId) === campaignId) {
    activeCampaignByUser.delete(run.userId);
  }
}

function personalizeMessage(template, contact) {
  return template
    .replace(/\{\{name\}\}/gi, contact.name || '')
    .replace(/\{\{custom_field_1\}\}/gi, contact.custom_field_1 || '')
    .replace(/\{\{custom_field_2\}\}/gi, contact.custom_field_2 || '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startCampaign(campaignId, userId) {
  const campaign = db.getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const existingRun = getRun(campaignId);
  if (existingRun?.status === 'running') {
    throw new Error('Campaign is already running');
  }

  const otherCampaignId = activeCampaignByUser.get(userId);
  if (otherCampaignId && otherCampaignId !== campaignId) {
    throw new Error(`Campaign #${otherCampaignId} is already active for this user`);
  }

  const waStatus = waClient.getConnectionStatus(userId);
  if (waStatus !== 'connected') {
    throw new Error('WhatsApp not connected');
  }

  const run = existingRun || createRun(campaignId, userId);
  run.status = 'running';
  run.isPaused = false;
  run.isStopped = false;

  db.updateCampaignStatus(campaignId, 'running');
  emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'running' });

  const contacts = db.getPendingContacts(campaignId);
  const startTime = Date.now();
  let sentInSession = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (run.isStopped) {
      db.updateCampaignStatus(campaignId, 'stopped');
      emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'stopped' });
      clearRun(campaignId);
      return;
    }

    while (run.isPaused) {
      await sleep(1000);
      if (run.isStopped) break;
    }

    if (run.isStopped) {
      db.updateCampaignStatus(campaignId, 'stopped');
      emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'stopped' });
      clearRun(campaignId);
      return;
    }

    const contact = contacts[i];
    if (contact.status === 'invalid' || contact.status === 'skipped') {
      continue;
    }

    const userCredits = db.getUserCredits(userId);
    if (userCredits < 1) {
      run.isPaused = true;
      run.status = 'paused';
      emitToCampaignUser(userId, 'campaign:rate_limit', {
        campaignId,
        reason: 'no_credits',
        delay: 0,
        resumeAt: null,
      });
      db.updateCampaignStatus(campaignId, 'paused');
      emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'paused' });
      return;
    }

    const rateCheck = run.rateLimiter.getDelay();
    if (rateCheck.delay === -1) {
      run.isPaused = true;
      run.status = 'paused';
      emitToCampaignUser(userId, 'campaign:rate_limit', {
        campaignId,
        reason: rateCheck.reason,
        resumeAt: null,
      });
      db.updateCampaignStatus(campaignId, 'paused');
      emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'paused' });
      return;
    }

    if (rateCheck.delay > 0) {
      emitToCampaignUser(userId, 'campaign:rate_limit', {
        campaignId,
        reason: rateCheck.reason,
        delay: rateCheck.delay,
        resumeAt: rateCheck.resumeAt,
      });
      await sleep(rateCheck.delay);
    }

    const message = personalizeMessage(campaign.message, contact);

    try {
      await waClient.sendMessage(userId, contact.phone_number, message, campaign.media_path);

      db.deductCredits(userId, 1, `Campaign "${campaign.name}" - ${contact.phone_number}`, campaignId);
      db.incrementCampaignCreditsUsed(campaignId);
      db.updateContactStatus(contact.id, 'sent', null);
      run.rateLimiter.recordSend();
      sentInSession++;

      db.addLog(campaignId, contact.id, contact.phone_number, 'sent', null);
      emitToCampaignUser(userId, 'campaign:message_sent', {
        campaignId,
        contactId: contact.id,
        phone: contact.phone_number,
        status: 'sent',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const maxRetries = run.rateLimiter.getSettings().maxRetries;

      if (contact.retry_count < maxRetries) {
        db.incrementContactRetry(contact.id);
        const retryDelay = Math.pow(2, contact.retry_count) * 30000;
        emitToCampaignUser(userId, 'campaign:message_retry', {
          campaignId,
          contactId: contact.id,
          phone: contact.phone_number,
          retryIn: retryDelay,
          attempt: contact.retry_count + 1,
        });
        await sleep(retryDelay);

        try {
          await waClient.sendMessage(userId, contact.phone_number, message, campaign.media_path);

          db.deductCredits(userId, 1, `Campaign "${campaign.name}" - ${contact.phone_number}`, campaignId);
          db.incrementCampaignCreditsUsed(campaignId);
          db.updateContactStatus(contact.id, 'sent', null);
          run.rateLimiter.recordSend();
          sentInSession++;

          db.addLog(campaignId, contact.id, contact.phone_number, 'sent', null);
          emitToCampaignUser(userId, 'campaign:message_sent', {
            campaignId,
            contactId: contact.id,
            phone: contact.phone_number,
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        } catch (retryErr) {
          db.updateContactStatus(contact.id, 'failed', retryErr.message);
          db.addLog(campaignId, contact.id, contact.phone_number, 'failed', retryErr.message);
          emitToCampaignUser(userId, 'campaign:message_failed', {
            campaignId,
            contactId: contact.id,
            phone: contact.phone_number,
            status: 'failed',
            error: retryErr.message,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        db.updateContactStatus(contact.id, 'failed', err.message);
        db.addLog(campaignId, contact.id, contact.phone_number, 'failed', err.message);
        emitToCampaignUser(userId, 'campaign:message_failed', {
          campaignId,
          contactId: contact.id,
          phone: contact.phone_number,
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    db.updateCampaignCounts(campaignId);
    const updatedCampaign = db.getCampaign(campaignId);
    const elapsed = Date.now() - startTime;
    const rate = sentInSession / Math.max(elapsed / 1000, 1);
    const remaining =
      updatedCampaign.total_contacts -
      updatedCampaign.sent_count -
      updatedCampaign.failed_count -
      updatedCampaign.skipped_count;
    const eta = rate > 0 ? remaining / rate : 0;

    emitToCampaignUser(userId, 'campaign:progress', {
      campaignId,
      sent: updatedCampaign.sent_count,
      failed: updatedCampaign.failed_count,
      skipped: updatedCampaign.skipped_count,
      total: updatedCampaign.total_contacts,
      eta: Math.round(eta),
      rate: Math.round(rate * 100) / 100,
    });
  }

  db.updateCampaignCounts(campaignId);
  db.updateCampaignStatus(campaignId, 'completed');
  emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'completed' });
  clearRun(campaignId);
}

function pauseCampaign(campaignId, userId, isAdmin = false) {
  const run = getRun(campaignId);
  if (!run) return false;
  if (!isAdmin && run.userId !== userId) return false;

  run.isPaused = true;
  run.status = 'paused';
  db.updateCampaignStatus(campaignId, 'paused');
  emitToCampaignUser(run.userId, 'campaign:status', { campaignId, status: 'paused' });
  return true;
}

function resumeCampaign(campaignId, userId) {
  const run = getRun(campaignId);
  if (!run) {
    return startCampaign(campaignId, userId);
  }

  if (run.userId !== userId) {
    throw new Error('Campaign belongs to another user');
  }

  run.isPaused = false;
  run.status = 'running';
  db.updateCampaignStatus(campaignId, 'running');
  emitToCampaignUser(userId, 'campaign:status', { campaignId, status: 'running' });
  return true;
}

function stopCampaign(campaignId, userId, isAdmin = false) {
  const run = getRun(campaignId);
  if (!run) return false;
  if (!isAdmin && run.userId !== userId) return false;

  run.isStopped = true;
  return true;
}

async function retryFailed(campaignId, userId) {
  const failed = db.getFailedContacts(campaignId);
  for (const contact of failed) {
    db.updateContactStatus(contact.id, 'pending', null);
  }
  db.getDb()
    .prepare("UPDATE contacts SET retry_count = 0 WHERE campaign_id = ? AND status = 'pending'")
    .run(campaignId);

  return startCampaign(campaignId, userId);
}

module.exports = {
  setIo,
  getActiveCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  retryFailed,
};
