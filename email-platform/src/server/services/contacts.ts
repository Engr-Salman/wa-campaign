import { prisma } from "@/lib/db";
import { normalizeEmail, isValidEmail } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

// Upsert a contact within the organization's scope. Deduplicates on email,
// merges attributes, and never reverses an UNSUBSCRIBED status.
export async function upsertContact(opts: {
  organizationId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  attributes?: Record<string, unknown>;
  source?: string | null;
  listIds?: string[];
}): Promise<{ contactId: string; created: boolean }> {
  const email = normalizeEmail(opts.email);
  if (!isValidEmail(email)) throw new Error("Invalid email");

  const existing = await prisma.contact.findUnique({
    where: { organizationId_email: { organizationId: opts.organizationId, email } },
  });

  if (existing) {
    const mergedAttrs = {
      ...((existing.attributes as Record<string, unknown>) ?? {}),
      ...(opts.attributes ?? {}),
    };
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        firstName: opts.firstName ?? existing.firstName,
        lastName: opts.lastName ?? existing.lastName,
        attributes: mergedAttrs as Prisma.InputJsonValue,
        // Preserve unsubscribe/cleaned states. Imports must never revive them.
        // source updates only if previously empty
        source: existing.source ?? opts.source ?? null,
      },
    });
    if (opts.listIds?.length) {
      await addToLists(existing.id, opts.listIds);
    }
    return { contactId: existing.id, created: false };
  }

  const created = await prisma.contact.create({
    data: {
      organizationId: opts.organizationId,
      email,
      firstName: opts.firstName ?? null,
      lastName: opts.lastName ?? null,
      attributes: (opts.attributes ?? {}) as Prisma.InputJsonValue,
      source: opts.source ?? null,
      consentAt: new Date(),
    },
  });
  if (opts.listIds?.length) {
    await addToLists(created.id, opts.listIds);
  }
  return { contactId: created.id, created: true };
}

async function addToLists(contactId: string, listIds: string[]) {
  await prisma.contactListMember.createMany({
    data: listIds.map((listId) => ({ listId, contactId })),
    skipDuplicates: true,
  });
}

// Bulk import entry point. Called from the ImportJob worker OR from the
// API import route for small synchronous imports.
export async function bulkImportContacts(opts: {
  organizationId: string;
  rows: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, unknown>;
    source?: string;
  }>;
  targetListId?: string | null;
}): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: Array<{ row: number; error: string }>;
}> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // Dedupe within the same import.
  const seen = new Set<string>();
  const listIds = opts.targetListId ? [opts.targetListId] : undefined;

  // Suppression set for this org.
  const suppressed = new Set(
    (
      await prisma.suppressionEntry.findMany({
        where: { organizationId: opts.organizationId },
        select: { email: true },
      })
    ).map((s) => s.email),
  );

  for (let i = 0; i < opts.rows.length; i++) {
    const row = opts.rows[i];
    const email = normalizeEmail(row.email ?? "");
    if (!email || !isValidEmail(email)) {
      invalid++;
      errors.push({ row: i + 1, error: "Invalid email" });
      continue;
    }
    if (seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);
    if (suppressed.has(email)) {
      skipped++;
      continue;
    }
    try {
      const res = await upsertContact({
        organizationId: opts.organizationId,
        email,
        firstName: row.firstName,
        lastName: row.lastName,
        attributes: row.attributes,
        source: row.source ?? "import",
        listIds,
      });
      if (res.created) imported++;
      else updated++;
    } catch (e) {
      invalid++;
      errors.push({ row: i + 1, error: (e as Error).message });
    }
  }

  return { imported, updated, skipped, invalid, errors };
}

// Contact-list quality heuristic used to surface pre-send warnings.
export async function assessListQuality(opts: {
  organizationId: string;
  listIds?: string[];
  segmentIds?: string[];
}): Promise<{ score: number; warnings: string[]; totalContacts: number }> {
  const where = buildAudienceFilter(opts);
  const [total, unsub, bounced, complained, stale] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { ...where, status: "UNSUBSCRIBED" } }),
    prisma.contact.count({ where: { ...where, bounceState: { in: ["HARD", "SOFT"] } } }),
    prisma.contact.count({ where: { ...where, status: "COMPLAINED" } }),
    prisma.contact.count({
      where: {
        ...where,
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lt: new Date(Date.now() - 180 * 24 * 3600 * 1000) } },
        ],
      },
    }),
  ]);

  const warnings: string[] = [];
  let score = 100;

  if (total === 0) {
    warnings.push("Selected audience is empty.");
    return { score: 0, warnings, totalContacts: 0 };
  }

  const ratio = (n: number) => (total > 0 ? n / total : 0);

  if (ratio(unsub) > 0.05) {
    warnings.push("More than 5% of selected contacts are unsubscribed — they will be skipped.");
    score -= 10;
  }
  if (ratio(bounced) > 0.02) {
    warnings.push("More than 2% of contacts have recent bounces.");
    score -= 15;
  }
  if (ratio(complained) > 0.001) {
    warnings.push("Some recipients have previously complained — review carefully.");
    score -= 20;
  }
  if (ratio(stale) > 0.5) {
    warnings.push("Over half of the list has not engaged in 180+ days — consider re-engagement.");
    score -= 10;
  }

  return { score: Math.max(0, score), warnings, totalContacts: total };
}

// Helper: build a Prisma `where` clause from list + segment targets.
// (Segment filters handled by src/server/services/segments.ts.)
export function buildAudienceFilter(opts: {
  organizationId: string;
  listIds?: string[];
  segmentIds?: string[];
}): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {
    organizationId: opts.organizationId,
    status: { in: ["SUBSCRIBED"] },
    bounceState: { notIn: ["HARD"] },
  };
  if (opts.listIds?.length) {
    where.listMembers = { some: { listId: { in: opts.listIds } } };
  }
  return where;
}
