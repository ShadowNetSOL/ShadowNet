/**
 * In-memory session store.
 *
 * Holds the fingerprint identity for a session id so the bare-server hook
 * can align outgoing request headers (UA, Accept-Language, sec-ch-ua-*)
 * with the page-side shim. Sessions expire after 1 hour of inactivity;
 * a sweeper runs every 5 minutes.
 *
 * No PII, no IPs, no request bodies. Cleared on process restart by design.
 */

export interface SessionFingerprint {
  regionId: string;
  userAgent: string;
  platform: string;
  uaPlatform: string;
  language: string;
  languages: string[];
  timezone: string;
  screenResolution: string;
  colorDepth: number;
  webglVendor: string;
  webglRenderer: string;
  canvasNoise: string;
  audioNoise: string;
  fonts: string[];
  // Performance/CPU surface — anti-bot infers device class from these.
  // A "US Desktop Chrome" with hardwareConcurrency=2 reads as a
  // disguised low-end mobile device.
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
}

interface Entry {
  fp: SessionFingerprint;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function putSession(id: string, fp: SessionFingerprint, expiresAt: number): void {
  store.set(id, { fp, expiresAt });
}

export function getSession(id: string): SessionFingerprint | undefined {
  const e = store.get(id);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    store.delete(id);
    return undefined;
  }
  return e.fp;
}

export function dropSession(id: string): void {
  store.delete(id);
}

let sweeper: NodeJS.Timeout | null = null;
export function startSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, e] of store) if (e.expiresAt < now) store.delete(id);
  }, 5 * 60 * 1000);
  sweeper.unref?.();
}
