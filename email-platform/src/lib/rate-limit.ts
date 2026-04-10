import { getRedis } from "./redis";

// Sliding-window-ish token bucket using Redis INCR + TTL.
// Designed for per-endpoint rate limiting (auth, tracking ingestion, webhooks).
// For send throttling we use BullMQ's rateLimiter which is more precise.
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redis = getRedis();
  const k = `rl:${opts.key}`;
  const pipeline = redis.multi();
  pipeline.incr(k);
  pipeline.ttl(k);
  const res = (await pipeline.exec()) as unknown as [null | Error, number][];
  const count = res[0][1];
  let ttl = res[1][1];
  if (ttl < 0) {
    await redis.expire(k, opts.windowSeconds);
    ttl = opts.windowSeconds;
  }
  const allowed = count <= opts.limit;
  return {
    allowed,
    remaining: Math.max(0, opts.limit - count),
    resetIn: ttl,
  };
}
