/**
 * Failure classifier for proxied destinations.
 *
 * Fed the upstream Response headers + a body sample, returns a structured
 * verdict the orchestrator can route on:
 *
 *   { challenge, reason, confidence, recommendation }
 *
 * `challenge` answers "what's blocking" (cf/turnstile/captcha/etc).
 * `reason` answers "why we're confident" — the matched signal.
 * `confidence` is 0..1, the orchestrator escalates to remote-tier when
 * confidence > 0.75 AND the user holds a paid tier.
 *
 * The point isn't perfect detection — it's stable categorisation so we
 * can build escalation logic, analytics, and per-host failure history.
 */

export type ChallengeType =
  | "cloudflare"
  | "turnstile"
  | "hcaptcha"
  | "recaptcha"
  | "datadome"
  | "perimeterx"
  | "akamai"
  | "geoblock"
  | "soft_block"
  | "ws_blocked"
  | "blank_render"
  | null;

export type Reason =
  | "cf_mitigated_header"
  | "title_just_a_moment"
  | "turnstile_script"
  | "hcaptcha_script"
  | "recaptcha_script"
  | "datadome_header"
  | "px_header"
  | "akamai_bm_header"
  | "status_403"
  | "status_451"
  | "geo_redirect"
  | "no_html_no_redirect"
  | "ws_upgrade_denied";

export interface Verdict {
  challenge: ChallengeType;
  reason: Reason | null;
  confidence: number;
  recommendation: "passthrough" | "warn" | "escalate";
}

interface Input {
  status: number;
  finalUrl: string;
  originalHost: string;
  headers: Headers;
  bodySample: string; // first ~64KB lowered
  contentType: string;
}

const RECOMMEND = (c: number): Verdict["recommendation"] =>
  c >= 0.75 ? "escalate" : c >= 0.4 ? "warn" : "passthrough";

export function classify(input: Input): Verdict {
  const { status, headers, bodySample, contentType, finalUrl, originalHost } = input;

  // Header signals — strongest, no false positives from body content.
  const cfMitigated = headers.get("cf-mitigated");
  if (cfMitigated === "challenge") {
    return { challenge: "cloudflare", reason: "cf_mitigated_header", confidence: 0.95, recommendation: "escalate" };
  }
  if (headers.get("x-px-block")) {
    return { challenge: "perimeterx", reason: "px_header", confidence: 0.92, recommendation: "escalate" };
  }
  if (headers.get("x-datadome") || headers.get("server")?.toLowerCase().includes("datadome")) {
    return { challenge: "datadome", reason: "datadome_header", confidence: 0.9, recommendation: "escalate" };
  }
  if (headers.get("server")?.toLowerCase().includes("akamaighost") && status >= 400) {
    return { challenge: "akamai", reason: "akamai_bm_header", confidence: 0.7, recommendation: "warn" };
  }

  // Status code signals.
  if (status === 451) {
    return { challenge: "geoblock", reason: "status_451", confidence: 0.95, recommendation: "escalate" };
  }
  if (status === 403 && contentType.includes("text/html")) {
    // 403 on HTML is usually a soft block. Boost confidence if the body
    // also matches a known anti-bot vendor.
    let bonus = 0;
    if (bodySample.includes("cloudflare")) bonus += 0.1;
    if (bodySample.includes("captcha")) bonus += 0.1;
    return { challenge: "soft_block", reason: "status_403", confidence: 0.6 + bonus, recommendation: RECOMMEND(0.6 + bonus) };
  }

  // Body / script signals — weaker on their own; check after headers.
  if (contentType.includes("text/html") && bodySample) {
    if (/<title[^>]*>\s*just a moment\.\.\.\s*<\/title>/i.test(bodySample)) {
      return { challenge: "cloudflare", reason: "title_just_a_moment", confidence: 0.92, recommendation: "escalate" };
    }
    if (bodySample.includes("challenges.cloudflare.com/turnstile")) {
      return { challenge: "turnstile", reason: "turnstile_script", confidence: 0.85, recommendation: "escalate" };
    }
    if (bodySample.includes("hcaptcha.com/captcha") || bodySample.includes("h-captcha")) {
      return { challenge: "hcaptcha", reason: "hcaptcha_script", confidence: 0.8, recommendation: "escalate" };
    }
    if (status >= 400 && bodySample.includes("google.com/recaptcha")) {
      return { challenge: "recaptcha", reason: "recaptcha_script", confidence: 0.75, recommendation: "escalate" };
    }
  }

  // Geo-redirect: final host differs from requested *and* the path looks
  // like a region landing page. Cheap heuristic — better than nothing.
  try {
    const finalHost = new URL(finalUrl).host;
    if (finalHost !== originalHost && /\/(geo|region|country|blocked|unavailable)\b/i.test(finalUrl)) {
      return { challenge: "geoblock", reason: "geo_redirect", confidence: 0.7, recommendation: "warn" };
    }
  } catch { /* ignore */ }

  // Unknown empty body on a 200 — possible client-side fingerprint block.
  // Low confidence; the JS-stall heartbeat will confirm or refute.
  if (status === 200 && contentType.includes("text/html") && bodySample.length < 256) {
    return { challenge: "blank_render", reason: "no_html_no_redirect", confidence: 0.45, recommendation: "warn" };
  }

  return { challenge: null, reason: null, confidence: 0, recommendation: "passthrough" };
}
