// Trading routes — token discovery + Jupiter Ultra swap proxy + network pulse.
//
// Mount path (set in src/routes/index.ts): no prefix, since this file already
// declares its own /tokens, /swap, /network paths. The parent app mounts the
// router at /api, so endpoints exposed are:
//
//   GET  /api/tokens?tier=&sort=&search=
//   GET  /api/tokens/:ca
//   GET  /api/swap/quote?inputMint=&outputMint=&amount=&slippageBps=
//   POST /api/swap/execute        body: { signedTransaction, requestId }
//   GET  /api/network/pulse
//
// Required env (server-side — never reach the browser):
//   SOLANA_RPC                 Helius/QuickNode mainnet — READ ops
//   JUPITER_API_KEY            portal.jup.ag — Ultra Swap API
//   FEE_WALLET                 owner pubkey that owns the fee ATAs
//   FEE_ACCOUNT_WSOL           pre-created ATA for wSOL fees
//   FEE_ACCOUNT_USDC           pre-created ATA for USDC fees
//   FEE_ACCOUNT_USDT           pre-created ATA for USDT fees
//   PLATFORM_FEE_BPS           default "100" (=1%) — max 255 (Jupiter cap)
//
// Holder enrichment uses Jupiter v2 search (free, public) — no Birdeye key.
// Token scoring uses the alpha-score module ported from alice (10-layer
// weighted scorer with bonding-curve and Jupiter audit awareness).

import { Router } from "express";
import { alphaScore } from "../lib/alpha-score.js";

const router = Router();

const MINT_WSOL = "So11111111111111111111111111111111111111112";
const MINT_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

const JUPITER_BASE = "https://api.jup.ag/ultra/v1";

function feeAccountFor(outputMint: string): string | undefined {
  switch (outputMint) {
    case MINT_WSOL: return process.env.FEE_ACCOUNT_WSOL;
    case MINT_USDC: return process.env.FEE_ACCOUNT_USDC;
    case MINT_USDT: return process.env.FEE_ACCOUNT_USDT;
    default: return undefined;
  }
}

function platformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  const n = raw ? parseInt(raw, 10) : 100;
  if (Number.isNaN(n) || n < 0) return 100;
  if (n > 255) return 255;
  return n;
}

interface DexPair {
  baseToken?: { address: string; symbol: string; name: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { m5?: number; h1?: number; h24?: number };
  liquidity?: { usd?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  pairCreatedAt?: number;
  info?: { imageUrl?: string; socials?: Array<{ type?: string; url: string }>; websites?: Array<{ url: string }> };
}
interface DexProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
  links?: Array<{ label?: string; type?: string; url: string }>;
}

type ShadowSignal = "BUY" | "WATCH" | "AVOID" | "PUMPING";

interface ShadowToken {
  ca: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  ageMin: number;
  mcap: number;
  liquidity: number;
  holders: number;
  volume24h: number;
  change24h: number;
  txCount24h: number;
  buys24h: number;
  sells24h: number;
  shadowScore: number;
  signal: ShadowSignal;
  socials: { x?: string; tg?: string; web?: string };
}

function tierFor(mcap: number): "micro" | "small" | "mid" | "large" {
  if (mcap < 500_000)     return "micro";
  if (mcap < 1_500_000)   return "small";
  if (mcap < 10_000_000)  return "mid";
  return "large";
}

function tierBucket(mcap: number, tier: string): boolean {
  if (tier === "all") return true;
  if (tier === "micro") return mcap < 250_000;
  if (tier === "small") return mcap >= 250_000 && mcap < 1_500_000;
  if (tier === "mid")   return mcap >= 1_500_000 && mcap < 10_000_000;
  if (tier === "large") return mcap >= 10_000_000;
  return true;
}

function pairToToken(pair: DexPair, profile?: DexProfile): ShadowToken | null {
  const ca = pair.baseToken?.address;
  if (!ca) return null;

  const ageMin = pair.pairCreatedAt
    ? Math.max(0, Math.floor((Date.now() - pair.pairCreatedAt) / 60_000))
    : 0;
  const mcap = pair.fdv ?? pair.marketCap ?? 0;
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume24h = pair.volume?.h24 ?? 0;
  const change24h = pair.priceChange?.h24 ?? 0;
  const buys24h = pair.txns?.h24?.buys ?? 0;
  const sells24h = pair.txns?.h24?.sells ?? 0;

  const x   = pair.info?.socials?.find((s) => (s.type ?? "").toLowerCase() === "twitter")?.url
           ?? profile?.links?.find((l) => (l.type ?? l.label ?? "").toLowerCase().includes("twitter"))?.url;
  const tg  = pair.info?.socials?.find((s) => (s.type ?? "").toLowerCase() === "telegram")?.url
           ?? profile?.links?.find((l) => (l.type ?? l.label ?? "").toLowerCase().includes("telegram"))?.url;
  const web = pair.info?.websites?.[0]?.url
           ?? profile?.links?.find((l) => (l.type ?? l.label ?? "").toLowerCase().includes("web"))?.url;

  // Score via alice-ported alphaScore. Fields not yet enriched (jupiter
  // audit, technical analysis, bonding-curve progress) default to undefined
  // and the scorer treats them as neutral. PR 3 will add Jupiter audit
  // enrichment + multi-source feed for the missing inputs.
  const alpha = alphaScore({
    fdv: mcap,
    liquidity,
    volume24h,
    ageMin,
    holders: 0,
    priceChange: {
      m5: pair.priceChange?.m5 ?? 0,
      h1: pair.priceChange?.h1 ?? 0,
      h24: change24h,
    },
    txns: {
      m5: pair.txns?.m5,
      h1: pair.txns?.h1,
      h24: pair.txns?.h24,
    },
    socials: { x: !!x, tg: !!tg, web: !!web },
    tier: tierFor(mcap),
  });

  return {
    ca,
    symbol: pair.baseToken?.symbol ?? "???",
    name: pair.baseToken?.name ?? profile?.description?.split(" ").slice(0, 3).join(" ") ?? "Unknown",
    logoURI: pair.info?.imageUrl ?? profile?.icon ?? null,
    ageMin,
    mcap,
    liquidity,
    holders: 0,
    volume24h,
    change24h,
    txCount24h: buys24h + sells24h,
    buys24h,
    sells24h,
    shadowScore: alpha.score,
    signal: alpha.signal,
    socials: { x, tg, web },
  };
}

// Jupiter v2 search exposes `holderCount` for each indexed mint — free,
// public, no API key. Replaces the old Birdeye enrichment path. We enrich
// the top ~25 tokens by score in parallel to keep latency bounded.
async function enrichWithJupiterHolders(tokens: ShadowToken[]): Promise<void> {
  if (tokens.length === 0) return;
  const targets = [...tokens].sort((a, b) => b.shadowScore - a.shadowScore).slice(0, 25);
  await Promise.allSettled(
    targets.map(async (t) => {
      try {
        const r = await fetch(
          `https://lite-api.jup.ag/tokens/v2/search?query=${t.ca}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) }
        );
        if (!r.ok) return;
        const j = (await r.json()) as Array<{ id?: string; holderCount?: number }>;
        const match = Array.isArray(j) ? j.find(x => x.id === t.ca) : null;
        if (typeof match?.holderCount === "number") t.holders = match.holderCount;
      } catch { /* non-fatal */ }
    })
  );
}

// ── GET /tokens ─────────────────────────────────────────────────────────
router.get("/tokens", async (req, res) => {
  const tier = String(req.query.tier ?? "all");
  const sort = String(req.query.sort ?? "score");
  const search = String(req.query.search ?? "").trim().toLowerCase();

  try {
    const boostsRes = await fetch(
      "https://api.dexscreener.com/token-boosts/latest/v1",
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );

    let profiles: DexProfile[] = [];
    if (boostsRes.ok) {
      const j = (await boostsRes.json()) as DexProfile[];
      profiles = Array.isArray(j) ? j : [];
    }

    if (profiles.length === 0) {
      const r2 = await fetch(
        "https://api.dexscreener.com/token-profiles/latest/v1",
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (r2.ok) profiles = (await r2.json()) as DexProfile[];
    }

    const solanaProfiles = profiles
      .filter((p) => p.chainId === "solana" && p.tokenAddress)
      .slice(0, 30);

    if (solanaProfiles.length === 0) {
      return void res.status(502).json({ error: "no upstream data", tokens: [] });
    }

    const addresses = solanaProfiles.map((p) => p.tokenAddress).join(",");
    const pairsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!pairsRes.ok) {
      return void res.status(502).json({ error: "pairs lookup failed", tokens: [] });
    }
    const { pairs = [] } = (await pairsRes.json()) as { pairs?: DexPair[] };

    const seen = new Set<string>();
    const tokens: ShadowToken[] = [];
    for (const pair of pairs) {
      const ca = pair.baseToken?.address;
      if (!ca || seen.has(ca)) continue;
      seen.add(ca);
      const profile = solanaProfiles.find((p) => p.tokenAddress === ca);
      const t = pairToToken(pair, profile);
      if (t) tokens.push(t);
    }

    await enrichWithJupiterHolders(tokens);

    let filtered = tokens.filter((t) => tierBucket(t.mcap, tier));
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(search) ||
          t.name.toLowerCase().includes(search) ||
          t.ca.toLowerCase().includes(search)
      );
    }
    filtered.sort((a, b) => {
      switch (sort) {
        case "age":       return a.ageMin - b.ageMin;
        case "mcap":      return b.mcap - a.mcap;
        case "liquidity": return b.liquidity - a.liquidity;
        case "holders":   return b.holders - a.holders;
        case "volume":    return b.volume24h - a.volume24h;
        case "change":    return b.change24h - a.change24h;
        case "score":
        default:          return b.shadowScore - a.shadowScore;
      }
    });

    res.json(filtered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg, tokens: [] });
  }
});

// ── GET /tokens/:ca — single mint ───────────────────────────────────────
router.get("/tokens/:ca", async (req, res) => {
  const ca = req.params.ca;
  if (!ca || ca.length < 32) return void res.status(400).json({ error: "invalid mint" });
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return void res.status(502).json({ error: "pairs lookup failed" });
    const { pairs = [] } = (await r.json()) as { pairs?: DexPair[] };
    const pair = pairs[0];
    if (!pair) return void res.status(404).json({ error: "no pair found" });
    const t = pairToToken(pair);
    if (!t) return void res.status(404).json({ error: "no pair found" });
    await enrichWithJupiterHolders([t]);
    res.json(t);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

// ── GET /swap/quote ─────────────────────────────────────────────────────
router.get("/swap/quote", async (req, res) => {
  const inputMint  = String(req.query.inputMint ?? "");
  const outputMint = String(req.query.outputMint ?? "");
  const amount     = String(req.query.amount ?? "");
  const slippageBps = String(req.query.slippageBps ?? "100");
  const taker      = String(req.query.taker ?? "");

  if (!inputMint || !outputMint || !amount) {
    return void res.status(400).json({ error: "missing inputMint/outputMint/amount" });
  }

  const fee = feeAccountFor(outputMint);
  const bps = platformFeeBps();

  const qs = new URLSearchParams({ inputMint, outputMint, amount, slippageBps });
  if (taker) qs.set("taker", taker);
  if (fee) {
    qs.set("feeAccount", fee);
    qs.set("platformFeeBps", String(bps));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;

  try {
    const r = await fetch(`${JUPITER_BASE}/order?${qs}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
      const body = await r.text();
      return void res.status(r.status).json({ error: "jupiter order failed", upstream: body.slice(0, 400) });
    }
    const order = (await r.json()) as Record<string, unknown>;

    res.json({
      ...order,
      feeAccount: fee ?? null,
      platformFeeBps: fee ? bps : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

// ── POST /swap/execute ──────────────────────────────────────────────────
router.post("/swap/execute", async (req, res) => {
  const body = req.body as { signedTransaction?: string; requestId?: string } | undefined;
  const signedTransaction = body?.signedTransaction;
  const requestId = body?.requestId;
  if (!signedTransaction || !requestId) {
    return void res.status(400).json({ error: "missing signedTransaction/requestId" });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;

  try {
    const r = await fetch(`${JUPITER_BASE}/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ signedTransaction, requestId }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

// ── GET /wallet/:address/balance ────────────────────────────────────────
router.get("/wallet/:address/balance", async (req, res) => {
  const address = req.params.address;
  if (!address || address.length < 32) {
    return void res.status(400).json({ error: "invalid address" });
  }
  const rpc = process.env.SOLANA_RPC;
  if (!rpc) return void res.status(500).json({ error: "SOLANA_RPC not configured" });

  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`rpc ${r.status}`);
    const j = (await r.json()) as { result?: { value?: number }; error?: { message?: string } };
    if (j.error) throw new Error(j.error.message ?? "rpc error");
    const lamports = j.result?.value ?? 0;
    res.json({ address, lamports, balance: lamports / 1e9 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

// ── POST /rpc/token-balance ─────────────────────────────────────────────
router.post("/rpc/token-balance", async (req, res) => {
  const body = req.body as { wallet?: string; mint?: string } | undefined;
  const wallet = body?.wallet;
  const mint = body?.mint;
  if (!wallet || !mint) {
    return void res.status(400).json({ error: "missing wallet/mint" });
  }
  const rpc = process.env.SOLANA_RPC;
  if (!rpc) return void res.status(500).json({ error: "SOLANA_RPC not configured" });

  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [wallet, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`rpc ${r.status}`);
    const j = (await r.json()) as {
      result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number; decimals?: number } } } } } }> };
      error?: { message?: string };
    };
    if (j.error) throw new Error(j.error.message ?? "rpc error");
    const accounts = j.result?.value ?? [];
    let balance = 0;
    let decimals = 6;
    for (const acc of accounts) {
      const info = acc.account?.data?.parsed?.info?.tokenAmount;
      if (info) {
        balance += info.uiAmount ?? 0;
        decimals = info.decimals ?? decimals;
      }
    }
    res.json({ wallet, mint, balance, decimals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

// ── GET /token/:address/holders ─────────────────────────────────────────
router.get("/token/:address/holders", async (req, res) => {
  const address = req.params.address;
  if (!address || address.length < 32) {
    return void res.status(400).json({ error: "invalid mint" });
  }
  const rpc = process.env.SOLANA_RPC;
  if (!rpc) {
    return void res.status(500).json({ error: "SOLANA_RPC not configured", holders: [], totalHolders: 0 });
  }

  const rpcCall = async (method: string, params: unknown[]) => {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`${method} ${r.status}`);
    const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
    if (j.error) throw new Error(j.error.message ?? "rpc error");
    return j.result;
  };

  try {
    const [supplyRes, largestRes, dexRes] = await Promise.all([
      rpcCall("getTokenSupply", [address]) as Promise<{ value?: { uiAmount?: number; decimals?: number } }>,
      rpcCall("getTokenLargestAccounts", [address]) as Promise<{ value?: Array<{ address: string; uiAmount?: number }> }>,
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000),
      }).then(r => r.ok ? r.json() : null).catch(() => null) as Promise<{ pairs?: Array<{ priceUsd?: string }> } | null>,
    ]);

    const totalSupply = supplyRes?.value?.uiAmount ?? 0;
    const priceUsd = dexRes?.pairs?.[0]?.priceUsd ? parseFloat(dexRes.pairs[0].priceUsd) : 0;
    const largestAccounts = largestRes?.value ?? [];

    const holders = largestAccounts.map((h) => {
      const balance = h.uiAmount ?? 0;
      const pctOwned = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
      return {
        address: h.address,
        balance,
        pctOwned,
        valueUsd: balance * priceUsd,
      };
    });

    let totalHolders = holders.length;
    try {
      const jupRes = await fetch(
        `https://lite-api.jup.ag/tokens/v2/search?query=${address}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) }
      );
      if (jupRes.ok) {
        const jupJson = (await jupRes.json()) as Array<{ id?: string; holderCount?: number }>;
        const match = Array.isArray(jupJson) ? jupJson.find(t => t.id === address) : null;
        if (match?.holderCount) totalHolders = match.holderCount;
      }
    } catch { /* non-fatal */ }

    res.json({ success: true, totalHolders, totalSupply, priceUsd, holders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg, holders: [], totalHolders: 0 });
  }
});

// ── GET /chart/:address ─────────────────────────────────────────────────
router.get("/chart/:address", async (req, res) => {
  const address = req.params.address;
  if (!address || address.length < 32) return void res.status(400).json({ error: "invalid mint" });
  const interval = String(req.query.interval ?? "5m");
  try {
    const tokRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
    });
    if (!tokRes.ok) return void res.status(502).json({ success: false, error: "pair lookup failed", bars: [] });
    const { pairs = [] } = (await tokRes.json()) as { pairs?: Array<{ pairAddress: string; chainId: string }> };
    const pair = pairs[0];
    if (!pair) return void res.status(404).json({ success: false, error: "no pair", bars: [] });
    res.json({
      success: true,
      pairAddress: pair.pairAddress,
      chain: pair.chainId,
      interval,
      bars: [],
      embedUrl: `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&theme=dark&interval=${interval}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ success: false, error: msg, bars: [] });
  }
});

// ── GET /network/pulse ──────────────────────────────────────────────────
let pulseCache: { ts: number; data: { slot: number; tps: number; blockTimeMs: number; feedNodes: number } } | null = null;

router.get("/network/pulse", async (_req, res) => {
  if (pulseCache && Date.now() - pulseCache.ts < 4000) {
    return void res.json(pulseCache.data);
  }
  const rpc = process.env.SOLANA_RPC;
  if (!rpc) {
    return void res.status(500).json({ error: "SOLANA_RPC not configured" });
  }

  const rpcCall = async (method: string, params: unknown[]) => {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`rpc ${method} ${r.status}`);
    const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
    if (j.error) throw new Error(j.error.message ?? "rpc error");
    return j.result;
  };

  try {
    const [slot, samples] = await Promise.all([
      rpcCall("getSlot", [{ commitment: "confirmed" }]) as Promise<number>,
      rpcCall("getRecentPerformanceSamples", [4]) as Promise<Array<{ numTransactions: number; samplePeriodSecs: number }>>,
    ]);
    const sampleSum = samples.reduce(
      (acc, s) => ({ tx: acc.tx + s.numTransactions, secs: acc.secs + s.samplePeriodSecs }),
      { tx: 0, secs: 0 }
    );
    const tps = sampleSum.secs > 0 ? sampleSum.tx / sampleSum.secs : 0;
    const blockTimeMs = sampleSum.tx > 0 ? (sampleSum.secs * 1000) / sampleSum.tx * 1000 : 0;
    const feedNodes = 12;

    const data = { slot, tps, blockTimeMs, feedNodes };
    pulseCache = { ts: Date.now(), data };
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    res.status(502).json({ error: msg });
  }
});

export default router;
