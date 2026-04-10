import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createListSchema } from "@/server/validators";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lists = await prisma.contactList.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      memberCount: l._count.members,
      createdAt: l.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createListSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const list = await prisma.contactList.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
  });
  return NextResponse.json({ id: list.id });
}
