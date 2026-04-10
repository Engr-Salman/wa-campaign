import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { buildProvider } from "@/server/providers";

const schema = z.object({
  senderId: z.string().min(1),
  to: z.string().email(),
});

// Sends a test email to self using the configured provider.
// Critical for verifying deliverability before launching a campaign.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const sender = await prisma.senderAccount.findFirst({
    where: { id: parsed.data.senderId, organizationId: user.organizationId },
  });
  if (!sender) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const provider = buildProvider(sender);
    const verify = await provider.verify();
    if (!verify.ok) {
      await prisma.senderAccount.update({
        where: { id: sender.id },
        data: { status: "FAILED", lastError: verify.error ?? "verify failed" },
      });
      return NextResponse.json({ ok: false, error: verify.error }, { status: 400 });
    }
    const res = await provider.send({
      to: parsed.data.to,
      from: sender.fromEmail,
      fromName: sender.fromName,
      subject: "[Test] Sender verification",
      html: `<p>This is a test email from <b>${sender.name}</b>.</p><p>If you received it, your connection is working.</p>`,
      text: "This is a test email. Your sender is configured correctly.",
    });
    if (!res.accepted) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    await prisma.senderAccount.update({
      where: { id: sender.id },
      data: { status: "VERIFIED", lastVerifiedAt: new Date(), lastError: null },
    });
    return NextResponse.json({ ok: true, messageId: res.providerMessageId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
