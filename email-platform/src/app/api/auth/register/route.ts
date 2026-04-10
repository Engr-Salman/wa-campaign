import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(200),
  name: z.string().min(1).max(120),
  organizationName: z.string().min(2).max(120),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await rateLimit({ key: `register:${ip}`, limit: 10, windowSeconds: 900 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Intentionally generic to prevent account enumeration.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const baseSlug = slugify(parsed.data.organizationName) || "workspace";
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.organization.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: parsed.data.organizationName,
        slug,
        enforceUnsubFooter: true,
      },
    });
    const u = await tx.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
      },
    });
    await tx.membership.create({
      data: { userId: u.id, organizationId: org.id, role: "OWNER" },
    });
    return { u, org };
  });

  await writeAudit({
    organizationId: user.org.id,
    userId: user.u.id,
    action: "user.register",
    entity: "user",
    entityId: user.u.id,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  logger.info({ userId: user.u.id, orgId: user.org.id }, "new user registered");
  return NextResponse.json({ ok: true });
}
