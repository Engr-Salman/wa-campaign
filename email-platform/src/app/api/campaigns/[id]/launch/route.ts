import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hasRole } from "@/lib/auth";
import { launchCampaign } from "@/server/services/campaigns";
import { writeAudit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(user.role, "MANAGER"))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await launchCampaign({
      campaignId: params.id,
      organizationId: user.organizationId,
      userId: user.id,
    });
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign.launch",
      entity: "campaign",
      entityId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
