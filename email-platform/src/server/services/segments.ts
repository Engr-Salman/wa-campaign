import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { segmentDefinitionSchema } from "@/server/validators";

// Segment DSL → Prisma `where` compiler.
// Supports AND/OR at the top level; nested groups can be added later.
// Filters are intentionally conservative — unknown fields are rejected to
// avoid silently producing a too-large audience.

export type SegmentDefinition = z.infer<typeof segmentDefinitionSchema>;

export function compileSegment(
  def: SegmentDefinition,
  organizationId: string,
): Prisma.ContactWhereInput {
  const parts: Prisma.ContactWhereInput[] = def.conditions.map((c) => {
    switch (c.field) {
      case "email":
      case "firstName":
      case "lastName": {
        if (c.op === "eq") return { [c.field]: c.value } as Prisma.ContactWhereInput;
        if (c.op === "neq") return { NOT: { [c.field]: c.value } } as Prisma.ContactWhereInput;
        if (c.op === "contains")
          return {
            [c.field]: { contains: String(c.value), mode: "insensitive" },
          } as Prisma.ContactWhereInput;
        if (c.op === "not_contains")
          return {
            NOT: { [c.field]: { contains: String(c.value), mode: "insensitive" } },
          } as Prisma.ContactWhereInput;
        return {};
      }
      case "status":
        return { status: c.value } as Prisma.ContactWhereInput;
      case "bounceState":
        return { bounceState: c.value } as Prisma.ContactWhereInput;
      case "engagementScore": {
        const n = Number(c.value);
        if (c.op === "gt") return { engagementScore: { gt: n } };
        if (c.op === "gte") return { engagementScore: { gte: n } };
        if (c.op === "lt") return { engagementScore: { lt: n } };
        if (c.op === "lte") return { engagementScore: { lte: n } };
        if (c.op === "eq") return { engagementScore: n };
        return {};
      }
      case "lastSentAt":
      case "lastOpenedAt":
      case "lastClickedAt":
      case "createdAt": {
        const d = new Date(c.value);
        if (Number.isNaN(d.getTime())) return {};
        if (c.op === "before") return { [c.field]: { lt: d } } as Prisma.ContactWhereInput;
        if (c.op === "after") return { [c.field]: { gt: d } } as Prisma.ContactWhereInput;
        return {};
      }
      case "listId": {
        if (c.op === "in_list")
          return { listMembers: { some: { listId: String(c.value) } } };
        if (c.op === "not_in_list")
          return { listMembers: { none: { listId: String(c.value) } } };
        return {};
      }
      case "tagId": {
        if (c.op === "has_tag") return { tagLinks: { some: { tagId: String(c.value) } } };
        if (c.op === "not_has_tag") return { tagLinks: { none: { tagId: String(c.value) } } };
        return {};
      }
      case "customField": {
        if (!c.customKey) return {};
        // JSON path equality. Prisma supports `path` on Json columns.
        return {
          attributes: {
            path: [c.customKey],
            equals: c.value,
          },
        } as Prisma.ContactWhereInput;
      }
      default:
        return {};
    }
  });

  const base: Prisma.ContactWhereInput = { organizationId };
  if (def.combinator === "or") return { ...base, OR: parts };
  return { ...base, AND: parts };
}

// Materialize a segment to contact IDs. Used for previews and audience builds.
export async function materializeSegment(opts: {
  organizationId: string;
  segmentId: string;
  limit?: number;
}): Promise<{ total: number; contactIds: string[] }> {
  const seg = await prisma.segment.findFirst({
    where: { id: opts.segmentId, organizationId: opts.organizationId },
  });
  if (!seg) return { total: 0, contactIds: [] };
  const def = segmentDefinitionSchema.parse(seg.definition);
  const where = compileSegment(def, opts.organizationId);
  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({ where, select: { id: true }, take: opts.limit ?? 10_000 }),
  ]);
  return { total, contactIds: rows.map((r) => r.id) };
}
