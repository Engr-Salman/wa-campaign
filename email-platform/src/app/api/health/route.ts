import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

// Lightweight liveness/readiness probe. Does NOT expose secrets.
// Returns 200 when db + redis are both reachable, 503 otherwise.
export async function GET() {
  const result = { db: "unknown" as "ok" | "error" | "unknown", redis: "unknown" as "ok" | "error" | "unknown" };
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    result.db = "ok";
  } catch {
    result.db = "error";
  }
  try {
    const r = getRedis();
    await r.ping();
    result.redis = "ok";
  } catch {
    result.redis = "error";
  }
  const ok = result.db === "ok" && result.redis === "ok";
  return NextResponse.json(result, { status: ok ? 200 : 503 });
}
