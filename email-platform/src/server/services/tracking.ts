import { env } from "@/lib/env";

// Rewrites outgoing email HTML to:
//   1. Wrap every <a href> through a tracked redirect.
//   2. Append a 1x1 open-tracking pixel before </body>.
//   3. Append a compliance footer with an unsubscribe link if missing.
//
// All tokens are per-recipient and opaque. No PII is leaked in the URLs.
export interface TrackingContext {
  trackingToken: string;
  unsubToken: string;
  campaignId: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  enforceUnsubFooter?: boolean;
  footerHtml?: string | null;
  orgName?: string | null;
  orgAddress?: string | null;
}

const ABSOLUTE_URL_RE = /^https?:\/\//i;

export function buildUnsubscribeUrl(token: string): string {
  return `${env.PUBLIC_TRACKING_URL}/unsubscribe/${token}`;
}

export function buildPreferencesUrl(token: string): string {
  return `${env.PUBLIC_TRACKING_URL}/preferences/${token}`;
}

export function buildOpenPixelUrl(token: string): string {
  return `${env.PUBLIC_TRACKING_URL}/api/track/open?t=${encodeURIComponent(token)}`;
}

export function buildClickUrl(token: string, dest: string): string {
  return `${env.PUBLIC_TRACKING_URL}/api/track/click?t=${encodeURIComponent(token)}&u=${encodeURIComponent(dest)}`;
}

function appendUtm(url: string, utm?: TrackingContext["utm"]): string {
  if (!utm || (!utm.source && !utm.medium && !utm.campaign)) return url;
  try {
    const u = new URL(url);
    if (utm.source && !u.searchParams.has("utm_source")) u.searchParams.set("utm_source", utm.source);
    if (utm.medium && !u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", utm.medium);
    if (utm.campaign && !u.searchParams.has("utm_campaign"))
      u.searchParams.set("utm_campaign", utm.campaign);
    return u.toString();
  } catch {
    return url;
  }
}

export function injectTracking(html: string, ctx: TrackingContext): string {
  let out = html;

  // 1. Wrap links.
  out = out.replace(
    /<a\s+([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
    (match, pre: string, quote: string, href: string, post: string) => {
      if (!href || href.startsWith("mailto:") || href.startsWith("#")) return match;
      if (href.includes("{{unsubscribe_url}}") || href.includes("{{preferences_url}}")) return match;
      if (!ABSOLUTE_URL_RE.test(href)) return match;
      const withUtm = appendUtm(href, ctx.utm);
      const tracked = buildClickUrl(ctx.trackingToken, withUtm);
      return `<a ${pre}href=${quote}${tracked}${quote}${post}>`;
    },
  );

  // 2. Append tracking pixel.
  const pixel = `<img src="${buildOpenPixelUrl(
    ctx.trackingToken,
  )}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;height:1px;width:1px;" />`;
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    out += pixel;
  }

  // 3. Enforce compliance footer with unsubscribe link.
  const unsubUrl = buildUnsubscribeUrl(ctx.unsubToken);
  const prefsUrl = buildPreferencesUrl(ctx.unsubToken);
  const orgLine = [ctx.orgName, ctx.orgAddress].filter(Boolean).join(" — ");

  const needsFooter =
    ctx.enforceUnsubFooter !== false && !/unsubscribe/i.test(out.replace(/<a[^>]*>.*?<\/a>/gi, ""));

  if (needsFooter) {
    const footer = ctx.footerHtml
      ? ctx.footerHtml
          .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, unsubUrl)
          .replace(/\{\{\s*preferences_url\s*\}\}/g, prefsUrl)
      : `<div style="font-family:Arial,sans-serif;font-size:12px;color:#888;padding:24px;text-align:center;line-height:1.5;">
          ${orgLine ? `<div>${escapeHtml(orgLine)}</div>` : ""}
          <div style="margin-top:8px;">
            You're receiving this email because you opted in.
            <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a> ·
            <a href="${prefsUrl}" style="color:#888;">Manage preferences</a>
          </div>
        </div>`;
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${footer}</body>`);
    } else {
      out += footer;
    }
  } else {
    // Still rewrite {{unsubscribe_url}} / {{preferences_url}} merge tags if present.
    out = out
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, unsubUrl)
      .replace(/\{\{\s*preferences_url\s*\}\}/g, prefsUrl);
  }

  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
