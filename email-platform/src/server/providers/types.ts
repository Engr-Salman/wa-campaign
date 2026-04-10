// Provider abstraction. Every transport (SMTP, SES, SendGrid, etc.)
// implements this interface so the sending engine stays transport-agnostic.

export interface OutboundMessage {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  // Per-recipient tracking tokens are injected by the sending engine
  // BEFORE the provider is called, so providers never see secrets.
  messageIdHint?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  listUnsubscribeUrl?: string;
  listUnsubscribeMailto?: string;
}

export interface SendResult {
  accepted: boolean;
  providerMessageId?: string;
  error?: string;
  // Bounce classification hint if the provider surfaces one synchronously.
  bounceState?: "SOFT" | "HARD";
}

export interface EmailProvider {
  readonly name: string;
  verify(): Promise<{ ok: boolean; error?: string }>;
  send(msg: OutboundMessage): Promise<SendResult>;
  close?(): Promise<void>;
}

// Supported configuration shapes. Kept in one place so validators and UI
// reference a single source of truth.
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  requireTLS?: boolean;
};

export type ApiProviderConfig = {
  apiKey: string;
  region?: string;
};

export type ProviderConfig =
  | ({ type: "SMTP" } & SmtpConfig)
  | ({ type: "SES" } & ApiProviderConfig)
  | ({ type: "SENDGRID" } & ApiProviderConfig)
  | ({ type: "MAILGUN" } & ApiProviderConfig & { domain: string })
  | ({ type: "RESEND" } & ApiProviderConfig)
  | ({ type: "POSTMARK" } & ApiProviderConfig);
