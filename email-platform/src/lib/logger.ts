import pino from "pino";
import { env } from "./env";

// Structured JSON logging. In dev we pretty-print for readability.
// Never logs secrets: credentials are encrypted at rest and the logger
// explicitly redacts authorization headers, cookies, and known key paths.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: "bulkmail" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "configEncrypted",
      "tokenHash",
      "secret",
      "*.password",
      "*.passwordHash",
      "*.secret",
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" } }
      : undefined,
});
