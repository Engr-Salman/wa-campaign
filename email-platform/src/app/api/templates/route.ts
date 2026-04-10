import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createTemplateSchema } from "@/server/validators";
import { compileTemplate, analyzeContent } from "@/server/services/templates";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const templates = await prisma.template.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      kind: true,
      subject: true,
      preheader: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }
  const compiled = compileTemplate(parsed.data.source, parsed.data.kind);
  const analysis = analyzeContent({
    subject: parsed.data.subject ?? "",
    html: compiled.html,
  });
  const t = await prisma.template.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      kind: parsed.data.kind,
      source: parsed.data.source,
      compiledHtml: compiled.html,
      subject: parsed.data.subject ?? null,
      preheader: parsed.data.preheader ?? null,
    },
  });
  return NextResponse.json({
    id: t.id,
    compileErrors: compiled.errors,
    warnings: analysis.warnings,
    score: analysis.score,
  });
}
