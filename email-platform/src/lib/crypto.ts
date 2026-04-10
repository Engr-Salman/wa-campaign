import crypto from "node:crypto";
import { env } from "./env";

// AES-256-GCM envelope encryption for small secrets (SMTP passwords, API keys).
// Format (bytes): [12-byte IV][16-byte tag][ciphertext]
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  return Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "base64");
}

export function encryptJson(value: unknown): Buffer {
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptJson<T = unknown>(blob: Buffer): T {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

// Secure opaque token generator for tracking & unsubscribe links.
// 24 random bytes -> ~32 chars base64url. URL-safe, not guessable.
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Constant-time comparison for token checks.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
