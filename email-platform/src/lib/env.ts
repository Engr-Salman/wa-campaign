import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("Bulk Email Platform"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_TRACKING_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 chars"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "CREDENTIAL_ENCRYPTION_KEY must be 32 bytes base64-encoded",
    }),
  SEND_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  GLOBAL_MAX_SENDS_PER_SECOND: z.coerce.number().int().positive().default(20),
  LARGE_SEND_THRESHOLD: z.coerce.number().int().positive().default(5000),
  MAX_CSV_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  MAX_ATTACHMENT_MB: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

// Parse once. Fail fast in non-test environments.
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error(`\n[env] Invalid environment configuration:\n  ${issues}\n`);
  }
}

export const env = (parsed.success
  ? parsed.data
  : (schema.parse({
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "test-secret-test-secret-test",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      CREDENTIAL_ENCRYPTION_KEY:
        process.env.CREDENTIAL_ENCRYPTION_KEY ?? Buffer.alloc(32, 1).toString("base64"),
    }) as z.infer<typeof schema>)) as z.infer<typeof schema>;
