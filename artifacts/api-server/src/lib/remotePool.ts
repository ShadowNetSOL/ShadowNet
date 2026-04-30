/**
 * Remote-browser pool client.
 *
 * Talks to a separate service that holds a warm pool of Chromium
 * containers behind WebRTC. The orchestrator delegates to this client
 * when it decides a request needs the remote tier; the frontend never
 * talks to the pool directly (auth/billing/abuse all gate at the
 * orchestrator).
 *
 * Required pool endpoints (operator-defined, simple HTTP):
 *
 *   POST /sessions
 *     body: { region, fingerprint, ttlSec, seedState? }
 *     200:  { id, signalUrl, iceServers, expiresAt }
 *
 *   POST /sessions/:id/heartbeat
 *     200:  { ok: true, idleSec }
 *
 *   DELETE /sessions/:id
 *     204
 *
 * Plus a WebSocket at signalUrl handling { kind: "offer"|"answer"|"ice" }
 * with a video track + an "input" data channel.
 *
 * ── HARD ISOLATION REQUIREMENTS (pool side) ────────────────────────────
 * The "secure mode" promise breaks the moment any user-observable state
 * leaks across sessions. Pool implementations MUST:
 *
 *   1. Spawn a fresh Chromium profile per session. No reused user-data
 *      directory. No persistent cache, history, or extensions.
 *   2. Disable disk persistence: --incognito or --user-data-dir=<tmpfs>.
 *   3. Never reuse a container across sessions. Tear it down on
 *      DELETE /sessions/:id (or on idle-kill) and let the next request
 *      provision a fresh one (warm pool = pre-spawned containers, not
 *      pre-used).
 *   4. Apply the fingerprint we send — UA, sec-ch-ua-platform headers,
 *      languages, timezone, screen, hardwareConcurrency, deviceMemory,
 *      WebGL vendor/renderer — at the launch flag layer, not via JS
 *      injection (which leaks via getter origin).
 *   5. If seedState is present, scope strictly:
 *        - cookies set ONLY for seedState.host (no .domain wildcards)
 *        - localStorage written ONLY against seedState.origin
 *        - reject the snapshot if document.location.origin doesn't match
 *      Apply BEFORE the first navigation to seedState.url so the
 *      destination sees a logged-in user reloading, not a fresh hit.
 *   6. Forbid outbound traffic to ShadowNet's egress IPs (no loopback)
 *      so a malicious dApp can't pivot through.
 *   7. Clipboard sync MUST be disabled by default. Many WebRTC browser
 *      stacks expose a clipboard channel — that leaks copied wallet
 *      addresses and breaks the user's local clipboard. Make it opt-in
 *      and gated on an explicit user action if you support it at all.
 *   8. Disable Service Workers + IndexedDB persistence in the launched
 *      profile flags. Anything that writes to disk survives container
 *      lifetime if the operator gets profile-tmpfs config wrong.
 *
 * Until REMOTE_BROWSER_POOL_URL is set, every call returns an inert
 * "unavailable" descriptor so the orchestrator degrades gracefully.
 */
import type { SessionFingerprint } from "./sessionStore";

export interface PoolDescriptor {
  available: boolean;
  reason?: "not_deployed" | "pool_error" | "no_capacity";
  detail?: string;
}

export interface PoolSession extends PoolDescriptor {
  available: true;
  id: string;
  signalUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  expiresAt: string;
  /** "ready" = container booted and the WebRTC track is up. "booting" =
   *  container exists but isn't streaming yet. The client must poll
   *  GET /sessions/:id/status (or the orchestrator's /session/remote/:id)
   *  and wait for ready before opening the offer; otherwise the
   *  handshake races the boot and you get a black-screen tab. */
  status: "booting" | "ready";
}

export interface PoolUnavailable extends PoolDescriptor {
  available: false;
}

const DEFAULT_TTL_SEC = 15 * 60; // 15 min — architect's recommendation

function poolUrl(): string | null {
  const u = process.env["REMOTE_BROWSER_POOL_URL"];
  if (!u) return null;
  return u.replace(/\/+$/, "");
}

function poolToken(): string | undefined {
  return process.env["REMOTE_BROWSER_POOL_TOKEN"];
}

async function poolFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = poolUrl();
  if (!base) throw new Error("pool_not_deployed");
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  const tok = poolToken();
  if (tok) headers.set("authorization", `Bearer ${tok}`);
  return fetch(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
}

export async function createPoolSession(opts: {
  regionId: string;
  fingerprint: SessionFingerprint;
  ttlSec?: number;
  /** Mid-session escalation state to replay. Origin-scoped: the pool
   *  MUST only apply cookies/localStorage to `origin`. Never wildcard. */
  seedState?: {
    url: string;
    origin: string;
    host: string;
    cookies: string;
    localStorage: Record<string, string>;
  };
}): Promise<PoolSession | PoolUnavailable> {
  if (!poolUrl()) {
    return { available: false, reason: "not_deployed", detail: "Set REMOTE_BROWSER_POOL_URL to enable." };
  }
  try {
    const res = await poolFetch("/sessions", {
      method: "POST",
      body: JSON.stringify({
        region: opts.regionId,
        // We forward only fields the pool needs to mount a coherent
        // headless browser. Canvas/audio noise are page-side concerns
        // and stay out of the pool request.
        fingerprint: {
          userAgent: opts.fingerprint.userAgent,
          platform: opts.fingerprint.platform,
          uaPlatform: opts.fingerprint.uaPlatform,
          language: opts.fingerprint.language,
          languages: opts.fingerprint.languages,
          timezone: opts.fingerprint.timezone,
          screenResolution: opts.fingerprint.screenResolution,
          colorDepth: opts.fingerprint.colorDepth,
          webglVendor: opts.fingerprint.webglVendor,
          webglRenderer: opts.fingerprint.webglRenderer,
          fonts: opts.fingerprint.fonts,
          hardwareConcurrency: opts.fingerprint.hardwareConcurrency,
          deviceMemory: opts.fingerprint.deviceMemory,
          maxTouchPoints: opts.fingerprint.maxTouchPoints,
        },
        ttlSec: opts.ttlSec ?? DEFAULT_TTL_SEC,
        ...(opts.seedState ? { seedState: opts.seedState } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const reason = res.status === 503 ? "no_capacity" : "pool_error";
      return { available: false, reason, detail: detail.slice(0, 200) };
    }
    const data = (await res.json()) as { id: string; signalUrl: string; iceServers?: PoolSession["iceServers"]; expiresAt?: string; status?: "booting" | "ready" };
    return {
      available: true,
      id: data.id,
      signalUrl: data.signalUrl,
      iceServers: data.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }],
      expiresAt: data.expiresAt ?? new Date(Date.now() + (opts.ttlSec ?? DEFAULT_TTL_SEC) * 1000).toISOString(),
      // Older pool versions that don't speak status should be treated
      // as ready — they were either always-warm or already blocked
      // until the container was up.
      status: data.status ?? "ready",
    };
  } catch (err) {
    return { available: false, reason: "pool_error", detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

/**
 * Lightweight readiness probe. The pool exposes
 *   GET /sessions/:id/status → { ready: boolean }
 * so the orchestrator can flip a "booting" session to "ready" without
 * opening a heartbeat-style POST. Defaults to ready if the pool 404s
 * the route — older pool versions are assumed to block until ready.
 */
export async function poolStatus(id: string): Promise<{ ready: boolean }> {
  if (!poolUrl()) return { ready: false };
  try {
    const res = await poolFetch(`/sessions/${encodeURIComponent(id)}/status`, { method: "GET" });
    if (res.status === 404) return { ready: true };
    if (!res.ok) return { ready: false };
    const data = (await res.json()) as { ready?: boolean };
    return { ready: !!data.ready };
  } catch { return { ready: false }; }
}

export async function heartbeatPoolSession(id: string): Promise<{ ok: boolean; idleSec?: number }> {
  if (!poolUrl()) return { ok: false };
  try {
    const res = await poolFetch(`/sessions/${encodeURIComponent(id)}/heartbeat`, { method: "POST" });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; idleSec?: number };
    return { ok: !!data.ok, idleSec: data.idleSec };
  } catch { return { ok: false }; }
}

export async function killPoolSession(id: string): Promise<void> {
  if (!poolUrl()) return;
  try { await poolFetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* ignore */ }
}

export function isPoolEnabled(): boolean {
  return poolUrl() !== null;
}
