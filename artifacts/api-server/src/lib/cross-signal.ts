// Cross-signal entity graph.
//
// Connects three independent signal streams:
//   - Wallets that have traded / minted a token  (signal: TRADE)
//   - GitHub repos that mention a token in README (signal: REPO)
//   - X accounts that posted a token CA          (signal: X — wired-up surface only)
//
// In-memory graph keyed by mint address. Each link is bidirectional so we can
// answer "which mints does THIS wallet share with repos?" and "which wallets
// have ever touched THIS mint?" in O(1).
//
// Bounded by an LRU cap on distinct mints (memory protection — see MAX_MINTS).
// Replace with Postgres later if persistence is required.

export type SignalSource = "wallet" | "repo" | "x";

interface MintLinks {
  wallets: Set<string>;
  repos: Set<string>;     // owner/repo
  x: Set<string>;         // @handle (lowercased)
  firstSeen: number;
  lastSeen: number;
}

const MAX_MINTS = 5000;
const MAX_PER_BUCKET = 50;

const mintLinks = new Map<string, MintLinks>();
const walletToMints = new Map<string, Set<string>>();
const repoToMints = new Map<string, Set<string>>();
const xToMints = new Map<string, Set<string>>();

function pruneReverseKey(map: Map<string, Set<string>>, key: string, mint: string): void {
  const bucket = map.get(key);
  if (!bucket) return;
  bucket.delete(mint);
  if (bucket.size === 0) map.delete(key);
}

function lruTouch(mint: string, links: MintLinks): void {
  mintLinks.delete(mint);
  mintLinks.set(mint, links);
  while (mintLinks.size > MAX_MINTS) {
    const oldest = mintLinks.keys().next().value;
    if (oldest === undefined) break;
    const removed = mintLinks.get(oldest);
    mintLinks.delete(oldest);
    if (!removed) continue;
    // Remove the mint from reverse indexes AND drop empty reverse keys (no leak)
    for (const w of removed.wallets) pruneReverseKey(walletToMints, w, oldest);
    for (const r of removed.repos) pruneReverseKey(repoToMints, r, oldest);
    for (const xh of removed.x) pruneReverseKey(xToMints, xh, oldest);
  }
}

function ensureLinks(mint: string): MintLinks {
  let links = mintLinks.get(mint);
  if (!links) {
    links = { wallets: new Set(), repos: new Set(), x: new Set(), firstSeen: Date.now(), lastSeen: Date.now() };
  }
  links.lastSeen = Date.now();
  return links;
}

/** Trim a Set to the last MAX_PER_BUCKET entries; returns evicted entries so reverse indexes can be cleaned. */
function trimSet(s: Set<string>): string[] {
  if (s.size <= MAX_PER_BUCKET) return [];
  const arr = [...s];
  const keep = new Set(arr.slice(-MAX_PER_BUCKET));
  const evicted: string[] = [];
  for (const v of arr) {
    if (!keep.has(v)) evicted.push(v);
  }
  s.clear();
  for (const v of keep) s.add(v);
  return evicted;
}

function trimMintBucket(map: Map<string, Set<string>>, key: string): void {
  const s = map.get(key);
  if (!s) return;
  if (s.size <= MAX_PER_BUCKET) return;
  const arr = [...s];
  s.clear();
  for (const v of arr.slice(-MAX_PER_BUCKET)) s.add(v);
}

export function linkWalletMint(wallet: string, mint: string): void {
  if (!wallet || !mint) return;
  const links = ensureLinks(mint);
  links.wallets.add(wallet);
  const evicted = trimSet(links.wallets);
  for (const w of evicted) pruneReverseKey(walletToMints, w, mint);
  lruTouch(mint, links);

  let bucket = walletToMints.get(wallet);
  if (!bucket) { bucket = new Set(); walletToMints.set(wallet, bucket); }
  bucket.add(mint);
  trimMintBucket(walletToMints, wallet);
}

export function linkRepoMint(repoFullName: string, mint: string): void {
  if (!repoFullName || !mint) return;
  const repo = repoFullName.toLowerCase();
  const links = ensureLinks(mint);
  links.repos.add(repo);
  const evicted = trimSet(links.repos);
  for (const r of evicted) pruneReverseKey(repoToMints, r, mint);
  lruTouch(mint, links);

  let bucket = repoToMints.get(repo);
  if (!bucket) { bucket = new Set(); repoToMints.set(repo, bucket); }
  bucket.add(mint);
  trimMintBucket(repoToMints, repo);
}

export function linkXMint(handle: string, mint: string): void {
  if (!handle || !mint) return;
  const h = handle.replace(/^@/, "").toLowerCase();
  if (!h) return;
  const links = ensureLinks(mint);
  links.x.add(h);
  const evicted = trimSet(links.x);
  for (const e of evicted) pruneReverseKey(xToMints, e, mint);
  lruTouch(mint, links);

  let bucket = xToMints.get(h);
  if (!bucket) { bucket = new Set(); xToMints.set(h, bucket); }
  bucket.add(mint);
  trimMintBucket(xToMints, h);
}

/**
 * Mask a Solana wallet address so prior-scan addresses aren't leaked verbatim
 * to unrelated callers. Keeps first 4 + last 4 chars (enough to identify a
 * wallet you already know, opaque otherwise).
 */
export function maskWallet(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export interface CrossSignalEntry {
  mint: string;
  sources: { wallets: string[]; repos: string[]; x: string[] };
  sourceTypeCount: number;     // how many of {wallet, repo, x} are non-empty
  multiSourced: boolean;       // sourceTypeCount >= 2
  verdict: "SAME_ENTITY_LIKELY" | "CONVERGENT_INTEREST" | "ISOLATED";
  reason: string;
}

function buildEntry(mint: string, links: MintLinks): CrossSignalEntry {
  const wallets = [...links.wallets].slice(-12);
  const repos = [...links.repos].slice(-12);
  const x = [...links.x].slice(-12);
  const sourceTypeCount = (wallets.length > 0 ? 1 : 0) + (repos.length > 0 ? 1 : 0) + (x.length > 0 ? 1 : 0);
  const multi = sourceTypeCount >= 2;

  let verdict: CrossSignalEntry["verdict"] = "ISOLATED";
  let reason = "Only one signal source has touched this token.";

  // Verdict policy: SAME_ENTITY_LIKELY is a strong identity claim — only assert it
  // when all three channels (wallet + repo + X) line up on the same mint. Two-source
  // overlaps are downgraded to CONVERGENT_INTEREST; the user can drill in to judge
  // whether it's a coincidence or actual co-ownership.
  if (sourceTypeCount === 3) {
    verdict = "SAME_ENTITY_LIKELY";
    reason = `Promoted on X by ${x.length} account(s), hosted in ${repos.length} repo(s), and traded by ${wallets.length} wallet(s) — strong signal that the same entity controls every channel.`;
  } else if (sourceTypeCount === 2) {
    verdict = "CONVERGENT_INTEREST";
    if (repos.length && wallets.length) {
      reason = `Hosted in ${repos.length} GitHub repo(s) AND traded by ${wallets.length} scanned wallet(s) — channels converge on this token (coincidence or coordinated, drill in to judge).`;
    } else if (repos.length && x.length) {
      reason = `Promoted on X and referenced in GitHub README — coordinated promotion, but no on-chain wallet match yet.`;
    } else if (wallets.length && x.length) {
      reason = `Promoted on X and traded by scanned wallets — potential coordinated buy.`;
    }
  }

  return { mint, sources: { wallets, repos, x }, sourceTypeCount, multiSourced: multi, verdict, reason };
}

/** Look up a single mint's full cross-signal picture. */
export function getCrossSignals(mint: string): CrossSignalEntry | null {
  const links = mintLinks.get(mint);
  if (!links) return null;
  return buildEntry(mint, links);
}

/** Cross-signal entries for every mint a wallet has touched (only multi-sourced). */
export function getCrossSignalsForWallet(wallet: string): CrossSignalEntry[] {
  const mints = walletToMints.get(wallet);
  if (!mints) return [];
  const out: CrossSignalEntry[] = [];
  for (const m of mints) {
    const links = mintLinks.get(m);
    if (!links) continue;
    const entry = buildEntry(m, links);
    // Only return entries with >1 distinct source TYPE — the whole point is convergence
    if (entry.multiSourced) out.push(entry);
  }
  return out
    .sort((a, b) => b.sourceTypeCount - a.sourceTypeCount)
    .slice(0, 10);
}

/** Cross-signal entries for every mint a repo has mentioned (only multi-sourced). */
export function getCrossSignalsForRepo(repoFullName: string): CrossSignalEntry[] {
  const repo = repoFullName.toLowerCase();
  const mints = repoToMints.get(repo);
  if (!mints) return [];
  const out: CrossSignalEntry[] = [];
  for (const m of mints) {
    const links = mintLinks.get(m);
    if (!links) continue;
    const entry = buildEntry(m, links);
    if (entry.multiSourced) out.push(entry);
  }
  return out
    .sort((a, b) => b.sourceTypeCount - a.sourceTypeCount)
    .slice(0, 10);
}

/** Lightweight stats for diagnostics. */
export function crossSignalStats(): { mints: number; wallets: number; repos: number; x: number } {
  return {
    mints: mintLinks.size,
    wallets: walletToMints.size,
    repos: repoToMints.size,
    x: xToMints.size,
  };
}
