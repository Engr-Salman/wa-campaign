import { Queue, QueueEvents } from "bullmq";
import { getBullConnection } from "@/lib/redis";

// Queue definitions. One queue per concern keeps concurrency, retries, and
// priorities independent.
//
// - campaign.dispatch   — turns a Campaign into individual send jobs.
// - email.send          — actually delivers one email via a provider.
// - webhook.ingest      — processes provider webhook events async.

export const QUEUE_NAMES = {
  campaignDispatch: "campaign.dispatch",
  emailSend: "email.send",
  webhookIngest: "webhook.ingest",
} as const;

const connection = getBullConnection();

export const campaignDispatchQueue = new Queue(QUEUE_NAMES.campaignDispatch, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export const emailSendQueue = new Queue(QUEUE_NAMES.emailSend, {
  connection,
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 72 * 3600 },
  },
});

export const webhookIngestQueue = new Queue(QUEUE_NAMES.webhookIngest, {
  connection,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 3600, count: 5000 },
  },
});

// QueueEvents instances — lazy so we don't open extra connections at import
// time inside Next.js server components.
let _sendEvents: QueueEvents | null = null;
export function getEmailSendEvents(): QueueEvents {
  if (!_sendEvents) {
    _sendEvents = new QueueEvents(QUEUE_NAMES.emailSend, { connection: getBullConnection() });
  }
  return _sendEvents;
}

// Job payload types (exported for workers + producers).
export interface CampaignDispatchPayload {
  campaignId: string;
  organizationId: string;
}

export interface EmailSendPayload {
  recipientId: string;
  campaignId: string;
  organizationId: string;
}

export interface WebhookIngestPayload {
  webhookEventId: string;
}
