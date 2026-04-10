import { Worker } from "bullmq";
import { getBullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import {
  QUEUE_NAMES,
  emailSendQueue,
  type CampaignDispatchPayload,
} from "@/server/queue";
import { materializeRecipients } from "@/server/services/campaigns";

// Fans out a Campaign into individual email.send jobs.
//
// Idempotency guarantees:
// - `materializeRecipients` uses createMany with skipDuplicates, so calling
//   it twice is safe.
// - Each send job is enqueued with a deterministic `jobId = send:<recipientId>`,
//   so BullMQ will de-duplicate any concurrent attempts.
//
// If the campaign is no longer in a runnable state at dispatch time
// (e.g. PAUSED, CANCELED) we exit cleanly without enqueuing any jobs.
export function startCampaignDispatchWorker() {
  const worker = new Worker<CampaignDispatchPayload>(
    QUEUE_NAMES.campaignDispatch,
    async (job) => {
      const { campaignId, organizationId } = job.data;
      logger.info({ campaignId }, "dispatching campaign");

      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, organizationId },
      });
      if (!campaign) {
        logger.warn({ campaignId }, "campaign missing at dispatch time");
        return { dispatched: 0 };
      }
      if (["PAUSED", "CANCELED", "FAILED", "COMPLETED"].includes(campaign.status)) {
        logger.info({ campaignId, status: campaign.status }, "skipping dispatch");
        return { dispatched: 0 };
      }

      // Materialize (safe to re-run).
      await materializeRecipients({ campaignId, organizationId });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "SENDING", startedAt: new Date() },
      });

      // Enqueue per-recipient jobs in batches.
      const batchSize = 500;
      let cursor: string | undefined;
      let dispatched = 0;
      while (true) {
        const batch = await prisma.campaignRecipient.findMany({
          where: { campaignId, status: "PENDING" },
          select: { id: true },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!batch.length) break;
        cursor = batch[batch.length - 1]!.id;

        await emailSendQueue.addBulk(
          batch.map((r) => ({
            name: "send",
            data: { recipientId: r.id, campaignId, organizationId },
            opts: { jobId: `send:${r.id}` },
          })),
        );
        await prisma.campaignRecipient.updateMany({
          where: { id: { in: batch.map((b) => b.id) } },
          data: { status: "QUEUED" },
        });
        dispatched += batch.length;
      }

      logger.info({ campaignId, dispatched }, "campaign dispatched");
      return { dispatched };
    },
    { connection: getBullConnection(), concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "campaign dispatch failed");
  });
  return worker;
}
