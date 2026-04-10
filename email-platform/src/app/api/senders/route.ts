import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hasRole } from "@/lib/auth";
import { encryptJson } from "@/lib/crypto";
import { createSenderSchema } from "@/server/validators";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const senders = await prisma.senderAccount.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      fromName: true,
      fromEmail: true,
      replyTo: true,
      maxPerSecond: true,
      maxPerMinute: true,
      maxPerHour: true,
      maxPerDay: true,
      dailySentCount: true,
      lastError: true,
      lastVerifiedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ senders });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasRole(user.role, "ADMIN"))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }

  const configBlob = encryptJson(parsed.data.config);
  const sender = await prisma.senderAccount.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      fromName: parsed.data.fromName,
      fromEmail: parsed.data.fromEmail,
      replyTo: parsed.data.replyTo || null,
      configEncrypted: configBlob,
      maxPerSecond: parsed.data.maxPerSecond,
      maxPerMinute: parsed.data.maxPerMinute,
      maxPerHour: parsed.data.maxPerHour,
      maxPerDay: parsed.data.maxPerDay,
    },
  });

  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "sender.create",
    entity: "sender",
    entityId: sender.id,
  });

  return NextResponse.json({ id: sender.id });
}
