import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookIngestQueue } from "@/server/queue";
import { z } from "zod";

// Generic webhook ingestion endpoint for provider callbacks.
// Real production usage must verify provider-specific HMAC signatures.
// We persist the raw payload and hand off processing to a worker so the
// HTTP response stays <200ms.
const payloadSchema = z.object({
  organization: z.string().min(1), // org slug or id
  provider: z.string().min(1),
  type: z.string().min(1),
  email: z.string().email().optional(),
  message_id: z.string().optional(),
  campaign_id: z.string().optional(),
}).passthrough();

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const org =
    (await prisma.organization.findUnique({ where: { slug: parsed.data.organization } })) ??
    (await prisma.organization.findUnique({ where: { id: parsed.data.organization } }));
  if (!org) {
    return NextResponse.json({ error: "unknown organization" }, { status: 404 });
  }

  const wh = await prisma.webhookEvent.create({
    data: {
      organizationId: org.id,
      provider: parsed.data.provider,
      eventType: parsed.data.type,
      payload: parsed.data,
    },
  });

  await webhookIngestQueue.add("ingest", { webhookEventId: wh.id }, { jobId: wh.id });

  return NextResponse.json({ ok: true });
}
