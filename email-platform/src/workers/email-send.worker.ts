import { Worker } from "bullmq";
import { getBullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { QUEUE_NAMES, type EmailSendPayload } from "@/server/queue";
import { buildProvider } from "@/server/providers";
import { compileTemplate, renderWithMergeTags } from "@/server/services/templates";
import {
  injectTracking,
  buildUnsubscribeUrl,
} from "@/server/services/tracking";
import { isSuppressed } from "@/server/services/suppression";

// The email.send worker is the ONLY place that actually hands a message to a
// transport. It is responsible for:
//
//   1. Final safety gates:
//      - campaign must still be in a runnable state (not PAUSED/CANCELED)
//      - recipient must not already be sent (idempotent)
//      - contact must not be suppressed / unsubscribed / hard-bounced
//
//   2. Rendering:
//      - compile template (MJML→HTML) once per campaign could be cached
//        further, but we render per-recipient for correct merge-tag output
//      - inject tracking pixel + click wrappers + unsubscribe footer
//
//   3. Delivery:
//      - instantiate provider from sender account
//      - call provider.send()
//      - record SENT / FAILED and bounce state
//      - update campaign counters atomically
//
//   4. Retries:
//      - transient errors → rely on BullMQ exponential backoff
//      - permanent errors (5xx / suppression) → mark FAILED/BOUNCED and DO NOT retry
export function startEmailSendWorker() {
  const concurrency = env.SEND_WORKER_CONCURRENCY;
  const worker = new Worker<EmailSendPayload>(
    QUEUE_NAMES.emailSend,
    async (job) => {
      const { recipientId, campaignId, organizationId } = job.data;

      // Safety gate: campaign state
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, organizationId },
        include: { senderAccount: true, template: true, organization: true },
      });
      if (!campaign) throw new Error(`campaign ${campaignId} missing`);
      if (["PAUSED", "CANCELED", "COMPLETED", "FAILED"].includes(campaign.status)) {
        logger.info({ campaignId, status: campaign.status }, "skipping send: campaign not running");
        return { skipped: true };
      }
      if (!campaign.senderAccount) throw new Error(`campaign ${campaignId} has no sender`);
      if (!campaign.template) throw new Error(`campaign ${campaignId} has no template`);

      const recipient = await prisma.campaignRecipient.findFirst({
        where: { id: recipientId, campaignId },
        include: { contact: true, variant: { include: { template: true } } },
      });
      if (!recipient) throw new Error(`recipient ${recipientId} missing`);
      if (["SENT", "DELIVERED", "FAILED", "BOUNCED", "UNSUBSCRIBED", "SKIPPED"].includes(recipient.status)) {
        return { skipped: true, reason: "already-terminal" };
      }

      // Final suppression/unsub check (defense in depth).
      const contact = recipient.contact;
      if (
        contact.status === "UNSUBSCRIBED" ||
        contact.status === "COMPLAINED" ||
        contact.status === "CLEANED" ||
        contact.bounceState === "HARD" ||
        (await isSuppressed(organizationId, contact.email))
      ) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SKIPPED", failureReason: "suppressed" },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        return { skipped: true, reason: "suppressed" };
      }

      // Pick template: variant > campaign template.
      const tpl = recipient.variant?.template ?? campaign.template;
      const compiled = compileTemplate(tpl.source, tpl.kind);
      if (compiled.errors.length) {
        logger.warn({ campaignId, errors: compiled.errors }, "template compile warnings");
      }

      // Merge-tag context.
      const ctx = {
        first_name: contact.firstName ?? "",
        last_name: contact.lastName ?? "",
        email: contact.email,
        company: ((contact.attributes as Record<string, unknown>)?.company as string) ?? "",
        ...(contact.attributes as Record<string, unknown>),
      };

      const renderedHtml = renderWithMergeTags(compiled.html, ctx);
      const renderedSubject = renderWithMergeTags(
        recipient.variant?.subject ?? campaign.subject,
        ctx,
      );

      // Tracking injection.
      const finalHtml = injectTracking(renderedHtml, {
        trackingToken: recipient.trackingToken,
        unsubToken: recipient.unsubToken,
        campaignId,
        utm: {
          source: campaign.utmSource ?? undefined,
          medium: campaign.utmMedium ?? undefined,
          campaign: campaign.utmCampaign ?? undefined,
        },
        enforceUnsubFooter: campaign.organization.enforceUnsubFooter,
        footerHtml: campaign.organization.footerHtml,
        orgName: campaign.organization.legalName ?? campaign.organization.name,
        orgAddress:
          [campaign.organization.addressLine1, campaign.organization.city, campaign.organization.country]
            .filter(Boolean)
            .join(", ") || null,
      });

      // Provider delivery.
      const provider = buildProvider(campaign.senderAccount);
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENDING",
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      const result = await provider.send({
        to: contact.email,
        toName: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || undefined,
        from: campaign.senderAccount.fromEmail,
        fromName: campaign.senderAccount.fromName,
        replyTo: campaign.senderAccount.replyTo ?? undefined,
        subject: renderedSubject,
        html: finalHtml,
        listUnsubscribeUrl: buildUnsubscribeUrl(recipient.unsubToken),
        headers: {
          "X-Campaign-Id": campaignId,
          "X-Recipient-Id": recipient.id,
        },
      });

      if (result.accepted) {
        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              messageId: result.providerMessageId,
              snapshotSubject: renderedSubject,
            },
          }),
          prisma.emailEvent.create({
            data: {
              campaignId,
              recipientId: recipient.id,
              contactId: contact.id,
              type: "SENT",
              metadata: { messageId: result.providerMessageId ?? null },
            },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          }),
          prisma.contact.update({
            where: { id: contact.id },
            data: { lastSentAt: new Date() },
          }),
        ]);
        return { sent: true };
      }

      // Error path. Classify and decide whether to retry.
      const isHard = result.bounceState === "HARD";
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: isHard ? "BOUNCED" : "FAILED",
            failureReason: result.error ?? "unknown",
            bouncedAt: isHard ? new Date() : undefined,
          },
        }),
        prisma.emailEvent.create({
          data: {
            campaignId,
            recipientId: recipient.id,
            contactId: contact.id,
            type: isHard ? "BOUNCED" : "FAILED",
            metadata: { error: result.error ?? null, bounceState: result.bounceState ?? null },
          },
        }),
        prisma.campaign.update({
          where: { id: campaignId },
          data: isHard ? { bounceCount: { increment: 1 } } : { failedCount: { increment: 1 } },
        }),
      ]);

      if (isHard) {
        // Hard bounce: mark contact CLEANED + add to suppression list.
        await prisma.contact.update({
          where: { id: contact.id },
          data: { bounceState: "HARD", status: "CLEANED" },
        });
        await prisma.suppressionEntry.upsert({
          where: { organizationId_email: { organizationId, email: contact.email } },
          create: { organizationId, email: contact.email, reason: "BOUNCE_HARD" },
          update: { reason: "BOUNCE_HARD" },
        });
        return { bounced: true };
      }

      // Soft failure → rethrow to let BullMQ retry with backoff.
      throw new Error(result.error ?? "soft failure");
    },
    {
      connection: getBullConnection(),
      concurrency,
      // Global ceiling so we never exceed this many jobs per second across
      // the whole worker instance. Per-sender limits are applied by provider
      // config at connection pool level (e.g. SMTP pool maxConnections).
      limiter: {
        max: env.GLOBAL_MAX_SENDS_PER_SECOND,
        duration: 1000,
      },
    },
  );

  worker.on("failed", (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, "send job failed (will retry if attempts remain)");
  });
  worker.on("completed", async (job, ret) => {
    // When a send completes successfully, check if the campaign is finished.
    if (!ret || (ret as { sent?: boolean }).sent !== true) return;
    const remaining = await prisma.campaignRecipient.count({
      where: {
        campaignId: job.data.campaignId,
        status: { in: ["PENDING", "QUEUED", "SENDING"] },
      },
    });
    if (remaining === 0) {
      await prisma.campaign.updateMany({
        where: { id: job.data.campaignId, status: { in: ["SENDING", "QUEUED"] } },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
  });
  return worker;
}
