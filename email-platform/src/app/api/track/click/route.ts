import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Click redirect. Records the click event and 302-redirects to the
// original URL. Unknown tokens still redirect (if the URL is safe) so the
// user experience doesn't break on tracker failures, but we do NOT allow
// open redirects — URLs must be absolute http(s).
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const dest = url.searchParams.get("u");
    if (!dest || !/^https?:\/\//i.test(dest)) {
      return NextResponse.json({ error: "invalid destination" }, { status: 400 });
    }
    if (!token) return NextResponse.redirect(dest, 302);

    const recipient = await prisma.campaignRecipient.findUnique({ where: { trackingToken: token } });
    if (!recipient) return NextResponse.redirect(dest, 302);

    const first = !recipient.firstClickedAt;
    await prisma.emailEvent.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        contactId: recipient.contactId,
        type: "CLICKED",
        metadata: { url: dest },
      },
    });
    if (first) {
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { firstClickedAt: new Date(), status: "CLICKED" },
        }),
        prisma.campaign.update({
          where: { id: recipient.campaignId },
          data: { clickCount: { increment: 1 } },
        }),
        prisma.contact.update({
          where: { id: recipient.contactId },
          data: { lastClickedAt: new Date(), engagementScore: { increment: 2 } },
        }),
      ]);
    }
    return NextResponse.redirect(dest, 302);
  } catch (e) {
    logger.warn({ err: e }, "click tracking error");
    return NextResponse.redirect("about:blank", 302);
  }
}
