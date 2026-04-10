import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { addSuppressionSchema } from "@/server/validators";
import { addSuppression, removeSuppression } from "@/server/services/suppression";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Number(url.searchParams.get("pageSize") ?? 50));
  const [total, entries] = await Promise.all([
    prisma.suppressionEntry.count({ where: { organizationId: user.organizationId } }),
    prisma.suppressionEntry.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);
  return NextResponse.json({ total, page, pageSize, entries });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = addSuppressionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await addSuppression({
    organizationId: user.organizationId,
    email: parsed.data.email,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "suppression.add",
    entity: "suppression",
    metadata: { email: parsed.data.email, reason: parsed.data.reason },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  await removeSuppression(user.organizationId, email);
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "suppression.remove",
    metadata: { email },
  });
  return NextResponse.json({ ok: true });
}
