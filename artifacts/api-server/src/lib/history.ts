// Per-subject ring buffer of score snapshots.
// In-memory only — survives within a process lifetime, not across restarts.
// Swap for a small Postgres table if durable history is required.

interface Snapshot {
  ts: number;
  score: number;
}

const HISTORY_LIMIT = 24; // up to 24 snapshots per subject (e.g. last day @ hourly)
const MIN_INTERVAL_MS = 5 * 60_000; // collapse repeated scans within 5 minutes
const MAX_SUBJECTS = 5000; // hard cap on distinct subjects we'll remember (LRU)
const histories = new Map<string, Snapshot[]>();

function lruTouchHistories(key: string, value: Snapshot[]): void {
  // Insertion order = recency. Re-insert to move to the end.
  histories.delete(key);
  histories.set(key, value);
  while (histories.size > MAX_SUBJECTS) {
    const oldest = histories.keys().next().value;
    if (oldest === undefined) break;
    histories.delete(oldest);
  }
}

/** Record a score snapshot for a subject (wallet address, repo full_name, etc). */
export function pushScore(subject: string, score: number): void {
  const arr = histories.get(subject) ?? [];
  const last = arr[arr.length - 1];
  if (last && Date.now() - last.ts < MIN_INTERVAL_MS) {
    // Replace the most recent point instead of stacking duplicates
    arr[arr.length - 1] = { ts: Date.now(), score };
  } else {
    arr.push({ ts: Date.now(), score });
    if (arr.length > HISTORY_LIMIT) arr.shift();
  }
  lruTouchHistories(subject, arr);
}

export function getScoreHistory(subject: string): Snapshot[] {
  return histories.get(subject) ?? [];
}

// ── Wallet token-purchase history (powers the copy-trade signal) ─────────────

interface PurchaseRecord {
  ts: number;
  mint: string;
  symbol: string;
  entryPriceUsd: number; // best-effort price at scan time
}

const purchases = new Map<string, PurchaseRecord[]>();
const PURCHASE_LIMIT = 50;
const MAX_WALLETS = 5000;

export function recordPurchases(wallet: string, items: PurchaseRecord[]): void {
  if (items.length === 0) return;
  const existing = purchases.get(wallet) ?? [];
  // Merge by mint, keep the EARLIEST entry price we saw
  const byMint = new Map(existing.map(p => [p.mint, p]));
  for (const it of items) {
    if (!byMint.has(it.mint)) byMint.set(it.mint, it);
  }
  const merged = [...byMint.values()].sort((a, b) => b.ts - a.ts).slice(0, PURCHASE_LIMIT);
  // LRU touch
  purchases.delete(wallet);
  purchases.set(wallet, merged);
  while (purchases.size > MAX_WALLETS) {
    const oldest = purchases.keys().next().value;
    if (oldest === undefined) break;
    purchases.delete(oldest);
  }
}

export function getPurchases(wallet: string): PurchaseRecord[] {
  return purchases.get(wallet) ?? [];
}
