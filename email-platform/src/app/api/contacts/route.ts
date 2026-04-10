import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createContactSchema } from "@/server/validators";
import { upsertContact } from "@/server/services/contacts";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Number(url.searchParams.get("pageSize") ?? 50));

  const where = {
    organizationId: user.organizationId,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        bounceState: true,
        engagementScore: true,
        lastOpenedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, contacts });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }
  const res = await upsertContact({
    organizationId: user.organizationId,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    attributes: parsed.data.attributes,
    source: parsed.data.source ?? "manual",
    listIds: parsed.data.listIds,
  });
  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: res.created ? "contact.create" : "contact.update",
    entity: "contact",
    entityId: res.contactId,
  });
  return NextResponse.json(res);
}
