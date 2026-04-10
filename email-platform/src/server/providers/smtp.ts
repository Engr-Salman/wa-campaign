import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProvider, OutboundMessage, SendResult, SmtpConfig } from "./types";

// Nodemailer-backed SMTP provider. Supports any RFC-compliant SMTP endpoint.
// Classifies failures into permanent (hard) vs transient (soft) using
// SMTP response codes (5xx vs 4xx) plus nodemailer's `code` property.
export class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS ?? !config.secure,
      auth:
        config.username && config.password
          ? { user: config.username, pass: config.password }
          : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }

  async verify(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (e) {
      const err = e as Error;
      return { ok: false, error: err.message };
    }
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: msg.fromName ? `"${msg.fromName.replace(/"/g, "")}" <${msg.from}>` : msg.from,
        to: msg.toName ? `"${msg.toName.replace(/"/g, "")}" <${msg.to}>` : msg.to,
        replyTo: msg.replyTo,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        attachments: msg.attachments,
        headers: {
          ...(msg.headers ?? {}),
          ...(msg.listUnsubscribeUrl
            ? {
                "List-Unsubscribe": `<${msg.listUnsubscribeUrl}>${msg.listUnsubscribeMailto ? `, <mailto:${msg.listUnsubscribeMailto}>` : ""}`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : {}),
        },
      });
      return {
        accepted: Array.isArray(info.accepted) && info.accepted.length > 0,
        providerMessageId: info.messageId,
      };
    } catch (e) {
      const err = e as Error & { responseCode?: number; code?: string };
      // 5xx = permanent/hard, 4xx = temporary/soft, other errors lean soft.
      const code = err.responseCode ?? 0;
      const hard = code >= 500 && code < 600;
      return {
        accepted: false,
        error: err.message,
        bounceState: hard ? "HARD" : "SOFT",
      };
    }
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
