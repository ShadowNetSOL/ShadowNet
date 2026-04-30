/**
 * X scan cache + self-tracked username history.
 *
 * Two coupled stores. Both in-memory; resets on restart. For a real
 * indexed pipeline you'd back these with Redis or Postgres, but for
 * the launch path the in-process cache delivers the "instant repeat
 * scan" UX the architect spec called for, and the username-history
 * tracker captures rename events going forward — which is exactly
 * what Wayback couldn't reliably do.
 *
 *   xScanCache   keyed by lowercased handle, 10-min TTL
 *   userHistory  keyed by stable Twitter user_id; every scan that
 *                lands a different username for the same id appends
 *                a row, surfacing rename history.
 */

interface CacheEntry<T> { value: T; expiresAt: number; }
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { cache.delete(key); return undefined; }
  return e.value as T;
}

export function cachePut<T>(key: string, value: T, ttlMs: number = TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheKey(kind: "xca" | "smartf", handle: string): string {
  return `${kind}:${handle.toLowerCase()}`;
}

// ── username history ────────────────────────────────────────────────

interface HistoryRow {
  username: string;
  firstSeen: number;  // ms epoch
  lastSeen: number;
}
// userId → list of historical usernames (most recent last).
const userHistory = new Map<string, HistoryRow[]>();

export function recordUsername(userId: string, username: string): void {
  if (!userId || !username) return;
  const now = Date.now();
  const rows = userHistory.get(userId) ?? [];
  const existing = rows.find((r) => r.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    existing.lastSeen = now;
  } else {
    rows.push({ username, firstSeen: now, lastSeen: now });
  }
  userHistory.set(userId, rows);
}

export function getUsernameHistory(userId: string): HistoryRow[] {
  return userHistory.get(userId) ?? [];
}

/** Names tied to this user_id that are NOT the current handle. Sorted
 *  by lastSeen desc — most recent prior handle first. */
export function previousNamesFor(userId: string, currentHandle: string): HistoryRow[] {
  const cur = currentHandle.toLowerCase();
  return (userHistory.get(userId) ?? [])
    .filter((r) => r.username.toLowerCase() !== cur)
    .sort((a, b) => b.lastSeen - a.lastSeen);
}
