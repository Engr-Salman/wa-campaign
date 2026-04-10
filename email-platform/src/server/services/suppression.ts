import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";

// Suppression list is the single source of truth for "never send to this
// address". It is enforced at audience-materialization AND again at
// per-message send time.
export async function addSuppression(opts: {
  organizationId: string;
  email: string;
  reason: "UNSUBSCRIBE" | "BOUNCE_HARD" | "COMPLAINT" | "MANUAL" | "IMPORT";
  note?: string | null;
}): Promise<void> {
  const email = normalizeEmail(opts.email);
  await prisma.suppressionEntry.upsert({
    where: { organizationId_email: { organizationId: opts.organizationId, email } },
    create: {
      organizationId: opts.organizationId,
      email,
      reason: opts.reason,
      note: opts.note ?? null,
    },
    update: { reason: opts.reason, note: opts.note ?? null },
  });
  // Mirror to contact status so segments and audience filters pick it up.
  await prisma.contact.updateMany({
    where: { organizationId: opts.organizationId, email },
    data: {
      status:
        opts.reason === "UNSUBSCRIBE"
          ? "UNSUBSCRIBED"
          : opts.reason === "COMPLAINT"
            ? "COMPLAINED"
            : opts.reason === "BOUNCE_HARD"
              ? "CLEANED"
              : undefined,
      bounceState: opts.reason === "BOUNCE_HARD" ? "HARD" : undefined,
    },
  });
}

export async function isSuppressed(
  organizationId: string,
  email: string,
): Promise<boolean> {
  const hit = await prisma.suppressionEntry.findUnique({
    where: { organizationId_email: { organizationId, email: normalizeEmail(email) } },
    select: { id: true },
  });
  return !!hit;
}

export async function removeSuppression(organizationId: string, email: string): Promise<void> {
  const e = normalizeEmail(email);
  await prisma.suppressionEntry.deleteMany({ where: { organizationId, email: e } });
}
