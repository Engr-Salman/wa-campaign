import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { buildAudienceFilter } from "./contacts";
import { compileSegment } from "./segments";
import { segmentDefinitionSchema } from "@/server/validators";
import { campaignDispatchQueue, emailSendQueue } from "@/server/queue";

// ──────────────────────────────────────────────────────────────────
// Campaign lifecycle
// ──────────────────────────────────────────────────────────────────
//
// 1) materializeRecipients — resolves lists + segments into a deduplicated
//    set of CampaignRecipient rows, each with its own tracking/unsub tokens.
//    Enforces suppression + unsubscribe + hard-bounce filters here AND AGAIN
//    at send time (defense in depth).
//
// 2) launchCampaign — marks the campaign QUEUED and enqueues a single
//    campaign.dispatch job that fans out to per-recipient email.send jobs.
//
// 3) pauseCampaign / resumeCampaign / cancelCampaign — atomic status
//    transitions. The worker checks status before each send and obeys.

export async function materializeRecipients(opts: {
  campaignId: string;
  organizationId: string;
}): Promise<{ count: number }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: opts.campaignId, organizationId: opts.organizationId },
    include: { listTargets: true, segmentTargets: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  // 1. Audience from list targets.
  const listIds = campaign.listTargets.map((t) => t.listId);
  const baseWhere: Prisma.ContactWhereInput = buildAudienceFilter({
    organizationId: opts.organizationId,
    listIds: listIds.length ? listIds : undefined,
  });

  // 2. Audience from segments (merged via OR).
  const segWheres: Prisma.ContactWhereInput[] = [];
  if (campaign.segmentTargets.length) {
    const segments = await prisma.segment.findMany({
      where: { id: { in: campaign.segmentTargets.map((s) => s.segmentId) } },
    });
    for (const seg of segments) {
      const def = segmentDefinitionSchema.parse(seg.definition);
      segWheres.push(compileSegment(def, opts.organizationId));
    }
  }

  const audienceWhere: Prisma.ContactWhereInput = segWheres.length
    ? { AND: [baseWhere, { OR: segWheres }] }
    : baseWhere;

  // 3. Also pull suppression list for an in-memory filter (fast).
  const suppressed = new Set(
    (
      await prisma.suppressionEntry.findMany({
        where: { organizationId: opts.organizationId },
        select: { email: true },
      })
    ).map((s) => s.email),
  );

  // 4. Stream contacts in pages to keep memory flat.
  const pageSize = 2000;
  let cursor: string | undefined;
  let total = 0;
  let created = 0;

  // Pre-fetch variants for A/B weight routing.
  const variants = campaign.abEnabled
    ? await prisma.campaignVariant.findMany({ where: { campaignId: campaign.id } })
    : [];

  const weightSum = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  const pickVariant = (): string | undefined => {
    if (!variants.length || weightSum === 0) return undefined;
    let r = Math.random() * weightSum;
    for (const v of variants) {
      r -= Math.max(0, v.weight);
      if (r <= 0) return v.id;
    }
    return variants[0]!.id;
  };

  while (true) {
    const page: { id: string; email: string }[] = await prisma.contact.findMany({
      where: audienceWhere,
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!page.length) break;
    cursor = page[page.length - 1]!.id;
    total += page.length;

    const filtered = page.filter((c) => !suppressed.has(c.email));
    if (!filtered.length) continue;

    // Insert recipients in bulk, ignoring dedupe conflicts (@@unique on
    // campaignId+contactId guarantees each contact gets exactly one row).
    await prisma.campaignRecipient.createMany({
      data: filtered.map((c) => ({
        campaignId: campaign.id,
        contactId: c.id,
        variantId: pickVariant() ?? null,
        trackingToken: randomToken(18),
        unsubToken: randomToken(18),
      })),
      skipDuplicates: true,
    });
    created += filtered.length;
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { totalRecipients: created },
  });

  logger.info(
    { campaignId: campaign.id, audienceSize: total, recipientsCreated: created },
    "campaign materialized",
  );
  return { count: created };
}

export async function launchCampaign(opts: {
  campaignId: string;
  organizationId: string;
  userId: string;
  runAt?: Date;
}): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: opts.campaignId, organizationId: opts.organizationId },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.senderAccountId) throw new Error("Campaign has no sender account");
  if (!campaign.templateId) throw new Error("Campaign has no template");
  if (campaign.requireConfirmation && !campaign.confirmedAt) {
    throw new Error("Campaign must be confirmed before launch");
  }

  const scheduled = opts.runAt ?? campaign.scheduledAt ?? new Date();
  const delay = Math.max(0, scheduled.getTime() - Date.now());

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: delay > 0 ? "SCHEDULED" : "QUEUED",
      scheduledAt: scheduled,
      confirmedAt: campaign.confirmedAt ?? new Date(),
      confirmedById: opts.userId,
    },
  });

  await campaignDispatchQueue.add(
    "dispatch",
    { campaignId: campaign.id, organizationId: campaign.organizationId },
    { delay, jobId: `dispatch:${campaign.id}` },
  );
}

export async function pauseCampaign(opts: { campaignId: string; organizationId: string }) {
  await prisma.campaign.updateMany({
    where: {
      id: opts.campaignId,
      organizationId: opts.organizationId,
      status: { in: ["QUEUED", "SENDING", "SCHEDULED"] },
    },
    data: { status: "PAUSED" },
  });
}

export async function resumeCampaign(opts: { campaignId: string; organizationId: string }) {
  const c = await prisma.campaign.findFirst({
    where: { id: opts.campaignId, organizationId: opts.organizationId, status: "PAUSED" },
  });
  if (!c) return;
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "QUEUED" } });
  // Re-enqueue pending recipients.
  const pending = await prisma.campaignRecipient.findMany({
    where: { campaignId: c.id, status: { in: ["PENDING", "QUEUED"] } },
    select: { id: true },
  });
  for (const r of pending) {
    await emailSendQueue.add(
      "send",
      { recipientId: r.id, campaignId: c.id, organizationId: c.organizationId },
      { jobId: `send:${r.id}` },
    );
  }
}

export async function cancelCampaign(opts: { campaignId: string; organizationId: string }) {
  await prisma.campaign.updateMany({
    where: {
      id: opts.campaignId,
      organizationId: opts.organizationId,
      status: { in: ["DRAFT", "QUEUED", "SENDING", "PAUSED", "SCHEDULED"] },
    },
    data: { status: "CANCELED", completedAt: new Date() },
  });
}

// Dashboard-friendly summary.
export async function getCampaignSummary(opts: { campaignId: string; organizationId: string }) {
  const c = await prisma.campaign.findFirst({
    where: { id: opts.campaignId, organizationId: opts.organizationId },
    include: { variants: true, listTargets: { include: { list: true } }, senderAccount: true, template: true },
  });
  if (!c) return null;
  const rate = (n: number) => (c.totalRecipients > 0 ? n / c.totalRecipients : 0);
  return {
    ...c,
    metrics: {
      deliveredRate: rate(c.deliveredCount),
      openRate: rate(c.openCount),
      clickRate: rate(c.clickCount),
      bounceRate: rate(c.bounceCount),
      unsubRate: rate(c.unsubCount),
      failureRate: rate(c.failedCount),
    },
  };
}
