import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { assessListQuality } from "@/server/services/contacts";

// Pre-launch audit: size + quality heuristics shown on the review step
// of the campaign wizard.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { listTargets: true, segmentTargets: true },
  });
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  const quality = await assessListQuality({
    organizationId: user.organizationId,
    listIds: campaign.listTargets.map((t) => t.listId),
    segmentIds: campaign.segmentTargets.map((t) => t.segmentId),
  });
  return NextResponse.json(quality);
}
