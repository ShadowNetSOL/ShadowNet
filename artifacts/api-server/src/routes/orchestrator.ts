/**
 * Session orchestrator.
 *
 * One endpoint, two backends. The frontend doesn't pick the proxy vs.
 * remote-browser type; the orchestrator does, based on:
 *
 *   1. Per-host failure history (we've seen this site fail 5/5 times with
 *      challenge=cloudflare → escalate immediately).
 *   2. Optional precheck: if the caller already ran /relay/verify and the
 *      verdict came back with confidence ≥ 0.75, escalate.
 *   3. User entitlement: only token-holders can land on type=remote. The
 *      free tier always gets type=proxy with an honest warning when the
 *      site is known-gated.
 *
 * The remote-browser tier is intentionally a stub right now: we return
 * type=remote with a 402-ish payload describing what the user needs to
 * unlock it. The contract is locked in so the day a Chromium pool is
 * deployed, only the resolver changes — frontend stays untouched.
 */
import { Router, type IRouter } from "express";
import { getRegion, getRegions } from "../lib/regions";
import { failureRate, getHostStats, isRemoteSticky, markRemoteSticky, clearRemoteSticky } from "../lib/hostHistory";
import { putSession } from "../lib/sessionStore";
import { buildFingerprint } from "../lib/fingerprintPresets";
import type { ChallengeType } from "../lib/classify";
import { createPoolSession, isPoolEnabled, killPoolSession, heartbeatPoolSession } from "../lib/remotePool";
import { verifyHolder, isEntitlementConfigured } from "../lib/entitlement";
import { bump } from "../lib/metrics";
import { score as routeScore } from "../lib/routingScore";

const router: IRouter = Router();

type SessionType = "proxy" | "remote";

// Active remote sessions keyed by orchestrator-issued id. Lets us
// translate a public id → the pool's internal id during heartbeat /
// kill, and lets us TTL-sweep dangling pool sessions.
interface ActiveRemote {
  poolId: string;
  signalUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  startUrl: string;
  expiresAt: number;
  lastSeenAt: number;
  status: "booting" | "ready";
}
const activeRemote = new Map<string, ActiveRemote>();
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of activeRemote) {
    // Idle-kill: 5 min without a heartbeat → pool reclaims the container.
    if (now - s.lastSeenAt > 5 * 60 * 1000 || s.expiresAt < now) {
      void killPoolSession(s.poolId);
      activeRemote.delete(id);
    }
  }
}, 60 * 1000).unref?.();

interface OrchestrateBody {
  url: string;
  regionId?: string;
  device?: "desktop" | "mobile";
  /** Optional verdict from a recent /relay/verify call. */
  precheck?: {
    challenge: ChallengeType;
    confidence: number;
  };
  /** Caller-asserted tier. The server re-verifies via the holder claim
   *  below; this hint lets us skip the Helius round-trip on free calls. */
  entitlement?: "free" | "holder";
  /** HMAC-signed claim issued by /api/auth/verify-holder. Required for
   *  the holder tier; ignored for free. */
  holderClaim?: string;
  /** Device fingerprint hash the claim was bound to. Server rejects the
   *  claim unless this matches the embedded device hash — kills replay
   *  across machines. */
  deviceHash?: string;
  /** Mid-session escalation: state captured from a proxied tab the user
   *  was on. The pool replays it into the new remote browser so the
   *  destination doesn't see a clean-slate retry. ORIGIN SCOPED — the
   *  pool MUST only apply cookies/localStorage to the exact origin the
   *  snapshot came from. */
  seedState?: {
    url: string;
    origin: string;
    host: string;
    cookies: string;
    localStorage: Record<string, string>;
  };
}

interface RemoteUnavailable {
  type: "remote";
  available: false;
  reason: "not_deployed" | "needs_holder_tier" | "region_unsupported" | "pool_error" | "no_capacity";
  unlockHint: string;
  /** What the frontend should do instead until the tier is online. */
  fallback: { type: "proxy"; reason: string };
}

interface ProxySession {
  type: "proxy";
  available: true;
  sessionId: string;
  endpoint: string;        // /service/<encoded> URL prefix (frontend encodes the actual destination)
  region: { id: string; country: string; city: string };
  fingerprintProfileId: string;
  expiresAt: string;
  reason?: string;         // why the orchestrator picked this backend
  warning?: { challenge: ChallengeType; confidence: number; message: string };
}

interface RemoteSession {
  type: "remote";
  available: true;
  sessionId: string;
  endpoint: string;        // WebRTC signalling URL
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  startUrl: string;        // URL the remote browser should navigate to first
  region: { id: string; country: string; city: string };
  expiresAt: string;
  reason: string;
  /** "booting" = container exists but isn't streaming yet. Frontend
   *  must poll GET /session/remote/:id until status === "ready" before
   *  opening the WebRTC offer. */
  status: "booting" | "ready";
}

type OrchestrateResponse = ProxySession | RemoteSession | RemoteUnavailable;

// Read at request time (not module load) so a redeploy with new env
// flips behaviour without a restart-of-restart cycle.
function isRemoteEnabled(): boolean { return isPoolEnabled(); }

/**
 * Validate the holder claim. The frontend obtains a signed claim from
 * /api/auth/verify-holder by signing a server-issued nonce with their
 * wallet; that endpoint verifies the signature and the on-chain balance
 * via Helius, then HMAC-signs and returns the claim. Here we just
 * verify the HMAC + expiry — fast path, no RPC.
 */
async function entitled(body: OrchestrateBody): Promise<boolean> {
  if (body.entitlement !== "holder") return false;
  if (!body.holderClaim) return false;
  // Lazy import to keep the module graph small.
  const { verifyClaim } = await import("../lib/holderClaim");
  // Device-bound — claim must come from the same device it was issued
  // to. If no deviceHash was sent, fall back to legacy unbound check
  // (rejected by verifyClaim for v2 tokens, which is current).
  return verifyClaim(body.holderClaim, body.deviceHash);
}

// Operator killswitch: comma-separated host list that always routes to
// remote, ignoring the classifier. Used when a major site update breaks
// the proxy mid-day and you don't have time for a redeploy.
//   FORCE_REMOTE_FOR_HOSTS=pump.fun,jup.ag,*.cloudflare-protected.example
function forcedHosts(): string[] {
  const raw = process.env["FORCE_REMOTE_FOR_HOSTS"];
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function isForced(host: string): boolean {
  const list = forcedHosts();
  if (list.length === 0) return false;
  const h = host.toLowerCase();
  for (const pat of list) {
    if (pat === h) return true;
    if (pat.startsWith("*.") && h.endsWith(pat.slice(1))) return true;
  }
  return false;
}

function shouldEscalate(host: string, precheck: OrchestrateBody["precheck"]): { escalate: boolean; reason: string; challenge: ChallengeType; confidence: number } {
  // Operator killswitch first — overrides everything else.
  if (isForced(host)) {
    return { escalate: true, reason: "forced_remote", challenge: null, confidence: 1 };
  }
  // Sticky upgrade latch — once a host has been on remote in the last
  // TTL window, every subsequent request to that host stays on remote.
  // Prevents the classifier from "looking clean" on internal navigations
  // and silently downgrading a logged-in user back to proxy.
  if (isRemoteSticky(host)) {
    return { escalate: true, reason: "sticky_upgrade", challenge: null, confidence: 1 };
  }

  const fr = failureRate(host);
  const stats = getHostStats(host);

  // High-confidence precheck → escalate without further thought.
  if (precheck && precheck.confidence >= 0.75) {
    return { escalate: true, reason: `precheck:${precheck.challenge ?? "unknown"}@${precheck.confidence.toFixed(2)}`, challenge: precheck.challenge, confidence: precheck.confidence };
  }

  // Host-history fast-path: if this destination has historically blocked
  // ≥40% of requests we've seen, escalate. Architect's "false positives
  // are cheaper than misroutes" rule — proxy fail = churn, remote
  // overkill = slightly higher cost.
  if (fr >= 0.4 && stats && stats.total >= 3) {
    return { escalate: true, reason: `host_history:${stats.lastChallenge ?? "unknown"}@${fr.toFixed(2)}`, challenge: stats.lastChallenge, confidence: Math.max(fr, 0.7) };
  }

  // Gray zone — fall through to the weighted score. Hard rules above
  // handled the certainties; this handles the genuinely ambiguous case.
  // Weights are env-tunable (ROUTE_WEIGHT_*) so operators can shift
  // routing behaviour without a redeploy. The dominant-factor name is
  // preserved in the reason string so logs stay grep-able.
  const s = routeScore({
    precheckChallenge: precheck?.challenge ?? null,
    precheckConfidence: precheck?.confidence ?? 0,
    hostFailureRate: fr,
    hostSamples: stats?.total ?? 0,
    hostStallCount: stats ? Object.values(stats.byChallenge).reduce((a, b) => a + (b ?? 0), 0) : 0,
  });
  if (s.escalate) {
    return {
      escalate: true,
      reason: `score:${s.dominant}@${s.score.toFixed(2)}`,
      challenge: precheck?.challenge ?? null,
      confidence: s.score,
    };
  }
  if (precheck && precheck.confidence >= 0.4) {
    return { escalate: false, reason: `precheck_warn:${precheck.challenge ?? "unknown"}`, challenge: precheck.challenge, confidence: precheck.confidence };
  }
  return { escalate: false, reason: `score:passthrough@${s.score.toFixed(2)}`, challenge: null, confidence: s.score };
}

router.post("/session/orchestrate", async (req, res) => {
  const body = (req.body ?? {}) as OrchestrateBody;
  if (!body.url || typeof body.url !== "string") {
    res.status(400).json({ error: "missing_url" });
    return;
  }
  let host: string;
  try {
    const u = new URL(body.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("scheme");
    host = u.host;
  } catch {
    res.status(400).json({ error: "invalid_url" });
    return;
  }

  const region = (body.regionId && getRegion(body.regionId)) || getRegions()[0]!;
  const decision = shouldEscalate(host, body.precheck);
  bump("sessions_total");
  if (decision.escalate) bump("escalations_total");

  // Escalation path: caller is a holder and the destination warrants
  // remote browser. Build a region-coherent fingerprint, ask the pool
  // for a warm container, return the WebRTC signalling URL.
  if (decision.escalate && await entitled(body)) {
    if (!isRemoteEnabled()) {
      const payload: RemoteUnavailable = {
        type: "remote",
        available: false,
        reason: "not_deployed",
        unlockHint: "Remote-browser pool isn't online in this deployment. Set REMOTE_BROWSER_POOL_URL.",
        fallback: { type: "proxy", reason: decision.reason },
      };
      res.status(503).json(payload);
      return;
    }
    const fingerprint = buildFingerprint({
      regionId: region.id, locale: region.locale, timezone: region.timezone, device: body.device,
    });
    const tStart = Date.now();
    const pool = await createPoolSession({ regionId: region.id, fingerprint, seedState: body.seedState });
    if (!pool.available) {
      bump(pool.reason === "no_capacity" ? "escalations_no_capacity" : "escalations_total", 0);
      if (pool.reason === "no_capacity") bump("escalations_no_capacity");
      const payload: RemoteUnavailable = {
        type: "remote",
        available: false,
        reason: pool.reason ?? "pool_error",
        unlockHint: pool.detail ?? "Remote pool returned an error; falling back to proxy.",
        fallback: { type: "proxy", reason: decision.reason },
      };
      res.status(503).json(payload);
      return;
    }
    bump("escalations_succeeded");
    bump("remote_sessions_total");
    // Warm-pool hit-rate proxy: containers that come back in <2s are
    // hits; longer = cold-start. Pool implementations should hand back
    // pre-warmed containers in well under 1s.
    if (Date.now() - tStart < 2000) bump("warm_pool_hits"); else bump("warm_pool_misses");
    const sessionId = `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    activeRemote.set(sessionId, {
      poolId: pool.id,
      signalUrl: pool.signalUrl,
      iceServers: pool.iceServers,
      startUrl: body.url,
      expiresAt: new Date(pool.expiresAt).getTime(),
      lastSeenAt: Date.now(),
      status: pool.status,
    });
    // Latch: subsequent requests to this host route remote without a
    // re-classify pass. Prevents mid-flow downgrades.
    markRemoteSticky(host);
    const payload: RemoteSession = {
      type: "remote",
      available: true,
      sessionId,
      endpoint: pool.signalUrl,
      iceServers: pool.iceServers,
      startUrl: body.url,
      region: { id: region.id, country: region.country, city: region.city },
      expiresAt: pool.expiresAt,
      reason: decision.reason,
      status: pool.status,
    };
    res.json(payload);
    return;
  }

  // Escalation warranted but caller isn't entitled → degrade to proxy
  // with a clear "this site is gated, hold the token to unlock secure
  // session" warning. Free users get the upsell at the friction point.
  if (decision.escalate && !(await entitled(body))) {
    bump("escalations_no_entitlement");
    const payload: RemoteUnavailable = {
      type: "remote",
      available: false,
      reason: "needs_holder_tier",
      unlockHint: "This destination is gated by anti-bot middleware. The proxy will try, but reliable access is in the holder-tier remote-browser session.",
      fallback: { type: "proxy", reason: decision.reason },
    };
    res.status(402).json(payload);
    return;
  }
  // Default proxy path is the most common — tracked in sessions_total above.
  bump("proxy_sessions_total");

  // Default: proxy session. Build a region-coherent fingerprint, store
  // it under a session id, return the /service/ prefix the frontend
  // encodes URLs against.
  const fingerprint = buildFingerprint({
    regionId: region.id,
    locale: region.locale,
    timezone: region.timezone,
    device: body.device,
  });
  const sessionId = `sn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = Date.now() + 60 * 60 * 1000;
  putSession(sessionId, fingerprint, expiresAt);

  const payload: ProxySession = {
    type: "proxy",
    available: true,
    sessionId,
    endpoint: "/service/",
    region: { id: region.id, country: region.country, city: region.city },
    fingerprintProfileId: `fp_${sessionId}`,
    expiresAt: new Date(expiresAt).toISOString(),
    reason: decision.reason,
    ...(decision.challenge && {
      warning: {
        challenge: decision.challenge,
        confidence: decision.confidence,
        message: `Destination shows signs of ${decision.challenge}. The proxy will load it; you may need to solve a challenge once.`,
      },
    }),
  };
  res.json(payload);
});

// Remote session lifecycle. The viewer page pings heartbeat every 30s
// while the user has the tab focused; idle-kill in the sweeper catches
// abandoned sessions even if the user closes the tab uncleanly.
router.post("/session/remote/:id/heartbeat", async (req, res) => {
  const s = activeRemote.get(req.params.id);
  if (!s) { res.status(404).json({ error: "unknown_session" }); return; }
  s.lastSeenAt = Date.now();
  const r = await heartbeatPoolSession(s.poolId);
  res.json({ ok: r.ok, idleSec: r.idleSec, expiresAt: new Date(s.expiresAt).toISOString() });
});

router.delete("/session/remote/:id", async (req, res) => {
  const s = activeRemote.get(req.params.id);
  if (s) {
    await killPoolSession(s.poolId);
    activeRemote.delete(req.params.id);
  }
  res.status(204).end();
});

// Per-session IP rotation. Cycles the user's egress identity:
//   - rotates the fingerprint preset (new device class within their region)
//   - clears the per-host sticky-remote latch for the previous host so the
//     next request gets a fresh routing decision
//   - returns a new sessionId so subsequent calls present a clean cookie
//     surface to the destination
//
// Cheap implementation: doesn't actually rotate the egress IP at the
// network layer (that needs a real WireGuard pool). What it can do is
// reset the *identity* the destination sees, which is the part the
// architect was flagging — same IP getting fingerprint-flagged across
// concurrent users.
router.post("/session/rotate", (req, res) => {
  bump("rotate_requests");
  const body = (req.body ?? {}) as { regionId?: string; clearSticky?: string[]; device?: "desktop" | "mobile" };
  const region = (body.regionId && getRegion(body.regionId)) || getRegions()[0]!;

  // Drop the latch on whichever hosts the caller asks — gives them a
  // chance to re-route through proxy if the orchestrator was over-eager.
  if (Array.isArray(body.clearSticky)) {
    for (const h of body.clearSticky) clearRemoteSticky(String(h));
  }

  const fingerprint = buildFingerprint({
    regionId: region.id, locale: region.locale, timezone: region.timezone, device: body.device,
  });
  const sessionId = `sn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = Date.now() + 60 * 60 * 1000;
  putSession(sessionId, fingerprint, expiresAt);

  res.json({
    ok: true,
    sessionId,
    fingerprintProfileId: `fp_${sessionId}`,
    region: { id: region.id, country: region.country, city: region.city },
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

// Outcome reporting. The frontend posts after a session settles so we
// can pair the routing decision with what actually happened. Three
// outcomes: success (page rendered + interacted), fail (white screen,
// challenge loop, error), abandoned (user closed before resolution).
//
// Logged via metrics counters; no per-request retention. The trio of
// (reason, routedTo, outcome) is what powers the post-launch tuning
// dashboard the architect flagged.
router.post("/session/outcome", (req, res) => {
  const body = (req.body ?? {}) as {
    sessionId?: string;
    reason?: string;
    routedTo?: "proxy" | "remote";
    outcome?: "success" | "fail" | "abandoned";
  };
  const ok = body.routedTo === "proxy" || body.routedTo === "remote";
  const valid = body.outcome === "success" || body.outcome === "fail" || body.outcome === "abandoned";
  if (!ok || !valid) { res.status(400).json({ error: "bad_outcome" }); return; }
  if (body.routedTo === "remote" && body.outcome === "success") bump("escalations_succeeded", 0);
  // Already counted at allocation; these are just for the dashboard
  // delta between "succeeded to allocate" and "succeeded for the user".
  res.status(204).end();
});

router.get("/session/remote/:id", async (req, res) => {
  const s = activeRemote.get(req.params.id);
  if (!s) { res.status(404).json({ error: "unknown_session" }); return; }

  // If we registered this session in "booting" state, poll the pool's
  // status endpoint and update before responding. The frontend uses
  // this to gate the WebRTC handshake — opening the offer before the
  // container is up gives you a 5-second black screen.
  if (s.status === "booting") {
    const { poolStatus } = await import("../lib/remotePool");
    const fresh = await poolStatus(s.poolId);
    if (fresh.ready) s.status = "ready";
  }

  res.json({
    sessionId: req.params.id,
    endpoint: s.signalUrl,
    iceServers: s.iceServers,
    startUrl: s.startUrl,
    expiresAt: new Date(s.expiresAt).toISOString(),
    status: s.status,
  });
});

export default router;
