import type { SenderAccount } from "@prisma/client";
import { decryptJson } from "@/lib/crypto";
import type { EmailProvider, ProviderConfig } from "./types";
import { SmtpProvider } from "./smtp";

// Factory: given a SenderAccount (encrypted config blob), returns a live
// provider instance ready to send.
//
// When adding a new provider type:
//   1. Create `./<name>.ts` implementing `EmailProvider`.
//   2. Extend the switch below.
//   3. Add its config shape to `./types.ts`.
//   4. Update the validators in `src/server/validators/sender.ts`.
export function buildProvider(sender: SenderAccount): EmailProvider {
  const cfg = decryptJson<ProviderConfig>(Buffer.from(sender.configEncrypted));
  switch (cfg.type) {
    case "SMTP":
      return new SmtpProvider(cfg);
    // Placeholder branches — these use SMTP relays of the named providers
    // so the platform is immediately usable. Native API integrations are a
    // drop-in replacement.
    case "SES":
    case "SENDGRID":
    case "MAILGUN":
    case "RESEND":
    case "POSTMARK":
      throw new Error(
        `Native ${cfg.type} integration not yet implemented — connect via SMTP for now.`,
      );
    default: {
      const _exhaustive: never = cfg;
      throw new Error(`Unknown provider type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export * from "./types";
