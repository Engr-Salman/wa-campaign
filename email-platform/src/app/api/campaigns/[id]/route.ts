import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getCampaignSummary } from "@/server/services/campaigns";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await getCampaignSummary({
    campaignId: params.id,
    organizationId: user.organizationId,
  });
  if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ campaign: summary });
}
