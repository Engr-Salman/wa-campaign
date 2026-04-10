import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { resumeCampaign } from "@/server/services/campaigns";
import { writeAudit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await resumeCampaign({ campaignId: params.id, organizationId: user.organizationId });
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "campaign.resume",
    entity: "campaign",
    entityId: params.id,
  });
  return NextResponse.json({ ok: true });
}
