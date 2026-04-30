/**
 * Frontend-side helpers for the Ultraviolet service-worker proxy.
 *
 * - registerProxySW: registers /uv/sw.js with scope /service/. Idempotent.
 * - launchUrl:       turns a regular URL into a /service/<encoded> URL and
 *                    opens it in a new tab. Awaits SW registration first to
 *                    avoid the "served raw on first visit" failure mode.
 * - persistFingerprint: stores a fingerprint object in localStorage so the
 *                    UV inject hook can read it inside the proxied page.
 */

const SW_PATH = "/uv/sw.js";
const SW_SCOPE = "/service/";

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export function registerProxySW(): Promise<ServiceWorkerRegistration> {
  if (registrationPromise) return registrationPromise;

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.reject(new Error("Service workers unsupported"));
  }

  registrationPromise = navigator.serviceWorker
    .register(SW_PATH, { scope: SW_SCOPE })
    .then(async (reg) => {
      // Wait for the worker to be ready before any /service/ navigation
      await navigator.serviceWorker.ready;
      return reg;
    });

  return registrationPromise;
}

declare global {
  interface Window {
    __uv$config?: {
      prefix: string;
      encodeUrl: (input: string) => string;
    };
  }
}

async function ensureUVConfig(): Promise<NonNullable<Window["__uv$config"]>> {
  if (window.__uv$config) return window.__uv$config;
  // Lazy-load the UV bundle + config on the page so we can encodeUrl client-side.
  await loadScript("/uv/uv.bundle.js");
  await loadScript("/uv/uv.config.js");
  if (!window.__uv$config) throw new Error("UV config failed to load");
  return window.__uv$config;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export interface FingerprintProfile {
  userAgent?: string;
  platform?: string;
  uaPlatform?: string;
  language?: string;
  languages?: string[];
  timezone?: string;
  screenResolution?: string;
  colorDepth?: number;
  webglVendor?: string;
  webglRenderer?: string;
  canvasNoise?: string;
  audioNoise?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
}

export function persistFingerprint(fp: FingerprintProfile): void {
  try {
    localStorage.setItem("__sn_fp", JSON.stringify(fp));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export interface PrecheckResult {
  ok: boolean;
  challenge: "cloudflare" | "turnstile" | "hcaptcha" | "recaptcha" | "datadome" | "perimeterx" | null;
  status?: number;
  pageTitle?: string;
  error?: string;
}

/**
 * Server-side reachability + anti-bot challenge sniff. Lets the UI surface
 * an honest "this site is gated, the proxy might not get past it" warning
 * before we open a tab that would otherwise white-screen.
 */
export async function precheck(rawUrl: string): Promise<PrecheckResult> {
  const url = normalizeUrl(rawUrl);
  const base = (import.meta.env.BASE_URL as string) || "/";
  try {
    const res = await fetch(`${base}api/relay/verify?url=${encodeURIComponent(url)}`, {
      method: "GET",
    });
    const data = (await res.json()) as PrecheckResult;
    return data;
  } catch (e) {
    return { ok: false, challenge: null, error: e instanceof Error ? e.message : "precheck failed" };
  }
}

export async function launchUrl(rawUrl: string): Promise<string> {
  const url = normalizeUrl(rawUrl);
  await registerProxySW();
  const config = await ensureUVConfig();
  const encoded = config.prefix + config.encodeUrl(url);
  return encoded;
}

export type OrchestratedSession =
  | {
      type: "proxy";
      available: true;
      sessionId: string;
      endpoint: string;
      region: { id: string; country: string; city: string };
      expiresAt: string;
      reason?: string;
      warning?: { challenge: string | null; confidence: number; message: string };
    }
  | {
      type: "remote";
      available: true;
      sessionId: string;
      endpoint: string;
      iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
      startUrl: string;
      region: { id: string; country: string; city: string };
      expiresAt: string;
      reason: string;
    }
  | {
      type: "remote";
      available: false;
      reason: "not_deployed" | "needs_holder_tier" | "region_unsupported" | "pool_error" | "no_capacity";
      unlockHint: string;
      fallback: { type: "proxy"; reason: string };
    };

/**
 * Ask the server which backend should handle this URL. Returns either a
 * proxy session (free tier; or escalation not yet warranted), or a remote
 * session descriptor (holder tier on a destination that needs it), or an
 * "unavailable" payload describing how to unlock the upgrade.
 *
 * If the user has a cached holder claim, it's attached automatically
 * without the caller needing to know — the server validates server-side.
 */
export async function orchestrate(rawUrl: string, opts?: { regionId?: string; entitlement?: "free" | "holder"; precheck?: { challenge: string | null; confidence: number } }): Promise<OrchestratedSession> {
  const url = normalizeUrl(rawUrl);
  const base = (import.meta.env.BASE_URL as string) || "/";

  // Attach cached holder claim if present and not expired. Bind it to
  // the device hash so the server can reject a claim replayed from
  // another machine.
  let claim: string | undefined;
  try {
    const raw = localStorage.getItem("sn_holder_claim_v1");
    if (raw) {
      const parsed = JSON.parse(raw) as { claim?: string; expiresAt?: string };
      if (parsed.claim && parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now() + 30_000) {
        claim = parsed.claim;
      }
    }
  } catch { /* ignore */ }
  const { deviceHash } = await import("./device-hash");
  const dh = await deviceHash();

  const res = await fetch(`${base}api/session/orchestrate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url, ...opts, deviceHash: dh,
      ...(claim ? { holderClaim: claim, entitlement: "holder" } : {}),
    }),
  });
  // 402 / 503 still carry valid payloads (the upsell or fallback note).
  return (await res.json()) as OrchestratedSession;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Empty URL");
  const withScheme = /^https?:\/\//i.test(t) ? t : "https://" + t;
  // Validates well-formed-ness; throws on bad input
  // eslint-disable-next-line no-new
  new URL(withScheme);
  return withScheme;
}
