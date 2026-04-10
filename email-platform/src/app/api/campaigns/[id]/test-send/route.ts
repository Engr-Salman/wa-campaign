import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { buildProvider } from "@/server/providers";
import { compileTemplate, renderWithMergeTags } from "@/server/services/templates";
import { injectTracking } from "@/server/services/tracking";
import { randomToken } from "@/lib/crypto";

const schema = z.object({ to: z.string().email() });

// Renders + sends a one-off test email to the requester using the campaign's
// sender + template. Tracking links are real (so you can preview opens/clicks
// during QA) but no CampaignRecipient is created.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { senderAccount: true, template: true, organization: true },
  });
  if (!campaign?.senderAccount || !campaign.template) {
    return NextResponse.json({ error: "campaign missing sender or template" }, { status: 400 });
  }

  const compiled = compileTemplate(campaign.template.source, campaign.template.kind);
  const testCtx = {
    first_name: "Test",
    last_name: "User",
    email: parsed.data.to,
    company: "Example Co",
  };
  const html = injectTracking(renderWithMergeTags(compiled.html, testCtx), {
    trackingToken: randomToken(18),
    unsubToken: randomToken(18),
    campaignId: campaign.id,
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
  const subject = `[TEST] ${renderWithMergeTags(campaign.subject, testCtx)}`;

  const provider = buildProvider(campaign.senderAccount);
  const result = await provider.send({
    to: parsed.data.to,
    from: campaign.senderAccount.fromEmail,
    fromName: campaign.senderAccount.fromName,
    subject,
    html,
  });
  if (!result.accepted) {
    return NextResponse.json({ error: result.error ?? "send failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, messageId: result.providerMessageId });
}
