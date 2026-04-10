import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addSuppression } from "@/server/services/suppression";

// One-click unsubscribe endpoint used by the List-Unsubscribe-Post header.
// RFC 8058 requires POST, but we also accept GET from the unsubscribe page
// form submission.
export async function POST(req: Request) {
  const body = await req.formData().catch(() => null);
  const token = (body?.get("token") as string | null) ?? new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { unsubToken: token },
    include: { contact: true, campaign: true },
  });
  if (!recipient) return NextResponse.json({ ok: true }); // generic to prevent enumeration

  await addSuppression({
    organizationId: recipient.campaign.organizationId,
    email: recipient.contact.email,
    reason: "UNSUBSCRIBE",
    note: `campaign=${recipient.campaignId}`,
  });

  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    }),
    prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: { unsubCount: { increment: 1 } },
    }),
    prisma.emailEvent.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        contactId: recipient.contactId,
        type: "UNSUBSCRIBED",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
