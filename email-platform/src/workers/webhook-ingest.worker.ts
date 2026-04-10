import { Worker } from "bullmq";
import { getBullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { QUEUE_NAMES, type WebhookIngestPayload } from "@/server/queue";
import { addSuppression } from "@/server/services/suppression";

// Processes provider callbacks (bounces, complaints, deliveries, etc.)
// normalized into our EmailEventType taxonomy.
//
// The HTTP endpoint (`/api/webhooks/provider`) MUST verify the signature
// and MUST only persist to WebhookEvent + enqueue this job. All business
// logic lives here.
export function startWebhookIngestWorker() {
  const worker = new Worker<WebhookIngestPayload>(
    QUEUE_NAMES.webhookIngest,
    async (job) => {
      const { webhookEventId } = job.data;
      const wh = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
      if (!wh || wh.processedAt) return;

      const payload = wh.payload as Record<string, unknown>;
      const eventType = String(payload.type ?? wh.eventType ?? "").toLowerCase();
      const email = String(payload.email ?? "").toLowerCase();
      const campaignId = (payload.campaign_id as string | undefined) ?? null;
      const messageId = (payload.message_id as string | undefined) ?? null;

      if (!email) {
        await prisma.webhookEvent.update({
          where: { id: wh.id },
          data: { processedAt: new Date(), error: "missing email" },
        });
        return;
      }

      const contact = await prisma.contact.findUnique({
        where: { organizationId_email: { organizationId: wh.organizationId, email } },
      });
      if (!contact) {
        await prisma.webhookEvent.update({
          where: { id: wh.id },
          data: { processedAt: new Date(), error: "contact not found" },
        });
        return;
      }

      // Resolve recipient (optional).
      let recipient = null;
      if (messageId) {
        recipient = await prisma.campaignRecipient.findFirst({
          where: { messageId },
        });
      }

      switch (eventType) {
        case "delivered":
          await prisma.emailEvent.create({
            data: {
              campaignId: campaignId ?? recipient?.campaignId ?? null,
              recipientId: recipient?.id ?? null,
              contactId: contact.id,
              type: "DELIVERED",
              metadata: payload,
            },
          });
          if (recipient) {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "DELIVERED", deliveredAt: new Date() },
            });
            await prisma.campaign.update({
              where: { id: recipient.campaignId },
              data: { deliveredCount: { increment: 1 } },
            });
          }
          break;
        case "bounce":
        case "hard_bounce":
          await addSuppression({
            organizationId: wh.organizationId,
            email,
            reason: "BOUNCE_HARD",
            note: "provider webhook",
          });
          if (recipient) {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "BOUNCED", bouncedAt: new Date() },
            });
            await prisma.campaign.update({
              where: { id: recipient.campaignId },
              data: { bounceCount: { increment: 1 } },
            });
          }
          break;
        case "complaint":
        case "spam":
          await addSuppression({
            organizationId: wh.organizationId,
            email,
            reason: "COMPLAINT",
            note: "provider webhook",
          });
          if (recipient) {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "COMPLAINED", complainedAt: new Date() },
            });
            await prisma.campaign.update({
              where: { id: recipient.campaignId },
              data: { complaintCount: { increment: 1 } },
            });
          }
          break;
        case "unsubscribe":
          await addSuppression({
            organizationId: wh.organizationId,
            email,
            reason: "UNSUBSCRIBE",
          });
          if (recipient) {
            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
            });
            await prisma.campaign.update({
              where: { id: recipient.campaignId },
              data: { unsubCount: { increment: 1 } },
            });
          }
          break;
        default:
          logger.info({ eventType }, "ignoring webhook event type");
      }

      await prisma.webhookEvent.update({
        where: { id: wh.id },
        data: { processedAt: new Date() },
      });
    },
    { connection: getBullConnection(), concurrency: 5 },
  );
  worker.on("failed", (job, err) => {
    logger.error({ id: job?.id, err }, "webhook ingest failed");
  });
  return worker;
}
