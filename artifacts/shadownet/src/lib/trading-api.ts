// ShadowNet trading data layer.
//
// This module is the single source of truth for every external API call the
// trading terminal makes. Each function maps a UI field → an upstream endpoint.
// All keys come from env variables; nothing is hard-coded.
//
// ── REQUIRED ENV (Vite-prefixed for the browser bundle) ──────────────────
//   VITE_API_BASE              – your ShadowNet api-server origin
//                                 (proxies upstream calls so secrets stay server-side)
//   VITE_SOLANA_RPC            – Helius / Triton / QuickNode mainnet endpoint
//                                 (READ ops only — must be a regular RPC, NOT a sender)
//   VITE_DEFAULT_SLIPPAGE_BPS  – default 100 (=1%)
//
// ── REQUIRED ENV (server-side, never shipped to client) ──────────────────
//   JUPITER_API_KEY            – portal.jup.ag — required for Ultra Swap API
//                                 (lite-api.jup.ag is deprecated 2025-12-31)
//   BIRDEYE_API_KEY            – birdeye.so/api — token list, mcap, holders
//   DEXSCREENER_API_KEY        – optional, public endpoints work unauthenticated
//   GECKOTERMINAL_API_KEY      – optional, public OHLCV
//   HELIUS_API_KEY             – RPC + webhooks (already inside SOLANA_RPC)
//
// ── PLATFORM FEE COLLECTION (server-side) ────────────────────────────────
//   FEE_WALLET                 – your owner wallet address (collects all SOL fees)
//   FEE_ACCOUNT_WSOL           – ATA owned by FEE_WALLET for wrapped SOL
//   FEE_ACCOUNT_USDC           – ATA owned by FEE_WALLET for USDC
//   FEE_ACCOUNT_USDT           – ATA owned by FEE_WALLET for USDT
//   TREASURY_WALLET            – cold-storage destination for sweeping fees
//   PLATFORM_FEE_BPS           – default 100 (=1%) — passed to Jupiter
//                                 Jupiter caps platform fees at 255 bps (2.55%)
//
// ── HOW JUPITER ROUTES THE FEE TO YOU ────────────────────────────────────
//   On every /swap call, the api-server attaches:
//     {  platformFeeBps: PLATFORM_FEE_BPS,
//        feeAccount: <FEE_ACCOUNT_* matching the OUTPUT token mint> }
//   Jupiter takes that BPS off the *output* leg of the swap and deposits it
//   directly into your fee account in the same transaction. Zero retention,
//   zero post-trade reconciliation.
//
//   The api-server picks the right fee-account at request time using the
//   output mint:
//       So11111111111111111111111111111111111111112  → FEE_ACCOUNT_WSOL
//       EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v → FEE_ACCOUNT_USDC
//       Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB → FEE_ACCOUNT_USDT
//
//   For exotic mints with no pre-created ATA, omit feeAccount and route the
//   user through a 2-leg swap: TOKEN→USDC→DEST so we always land in USDC.
// ─────────────────────────────────────────────────────────────────────────

const API_BASE: string =
  (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? "/api";

export interface ShadowToken {
  ca: string;            // mint address
  symbol: string;
  name: string;
  logoURI?: string;      // falls back to /logo.jpg in <TokenAvatar>
  ageMin: number;
  mcap: number;          // USD
  liquidity: number;     // USD pool depth
  holders: number;
  volume24h: number;     // USD
  change24h: number;     // percent
  txCount24h: number;
  buys24h: number;
  sells24h: number;
  shadowScore: number;   // 0-100 — our proprietary score, server-computed
  signal: "BUY" | "WATCH" | "AVOID" | "PUMPING";
  socials: { x?: string; tg?: string; web?: string };
}

export interface SwapQuote {
  // Jupiter Ultra /order response — the api-server forwards this verbatim
  // and adds the two extra fields below so the UI can display fee routing.
  inputMint: string;
  outputMint: string;
  inAmount: string;       // raw lamports / atomic units
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: number;
  routePlan: unknown[];
  // Base64-encoded versioned tx the user's wallet signs, then POSTs back.
  transaction: string;
  requestId: string;
  // Echo from server: which fee-account got attached + the bps applied.
  feeAccount: string | null;
  platformFeeBps: number;
}

// ── Token feed ───────────────────────────────────────────────────────────
// GET {API_BASE}/tokens?tier=micro|small|mid|large|all&sort=score|age|mcap|...
//   server-side fan-out:
//     • Birdeye   /defi/tokenlist          → mcap, liquidity, volume, holders
//     • DexScreener /latest/dex/tokens     → price, txCount, buys/sells
//     • internal  shadowScore engine       → 0-100 score + signal
export async function fetchTokens(params: {
  tier?: "all" | "micro" | "small" | "mid" | "large";
  sort?: "score" | "age" | "mcap" | "liquidity" | "holders" | "volume" | "change";
  search?: string;
  signal?: AbortSignal;
}): Promise<ShadowToken[]> {
  const qs = new URLSearchParams();
  if (params.tier) qs.set("tier", params.tier);
  if (params.sort) qs.set("sort", params.sort);
  if (params.search) qs.set("search", params.search);
  const r = await fetch(`${API_BASE}/tokens?${qs}`, { signal: params.signal });
  if (!r.ok) throw new Error(`fetchTokens ${r.status}`);
  return (await r.json()) as ShadowToken[];
}

// ── Single-token detail ──────────────────────────────────────────────────
// GET {API_BASE}/tokens/:ca → ShadowToken (fresh score recompute on hit)
export async function fetchToken(ca: string): Promise<ShadowToken> {
  const r = await fetch(`${API_BASE}/tokens/${encodeURIComponent(ca)}`);
  if (!r.ok) throw new Error(`fetchToken ${r.status}`);
  return (await r.json()) as ShadowToken;
}

// ── Quote — preview a swap (no signing yet) ──────────────────────────────
// GET {API_BASE}/swap/quote
//   server proxies → https://api.jup.ag/ultra/v1/order
//   server attaches platformFeeBps + feeAccount automatically.
export async function fetchQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;        // atomic — lamports for SOL, smallest units for SPL
  slippageBps?: number;
}): Promise<SwapQuote> {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: String(params.slippageBps ?? 100),
  });
  const r = await fetch(`${API_BASE}/swap/quote?${qs}`);
  if (!r.ok) throw new Error(`fetchQuote ${r.status}`);
  return (await r.json()) as SwapQuote;
}

// ── Land a signed swap — wallet signs quote.transaction, then POST here ──
// POST {API_BASE}/swap/execute   { signedTransaction, requestId }
//   server forwards to Jupiter Ultra's /execute, which lands the tx and
//   simultaneously deposits the platform fee into FEE_ACCOUNT_*.
export async function executeSwap(params: {
  signedTransaction: string;   // base64 of the tx after wallet signing
  requestId: string;            // echoed from fetchQuote() response
}): Promise<{ status: string; signature?: string; slot?: number; error?: string }> {
  const r = await fetch(`${API_BASE}/swap/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`executeSwap ${r.status}`);
  return await r.json();
}

// ── Wallet SOL balance — used by the chart trading panel ───────────────
// Server proxies SOLANA_RPC.getBalance so the RPC key never reaches the
// browser bundle. Result is in SOL (already divided from lamports).
export async function fetchSolBalance(address: string): Promise<{ balance: number; lamports: number }> {
  const r = await fetch(`${API_BASE}/wallet/${encodeURIComponent(address)}/balance`);
  if (!r.ok) throw new Error(`fetchSolBalance ${r.status}`);
  return (await r.json()) as { balance: number; lamports: number };
}

// ── SPL token balance for (wallet, mint) — used for SELL flow ──────────
// Returns the user's holdings of `mint` along with the mint's decimals so
// the panel can derive percent-of-balance amounts (25/50/75/100%).
export async function fetchTokenBalance(params: { wallet: string; mint: string }): Promise<{ balance: number; decimals: number }> {
  const r = await fetch(`${API_BASE}/rpc/token-balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`fetchTokenBalance ${r.status}`);
  return (await r.json()) as { balance: number; decimals: number };
}

// ── Top-holder distribution ────────────────────────────────────────────
export interface HolderRow { address: string; balance: number; pctOwned: number; valueUsd: number; }
export async function fetchHolders(ca: string): Promise<{ totalHolders: number; holders: HolderRow[] }> {
  const r = await fetch(`${API_BASE}/token/${encodeURIComponent(ca)}/holders`);
  if (!r.ok) throw new Error(`fetchHolders ${r.status}`);
  const j = (await r.json()) as { totalHolders?: number; holders?: HolderRow[] };
  return { totalHolders: j.totalHolders ?? 0, holders: j.holders ?? [] };
}

// ── Network pulse — replaces Alice's lunar/Kp kitsch ─────────────────────
// GET {API_BASE}/network/pulse
//   server-side: getRecentPerformanceSamples + getSlot from SOLANA_RPC.
export interface NetworkPulse {
  slot: number;
  tps: number;
  blockTimeMs: number;
  feedNodes: number;     // how many of your relay nodes are streaming
}
export async function fetchNetworkPulse(): Promise<NetworkPulse> {
  const r = await fetch(`${API_BASE}/network/pulse`);
  if (!r.ok) throw new Error(`fetchNetworkPulse ${r.status}`);
  return (await r.json()) as NetworkPulse;
}

// ── Mock feed — used when VITE_API_BASE is unset (dev / preview) ─────────
export const mockTokens: ShadowToken[] = [
  { ca: "5tNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxaB12", symbol: "GHOST",   name: "Ghost Protocol", ageMin: 14,   mcap: 218_000,    liquidity: 41_200,   holders: 412,    volume24h: 132_000,    change24h: 184.2,  txCount24h: 1820, buys24h: 1100, sells24h: 720,  shadowScore: 87, signal: "BUY",      socials: { x: "https://x.com" } },
  { ca: "9jKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxpQ44", symbol: "VOID",    name: "Voidwalker",     ageMin: 56,   mcap: 92_400,     liquidity: 18_900,   holders: 248,    volume24h: 47_200,     change24h: -22.1,  txCount24h: 612,  buys24h: 240,  sells24h: 372,  shadowScore: 41, signal: "AVOID",    socials: { x: "https://x.com" } },
  { ca: "Ax3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxrT91", symbol: "OBELISK", name: "Obelisk",        ageMin: 6,    mcap: 1_240_000,  liquidity: 312_000,  holders: 1830,   volume24h: 940_000,    change24h: 412.5,  txCount24h: 5240, buys24h: 3120, sells24h: 2120, shadowScore: 94, signal: "PUMPING",  socials: { x: "https://x.com", tg: "https://t.me", web: "https://example.com" } },
  { ca: "Zm8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxwK02", symbol: "DRIFT",   name: "Drift Net",      ageMin: 240,  mcap: 4_120_000,  liquidity: 880_000,  holders: 4920,   volume24h: 1_240_000,  change24h: 8.4,    txCount24h: 3120, buys24h: 1640, sells24h: 1480, shadowScore: 72, signal: "WATCH",    socials: { x: "https://x.com", tg: "https://t.me", web: "https://example.com" } },
  { ca: "Rb2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxcH78", symbol: "RELIC",   name: "Relic Cipher",   ageMin: 32,   mcap: 412_000,    liquidity: 78_400,   holders: 612,    volume24h: 218_000,    change24h: 64.2,   txCount24h: 2120, buys24h: 1340, sells24h: 780,  shadowScore: 81, signal: "BUY",      socials: { x: "https://x.com", tg: "https://t.me" } },
  { ca: "Hc9xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxnL55", symbol: "NULLR",   name: "Null Router",    ageMin: 1180, mcap: 18_400_000, liquidity: 2_100_000, holders: 18_240, volume24h: 4_120_000,  change24h: -3.1,   txCount24h: 8120, buys24h: 4020, sells24h: 4100, shadowScore: 66, signal: "WATCH",    socials: { x: "https://x.com", tg: "https://t.me", web: "https://example.com" } },
];

// True if VITE_API_BASE is configured and we should hit live endpoints.
export const isLiveFeed: boolean =
  !!(import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
