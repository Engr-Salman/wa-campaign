import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createCampaignSchema } from "@/server/validators";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      totalRecipients: true,
      sentCount: true,
      openCount: true,
      clickCount: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }
  // Verify sender + template belong to this org.
  const [sender, template] = await Promise.all([
    prisma.senderAccount.findFirst({
      where: { id: parsed.data.senderAccountId, organizationId: user.organizationId },
    }),
    parsed.data.templateId
      ? prisma.template.findFirst({
          where: { id: parsed.data.templateId, organizationId: user.organizationId },
        })
      : Promise.resolve(null),
  ]);
  if (!sender) return NextResponse.json({ error: "sender not found" }, { status: 400 });

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader ?? null,
      senderAccountId: sender.id,
      templateId: template?.id ?? null,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      timezone: parsed.data.timezone,
      abEnabled: parsed.data.abEnabled,
      abSplitPercent: parsed.data.abSplitPercent,
      abWinnerMetric: parsed.data.abWinnerMetric ?? null,
      utmSource: parsed.data.utmSource ?? null,
      utmMedium: parsed.data.utmMedium ?? null,
      utmCampaign: parsed.data.utmCampaign ?? null,
      listTargets: {
        create: parsed.data.listIds.map((listId) => ({ listId })),
      },
      segmentTargets: {
        create: parsed.data.segmentIds.map((segmentId) => ({ segmentId })),
      },
    },
  });
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "campaign.create",
    entity: "campaign",
    entityId: campaign.id,
  });
  return NextResponse.json({ id: campaign.id });
}
