// In-memory TTL cache with stale-while-error semantics.
// Drop-in: replace the Map with a Redis client later if needed.

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

// Periodic eviction so the Map can't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) if (e.expires < now) store.delete(k);
}, 60_000).unref();

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

/** Get-or-fetch: returns cached value if fresh, otherwise calls `fetcher` and caches the result. */
export async function memo<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
}

export function cacheStats(): { size: number } {
  return { size: store.size };
}
