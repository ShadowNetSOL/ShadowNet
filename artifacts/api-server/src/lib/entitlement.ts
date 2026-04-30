/**
 * Token-gated entitlement check via Helius.
 *
 * The orchestrator calls this when a caller claims `holder` tier. We
 * verify by querying Helius for the wallet's SPL token balance against
 * a configured mint and threshold. Result cached in-memory for 5 min so
 * we don't hammer the RPC on every nav.
 *
 * Environment:
 *   ENTITLEMENT_DISABLED      — when "true", skips the on-chain check and
 *                               grants holder tier to any signature-verified
 *                               wallet. For pre-launch / dev only.
 *   ENTITLEMENT_MINT          — SPL mint address that gates the holder tier
 *   ENTITLEMENT_MIN_BALANCE   — minimum balance (in token's UI units; default 1)
 *   HELIUS_API_KEY            — required to make the RPC call
 *
 * Without the env, every check returns false (free tier only). The
 * orchestrator handles that gracefully — it just always serves the proxy
 * fallback for users that claim holder.
 */

interface CacheEntry {
  ok: boolean;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function entitlementDisabled(): boolean {
  const v = process.env["ENTITLEMENT_DISABLED"];
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase().trim());
}

function rpcUrl(): string | null {
  const key = process.env["HELIUS_API_KEY"];
  if (!key) return null;
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

function entitlementMint(): string | null {
  const m = process.env["ENTITLEMENT_MINT"];
  return m && m.length > 0 ? m : null;
}

function minBalance(): number {
  const raw = process.env["ENTITLEMENT_MIN_BALANCE"];
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

interface RpcAccountInfo {
  account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } };
}
interface RpcResponse {
  result?: { value?: RpcAccountInfo[] };
  error?: { message?: string };
}

/**
 * Returns true iff `wallet` holds ≥ENTITLEMENT_MIN_BALANCE of the
 * configured mint. Honest-default: when env is incomplete the call
 * returns false so we never accidentally grant the paid tier.
 *
 * When ENTITLEMENT_DISABLED=true, returns true for any signature-verified
 * wallet — used pre-launch when there is no token to gate against yet.
 */
export async function verifyHolder(wallet: string): Promise<boolean> {
  if (!isLikelyBase58Pubkey(wallet)) return false;
  if (entitlementDisabled()) return true;

  const url = rpcUrl();
  const mint = entitlementMint();
  if (!url || !mint) return false;

  const cached = cache.get(wallet);
  if (cached && cached.expiresAt > Date.now()) return cached.ok;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          { mint },
          { encoding: "jsonParsed" },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      cache.set(wallet, { ok: false, expiresAt: Date.now() + 30_000 });
      return false;
    }
    const data = (await res.json()) as RpcResponse;
    const accounts = data.result?.value ?? [];
    const total = accounts.reduce((sum, a) => sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
    const ok = total >= minBalance();
    cache.set(wallet, { ok, expiresAt: Date.now() + CACHE_TTL_MS });
    return ok;
  } catch {
    // Soft-fail on a transient RPC blip — short cache so we retry soon.
    cache.set(wallet, { ok: false, expiresAt: Date.now() + 30_000 });
    return false;
  }
}

export function isEntitlementConfigured(): boolean {
  if (entitlementDisabled()) return true;
  return rpcUrl() !== null && entitlementMint() !== null;
}

function isLikelyBase58Pubkey(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}
