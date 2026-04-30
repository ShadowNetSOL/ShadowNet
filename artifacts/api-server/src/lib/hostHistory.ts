/**
 * Per-host failure history.
 *
 * Tracks how often each destination host trips the classifier and which
 * challenge type dominates. The orchestrator uses this to fast-path
 * known-gated hosts straight to the remote-browser tier instead of
 * letting the user hit a white-screen-loop first.
 *
 * In-memory only (resets on process restart) — fine for now; if we move
 * to multi-region we'll mirror this in Redis. No PII: just hostname,
 * counts, and challenge labels.
 */
import type { ChallengeType, Verdict } from "./classify";

interface HostStats {
  total: number;
  failures: number;
  lastChallenge: ChallengeType;
  lastConfidence: number;
  lastSeenAt: number;
  byChallenge: Partial<Record<NonNullable<ChallengeType>, number>>;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const store = new Map<string, HostStats>();

export function recordHostSuccess(host: string): void {
  const cur = store.get(host) ?? blank();
  cur.total += 1;
  cur.lastSeenAt = Date.now();
  store.set(host, cur);
}

export function recordHostFailure(host: string, verdict: Verdict): void {
  const cur = store.get(host) ?? blank();
  cur.total += 1;
  cur.failures += 1;
  cur.lastChallenge = verdict.challenge;
  cur.lastConfidence = verdict.confidence;
  cur.lastSeenAt = Date.now();
  if (verdict.challenge) {
    cur.byChallenge[verdict.challenge] = (cur.byChallenge[verdict.challenge] ?? 0) + 1;
  }
  store.set(host, cur);
}

export function getHostStats(host: string): HostStats | undefined {
  const cur = store.get(host);
  if (!cur) return undefined;
  if (Date.now() - cur.lastSeenAt > TTL_MS) {
    store.delete(host);
    return undefined;
  }
  return cur;
}

/** Failure rate over the last TTL window. Returns 0 for unknown hosts. */
export function failureRate(host: string): number {
  const s = getHostStats(host);
  if (!s || s.total === 0) return 0;
  return s.failures / s.total;
}

// Sticky upgrade latch.
//
// Once a host has been routed to the remote tier, we never silently
// downgrade it back to proxy in the same TTL window — even if the
// classifier comes back clean on a subsequent request. Reason: a user
// mid-flow on a remote session who navigates internally would lose
// cookies / login / signed-in state if we routed the next nav back
// through the proxy.
//
// The latch is per-host, not per-session, so a user opening a fresh tab
// to the same gated host also gets the upgraded path.
const stickyRemote = new Map<string, number>(); // host → expiry timestamp
const STICKY_TTL_MS = 60 * 60 * 1000;

export function markRemoteSticky(host: string): void {
  stickyRemote.set(host, Date.now() + STICKY_TTL_MS);
}

export function isRemoteSticky(host: string): boolean {
  const exp = stickyRemote.get(host);
  if (!exp) return false;
  if (exp < Date.now()) { stickyRemote.delete(host); return false; }
  return true;
}

export function clearRemoteSticky(host: string): void {
  stickyRemote.delete(host);
}

function blank(): HostStats {
  return { total: 0, failures: 0, lastChallenge: null, lastConfidence: 0, lastSeenAt: Date.now(), byChallenge: {} };
}
