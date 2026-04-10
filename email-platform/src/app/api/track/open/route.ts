import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// 1x1 transparent GIF (43 bytes).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// Always responds 200 with a pixel — even on errors — so mail clients don't
// retry or mark the message broken. Writes an OPEN event and advances per-
// recipient + campaign counters only on the FIRST open.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (!token) return pixel();

    const recipient = await prisma.campaignRecipient.findUnique({
      where: { trackingToken: token },
    });
    if (!recipient) return pixel();

    const first = !recipient.firstOpenedAt;
    const ua = req.headers.get("user-agent") ?? undefined;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;

    await prisma.emailEvent.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        contactId: recipient.contactId,
        type: "OPENED",
        metadata: { ua, ip },
      },
    });

    if (first) {
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { firstOpenedAt: new Date(), status: "OPENED" },
        }),
        prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: { openCount: { increment: 1 } },
        }),
        prisma.contact.update({
          where: { id: recipient.contactId },
          data: {
            lastOpenedAt: new Date(),
            engagementScore: { increment: 1 },
          },
        }),
      ]);
    }
  } catch (e) {
    logger.warn({ err: e }, "open tracking error");
  }
  return pixel();
}

function pixel() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
