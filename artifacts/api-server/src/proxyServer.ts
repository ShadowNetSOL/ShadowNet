/**
 * Ultraviolet bare-server integration.
 *
 * Replaces the legacy fetch-passthrough proxy with a service-worker-based
 * rewriter (Ultraviolet over @tomphttp/bare-server-node). The frontend
 * registers a service worker that intercepts requests under /service/ and
 * routes them through the bare server at /bare/.
 *
 * Why this is more robust than the legacy proxy:
 *   - Service worker catches every fetch / XHR / WebSocket / sub-resource
 *     load by the page, not just URLs we managed to rewrite in HTML.
 *   - Dynamic imports, Next.js route changes, fetch() calls all stay inside
 *     the proxy boundary — fixes the white-screen-on-second-click bug.
 *   - WebSockets pass through bare's upgrade handler, so realtime sites
 *     (pump.fun, jup.ag, dexscreener) actually work.
 *
 * Privacy posture:
 *   - We log only: hostname, status, timestamp. Never bodies, never headers,
 *     never client IPs. Bare server is configured with a no-op logger.
 *   - The Server / X-Powered-By headers are stripped at the HTTP layer.
 */
import { createBareServer } from "@tomphttp/bare-server-node";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

const BARE_PREFIX = "/bare/";

// OFAC sanctioned country codes (ISO-3166-1 alpha-2). Best-effort soft block;
// we don't enforce client-side without geoip. Listed here so an upstream
// proxy layer (Cloudflare / Railway middleware) can pull and act on it.
export const OFAC_BLOCKED_CC = new Set(["IR", "CU", "KP", "SY"]);

type BareServerInstance = ReturnType<typeof createBareServer>;

let bare: BareServerInstance | null = null;

function blockedHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "::1") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  if (host.startsWith("172.")) {
    const second = parseInt(host.split(".")[1] ?? "", 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function getBareServer(): BareServerInstance {
  if (!bare) {
    bare = createBareServer(BARE_PREFIX, {
      // No request-level logging. Bare's own error log writes to stderr; we
      // disable it to avoid host metadata accidentally landing in Railway logs.
      logErrors: false,
      // filterRemote rejects by throwing. blockLocal already handles RFC1918
      // by default, but we add explicit checks for defense-in-depth.
      filterRemote: (remote) => {
        if (blockedHost(remote.host)) {
          throw new Error("Destination not permitted");
        }
      },
    });
  }
  return bare;
}

export function isBareRequest(req: IncomingMessage): boolean {
  return getBareServer().shouldRoute(req);
}

export function routeBareRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  delete req.headers["x-powered-by"];
  getBareServer().routeRequest(req, res);
}

export function routeBareUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void {
  getBareServer().routeUpgrade(req, socket, head);
}
