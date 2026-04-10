import Handlebars from "handlebars";
import mjml2html from "mjml";

// Supported merge tags, documented in the UI. Extend here and the UI
// will pick them up via the exported list.
export const MERGE_TAGS: Array<{ tag: string; description: string }> = [
  { tag: "first_name", description: "Contact first name" },
  { tag: "last_name", description: "Contact last name" },
  { tag: "email", description: "Contact email" },
  { tag: "company", description: "Company attribute" },
  { tag: "unsubscribe_url", description: "One-click unsubscribe URL (auto-injected)" },
  { tag: "preferences_url", description: "Preferences center URL (auto-injected)" },
  { tag: "tracking_pixel", description: "Open-tracking pixel URL (auto-injected)" },
];

// Compile an MJML source to HTML. Falls through to raw HTML when kind=HTML.
export function compileTemplate(
  source: string,
  kind: "MJML" | "HTML",
): { html: string; errors: string[] } {
  if (kind === "HTML") return { html: source, errors: [] };
  const result = mjml2html(source, { validationLevel: "soft", keepComments: false });
  return {
    html: result.html,
    errors: (result.errors ?? []).map((e) => e.formattedMessage ?? e.message ?? String(e)),
  };
}

// Interpolate merge tags using Handlebars. We register a helper that HTML-escapes
// by default (Handlebars behavior), which is the right default for email bodies.
const hbs = Handlebars.create();

export function renderWithMergeTags(source: string, context: Record<string, unknown>): string {
  try {
    const tpl = hbs.compile(source, { noEscape: false });
    return tpl(context);
  } catch {
    // Malformed template tags should degrade gracefully rather than blow up a send.
    return source;
  }
}

// Very lightweight spam-word detector. Complements (does not replace) real
// deliverability testing. Surfaced as a WARN in the UI, never blocks.
const SPAM_WORDS = [
  "free money",
  "click here",
  "guarantee",
  "no obligation",
  "risk free",
  "winner",
  "viagra",
  "casino",
  "100% free",
  "act now",
  "urgent",
  "limited time",
];

export function analyzeContent(opts: { subject: string; html: string }): {
  warnings: string[];
  hasUnsubscribe: boolean;
  score: number;
} {
  const lc = `${opts.subject}\n${opts.html}`.toLowerCase();
  const warnings: string[] = [];
  let score = 100;
  for (const w of SPAM_WORDS) {
    if (lc.includes(w)) {
      warnings.push(`Contains spam-prone phrase "${w}"`);
      score -= 5;
    }
  }
  if ((opts.subject.match(/!/g) ?? []).length > 2) {
    warnings.push("Subject contains excessive exclamation marks");
    score -= 5;
  }
  if (opts.subject === opts.subject.toUpperCase() && opts.subject.length > 8) {
    warnings.push("Subject is ALL CAPS — likely to trigger spam filters");
    score -= 10;
  }
  const hasUnsubscribe =
    /\{\{\s*unsubscribe_url\s*\}\}/.test(opts.html) || /unsubscribe/i.test(opts.html);
  if (!hasUnsubscribe) {
    warnings.push("No unsubscribe link/variable detected — one will be auto-appended.");
    score -= 10;
  }
  return { warnings, hasUnsubscribe, score: Math.max(0, Math.min(100, score)) };
}
