import { z } from "zod";

// Zod schemas shared across API routes and server actions. Keeping them
// centralized guarantees the same validation runs everywhere.

// ── Senders ────────────────────────────────────────────────────────
export const smtpConfigSchema = z.object({
  type: z.literal("SMTP"),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  username: z.string().optional(),
  password: z.string().optional(),
  requireTLS: z.boolean().optional(),
});

export const createSenderSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["SMTP", "SES", "SENDGRID", "MAILGUN", "RESEND", "POSTMARK"]),
  fromName: z.string().min(1).max(120),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional().or(z.literal("")),
  config: smtpConfigSchema,
  maxPerSecond: z.coerce.number().int().min(1).max(100).default(5),
  maxPerMinute: z.coerce.number().int().min(1).max(10000).default(120),
  maxPerHour: z.coerce.number().int().min(1).max(500000).default(5000),
  maxPerDay: z.coerce.number().int().min(1).max(5000000).default(50000),
});

// ── Contacts ───────────────────────────────────────────────────────
export const createContactSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  listIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  source: z.string().max(120).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const importMappingSchema = z.object({
  email: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

// ── Lists & tags ───────────────────────────────────────────────────
export const createListSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/)
    .optional(),
});

// ── Segments ───────────────────────────────────────────────────────
export const segmentConditionSchema = z.object({
  field: z.enum([
    "email",
    "firstName",
    "lastName",
    "status",
    "bounceState",
    "lastSentAt",
    "lastOpenedAt",
    "lastClickedAt",
    "createdAt",
    "engagementScore",
    "listId",
    "tagId",
    "customField",
  ]),
  op: z.enum([
    "eq",
    "neq",
    "contains",
    "not_contains",
    "gt",
    "lt",
    "gte",
    "lte",
    "before",
    "after",
    "in_list",
    "not_in_list",
    "has_tag",
    "not_has_tag",
  ]),
  value: z.any(),
  customKey: z.string().optional(),
});

export const segmentDefinitionSchema = z.object({
  combinator: z.enum(["and", "or"]).default("and"),
  conditions: z.array(segmentConditionSchema).min(1).max(20),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  definition: segmentDefinitionSchema,
});

// ── Templates ──────────────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  kind: z.enum(["MJML", "HTML"]).default("MJML"),
  source: z.string().min(1).max(200_000),
  subject: z.string().max(200).optional(),
  preheader: z.string().max(200).optional(),
});

// ── Campaigns ──────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(160),
  subject: z.string().min(1).max(200),
  preheader: z.string().max(200).optional(),
  senderAccountId: z.string().min(1),
  templateId: z.string().optional(),
  listIds: z.array(z.string()).default([]),
  segmentIds: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().default("UTC"),
  abEnabled: z.boolean().default(false),
  abSplitPercent: z.coerce.number().int().min(5).max(50).default(20),
  abWinnerMetric: z.enum(["open", "click"]).optional(),
  utmSource: z.string().max(60).optional(),
  utmMedium: z.string().max(60).optional(),
  utmCampaign: z.string().max(60).optional(),
});

export const confirmCampaignSchema = z.object({
  campaignId: z.string().min(1),
});

// ── Suppression ────────────────────────────────────────────────────
export const addSuppressionSchema = z.object({
  email: z.string().email().max(254),
  reason: z.enum(["UNSUBSCRIBE", "BOUNCE_HARD", "COMPLAINT", "MANUAL", "IMPORT"]).default("MANUAL"),
  note: z.string().max(300).optional(),
});
