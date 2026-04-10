import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hasRole } from "@/lib/auth";
import { cancelCampaign } from "@/server/services/campaigns";
import { writeAudit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(user.role, "MANAGER"))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await cancelCampaign({ campaignId: params.id, organizationId: user.organizationId });
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "campaign.cancel",
    entity: "campaign",
    entityId: params.id,
  });
  return NextResponse.json({ ok: true });
}
