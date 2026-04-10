import IORedis, { type Redis } from "ioredis";
import { env } from "./env";

// BullMQ requires maxRetriesPerRequest=null on the connection.
const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisBull?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new IORedis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }
  return globalForRedis.redis;
}

export function getBullConnection(): Redis {
  if (!globalForRedis.redisBull) {
    globalForRedis.redisBull = new IORedis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return globalForRedis.redisBull;
}
