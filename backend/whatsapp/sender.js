const waClient = require('./client');
const rateLimiter = require('../utils/rateLimiter');
const db = require('../db/database');

let activeCampaign = null;
let isPaused = false;
let isStopped = false;
let io = null;

function setIo(socketIo) {
  io = socketIo;
}

function getActiveCampaign() {
  return activeCampaign;
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

async function startCampaign(campaignId) {
  const campaign = db.getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  if (waClient.getConnectionStatus() !== 'connected') {
    throw new Error('WhatsApp not connected');
  }

  activeCampaign = campaignId;
  isPaused = false;
  isStopped = false;

  db.updateCampaignStatus(campaignId, 'running');
  io.emit('campaign:status', { campaignId, status: 'running' });

  const contacts = db.getPendingContacts(campaignId);
  const startTime = Date.now();
  let sentInSession = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (isStopped) {
      db.updateCampaignStatus(campaignId, 'stopped');
      io.emit('campaign:status', { campaignId, status: 'stopped' });
      break;
    }

    while (isPaused) {
      await sleep(1000);
      if (isStopped) break;
    }
    if (isStopped) {
      db.updateCampaignStatus(campaignId, 'stopped');
      io.emit('campaign:status', { campaignId, status: 'stopped' });
      break;
    }

    const contact = contacts[i];

    // Skip invalid/skipped contacts
    if (contact.status === 'invalid' || contact.status === 'skipped') {
      continue;
    }

    // Rate limiting
    const rateCheck = rateLimiter.getDelay();
    if (rateCheck.delay === -1) {
      // Daily limit reached
      isPaused = true;
      io.emit('campaign:rate_limit', {
        campaignId,
        reason: rateCheck.reason,
        resumeAt: null,
      });
      db.updateCampaignStatus(campaignId, 'paused');
      io.emit('campaign:status', { campaignId, status: 'paused' });
      break;
    }

    if (rateCheck.delay > 0) {
      io.emit('campaign:rate_limit', {
        campaignId,
        reason: rateCheck.reason,
        delay: rateCheck.delay,
        resumeAt: rateCheck.resumeAt,
      });
      await sleep(rateCheck.delay);
    }

    // Send message
    const message = personalizeMessage(campaign.message, contact);

    try {
      await waClient.sendMessage(contact.phone_number, message, campaign.media_path);
      db.updateContactStatus(contact.id, 'sent', null);
      rateLimiter.recordSend();
      sentInSession++;

      db.addLog(campaignId, contact.id, contact.phone_number, 'sent', null);
      io.emit('campaign:message_sent', {
        campaignId,
        contactId: contact.id,
        phone: contact.phone_number,
        status: 'sent',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const maxRetries = rateLimiter.getSettings().maxRetries;

      if (contact.retry_count < maxRetries) {
        db.incrementContactRetry(contact.id);
        // Exponential backoff: 30s, 60s
        const retryDelay = Math.pow(2, contact.retry_count) * 30000;
        io.emit('campaign:message_retry', {
          campaignId,
          contactId: contact.id,
          phone: contact.phone_number,
          retryIn: retryDelay,
          attempt: contact.retry_count + 1,
        });
        await sleep(retryDelay);

        // Retry
        try {
          await waClient.sendMessage(
            contact.phone_number,
            message,
            campaign.media_path
          );
          db.updateContactStatus(contact.id, 'sent', null);
          rateLimiter.recordSend();
          sentInSession++;
          db.addLog(campaignId, contact.id, contact.phone_number, 'sent', null);
          io.emit('campaign:message_sent', {
            campaignId,
            contactId: contact.id,
            phone: contact.phone_number,
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        } catch (retryErr) {
          db.updateContactStatus(contact.id, 'failed', retryErr.message);
          db.addLog(
            campaignId,
            contact.id,
            contact.phone_number,
            'failed',
            retryErr.message
          );
          io.emit('campaign:message_failed', {
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
        db.addLog(
          campaignId,
          contact.id,
          contact.phone_number,
          'failed',
          err.message
        );
        io.emit('campaign:message_failed', {
          campaignId,
          contactId: contact.id,
          phone: contact.phone_number,
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update counts and emit progress
    db.updateCampaignCounts(campaignId);
    const updatedCampaign = db.getCampaign(campaignId);
    const elapsed = Date.now() - startTime;
    const rate = sentInSession / (elapsed / 1000); // messages per second
    const remaining =
      updatedCampaign.total_contacts -
      updatedCampaign.sent_count -
      updatedCampaign.failed_count -
      updatedCampaign.skipped_count;
    const eta = rate > 0 ? remaining / rate : 0;

    io.emit('campaign:progress', {
      campaignId,
      sent: updatedCampaign.sent_count,
      failed: updatedCampaign.failed_count,
      skipped: updatedCampaign.skipped_count,
      total: updatedCampaign.total_contacts,
      eta: Math.round(eta),
      rate: Math.round(rate * 100) / 100,
    });
  }

  // Check if completed
  if (!isStopped && !isPaused) {
    db.updateCampaignCounts(campaignId);
    db.updateCampaignStatus(campaignId, 'completed');
    io.emit('campaign:status', { campaignId, status: 'completed' });
  }

  activeCampaign = null;
}

function pauseCampaign() {
  if (activeCampaign) {
    isPaused = true;
    db.updateCampaignStatus(activeCampaign, 'paused');
    io.emit('campaign:status', {
      campaignId: activeCampaign,
      status: 'paused',
    });
  }
}

function resumeCampaign(campaignId) {
  isPaused = false;
  if (!activeCampaign) {
    // Restart from pending
    startCampaign(campaignId);
  }
}

function stopCampaign() {
  isStopped = true;
}

async function retryFailed(campaignId) {
  const failed = db.getFailedContacts(campaignId);
  for (const contact of failed) {
    db.updateContactStatus(contact.id, 'pending', null);
  }
  // Reset retry counts
  const dbInstance = db.getDb();
  dbInstance
    .prepare(
      "UPDATE contacts SET retry_count = 0 WHERE campaign_id = ? AND status = 'pending'"
    )
    .run(campaignId);

  return startCampaign(campaignId);
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
