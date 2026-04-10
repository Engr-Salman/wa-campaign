import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { bulkImportContacts } from "@/server/services/contacts";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";

// Contact import: accepts CSV or XLSX via multipart/form-data.
// - Validates file type + size (env.MAX_CSV_UPLOAD_MB)
// - Parses rows using first-row column headers
// - Maps provided column → contact field mapping
// - Performs dedupe, suppression filtering, and basic validation
// - Persists an ImportJob with counters for UI display
//
// For very large files (>50k rows) we'd ideally enqueue a worker job and
// stream-parse the file, but synchronous processing keeps MVP simple and
// reliable. This route already chunks writes internally.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid form" }, { status: 400 });

  const file = form.get("file") as File | null;
  const listId = (form.get("listId") as string | null) || null;
  const mappingJson = (form.get("mapping") as string | null) || "{}";

  if (!file) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const maxBytes = env.MAX_CSV_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `file too large, max ${env.MAX_CSV_UPLOAD_MB}MB` },
      { status: 413 },
    );
  }

  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(mappingJson);
  } catch {
    return NextResponse.json({ error: "invalid mapping" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rows: Array<Record<string, string>> = [];
  try {
    if (name.endsWith(".csv") || file.type === "text/csv") {
      const parsed = Papa.parse<Record<string, string>>(buf.toString("utf8"), {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data.filter((r) => r && Object.keys(r).length);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    } else {
      return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: `parse failed: ${(e as Error).message}` }, { status: 400 });
  }

  if (!rows.length) return NextResponse.json({ error: "empty file" }, { status: 400 });

  const emailCol = mapping.email ?? "email";
  const firstCol = mapping.firstName ?? "first_name";
  const lastCol = mapping.lastName ?? "last_name";

  const importJob = await prisma.importJob.create({
    data: {
      organizationId: user.organizationId,
      fileName: file.name,
      status: "PROCESSING",
      totalRows: rows.length,
      targetListId: listId,
      mapping: mapping as unknown as object,
    },
  });

  const shaped = rows.map((r) => ({
    email: (r[emailCol] ?? "").toString(),
    firstName: (r[firstCol] ?? "").toString() || undefined,
    lastName: (r[lastCol] ?? "").toString() || undefined,
    attributes: Object.fromEntries(
      Object.entries(r).filter(
        ([k]) => ![emailCol, firstCol, lastCol].includes(k),
      ),
    ),
    source: `import:${file.name}`,
  }));

  const result = await bulkImportContacts({
    organizationId: user.organizationId,
    rows: shaped,
    targetListId: listId,
  });

  await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      importedCount: result.imported,
      updatedCount: result.updated,
      skippedCount: result.skipped,
      invalidCount: result.invalid,
      errorReport: result.errors.slice(0, 100) as unknown as object,
    },
  });

  await writeAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "contacts.import",
    entity: "import",
    entityId: importJob.id,
    metadata: { fileName: file.name, totalRows: rows.length },
  });

  return NextResponse.json({ importJobId: importJob.id, ...result });
}
