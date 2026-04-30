/**
 * Chart / Trading Terminal — full port of Alice's scanner page into the
 * ShadowNet shell. Composition only; the heavy pieces (chart iframe,
 * trade panel) live under @/components/chart/ so the file stays focused
 * on data fetching + layout.
 *
 * Data flow:
 *   • Token search box accepts mints OR ?token=<ca> from the URL.
 *   • fetchToken() (server) returns the ShadowToken — symbol/price/mcap/
 *     liquidity/volume/buys/sells/score/signal — already enriched with
 *     Birdeye holder count when BIRDEYE_API_KEY is set.
 *   • DexScreener /latest/dex/tokens fallback runs client-side ONLY when
 *     the server doesn't have the mint yet, so the page can preview a
 *     freshly-launched token before our server cache catches up.
 *   • Holder distribution loads on-demand from /token/:ca/holders.
 *   • SOL price feeds from CoinGecko for the trade panel preview math.
 *
 * Tokens whose logoURI is missing (or 404s) fall back to the ShadowNet
 * /logo.jpg — never to a competitor brand.
 */

import { useEffect, useRef, useState } from "react";
import { Search, Copy, Check, AlertTriangle } from "lucide-react";
import { fetchToken, fetchHolders, type ShadowToken, type HolderRow } from "@/lib/trading-api";
import { useToast } from "@/hooks/use-toast";
import { ChartFrame } from "@/components/chart/chart-frame";
import { TradePanel } from "@/components/chart/trade-panel";

const FALLBACK_LOGO = "/logo.jpg";

interface DexPair {
  baseToken?: { address: string; symbol: string; name: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: { buys: number; sells: number }; h1?: { buys: number; sells: number }; m5?: { buys: number; sells: number } };
  info?: { imageUrl?: string };
}

interface TokenView {
  ca: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  priceUsd: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  txCount24h: number;
  buys24h: number;
  sells24h: number;
  shadowScore: number;
  signal: ShadowToken["signal"] | null;
  change24h: number;
  change1h: number;
  change5m: number;
  change1m: number;
}

function fmtUsd(n: number): string {
  if (!n || isNaN(n)) return "-";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtPrice(n: number): string {
  if (!n) return "$0.00";
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}
function fmtPct(n: number | undefined): string {
  if (n == null || isNaN(n)) return "0.00%";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function pctClass(n: number | undefined): string {
  if (n == null || n === 0) return "text-white/60";
  return n > 0 ? "text-emerald-400" : "text-rose-400";
}

function fromShadow(t: ShadowToken): TokenView {
  return {
    ca: t.ca,
    symbol: t.symbol,
    name: t.name,
    logoURI: t.logoURI ?? null,
    priceUsd: 0, // ShadowToken doesn't carry priceUsd; layered in via DexScreener below
    marketCap: t.mcap,
    liquidity: t.liquidity,
    volume24h: t.volume24h,
    holders: t.holders,
    txCount24h: t.txCount24h,
    buys24h: t.buys24h,
    sells24h: t.sells24h,
    shadowScore: t.shadowScore,
    signal: t.signal,
    change24h: t.change24h,
    change1h: 0, change5m: 0, change1m: 0,
  };
}

function fromDexPair(ca: string, p: DexPair): TokenView {
  const tx24 = p.txns?.h24 ?? { buys: 0, sells: 0 };
  return {
    ca,
    symbol: p.baseToken?.symbol ?? "???",
    name: p.baseToken?.name ?? "Unknown",
    logoURI: p.info?.imageUrl ?? null,
    priceUsd: parseFloat(p.priceUsd ?? "0") || 0,
    marketCap: p.fdv ?? p.marketCap ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    volume24h: p.volume?.h24 ?? 0,
    holders: 0,
    txCount24h: (tx24.buys ?? 0) + (tx24.sells ?? 0),
    buys24h: tx24.buys ?? 0,
    sells24h: tx24.sells ?? 0,
    shadowScore: 0,
    signal: null,
    change24h: p.priceChange?.h24 ?? 0,
    change1h:  p.priceChange?.h1  ?? 0,
    change5m:  p.priceChange?.m5  ?? 0,
    change1m:  0,
  };
}

export default function Chart() {
  const { toast } = useToast();
  const [token, setToken] = useState<TokenView | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState(150);
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [holdersTotal, setHoldersTotal] = useState(0);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [dataTab, setDataTab] = useState<"trades" | "holders">("trades");
  const [copied, setCopied] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);

  // SOL price for trade preview math
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (!r.ok) return;
        const j = (await r.json()) as { solana?: { usd?: number } };
        if (!cancelled && j.solana?.usd) setSolPrice(j.solana.usd);
      } catch { /* keep last value */ }
    }
    pull();
    const id = setInterval(pull, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Read ?token= on first mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) loadToken(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadToken(ca: string) {
    if (!ca || ca.length < 32) {
      toast({ title: "Invalid mint", description: "Paste a Solana token contract address", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1) Try server-side aggregation first (carries our shadow score).
      let view: TokenView | null = null;
      try {
        const sn = await fetchToken(ca);
        view = fromShadow(sn);
      } catch { /* fall through to public DexScreener */ }

      // 2) Always overlay DexScreener fields we don't get from /tokens/:ca
      //    (priceUsd, intra-day change buckets). This also serves as the
      //    fallback for fresh launches our server hasn't seen yet.
      try {
        const dex = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
        if (dex.ok) {
          const j = (await dex.json()) as { pairs?: DexPair[] };
          const pair = j.pairs?.[0];
          if (pair) {
            const d = fromDexPair(ca, pair);
            view = view ? { ...view, ...d, holders: view.holders || d.holders, shadowScore: view.shadowScore || d.shadowScore, signal: view.signal ?? d.signal } : d;
          }
        }
      } catch { /* keep server view */ }

      if (!view) {
        toast({ title: "Token not found", description: "No DEX pair on Solana for this mint", variant: "destructive" });
        return;
      }
      setToken(view);
      document.title = `${view.symbol} | ShadowNet Chart`;
      setDataTab("trades");
      setHolders([]); setHoldersTotal(0);
    } catch (e) {
      toast({ title: "Lookup failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Lazy-load holders only when user opens the tab
  useEffect(() => {
    if (dataTab !== "holders" || !token?.ca || holdersLoading) return;
    if (holdersTotal > 0) return;
    setHoldersLoading(true);
    fetchHolders(token.ca)
      .then(r => { setHolders(r.holders); setHoldersTotal(r.totalHolders); })
      .catch(() => { /* server may not have BIRDEYE_API_KEY — silent */ })
      .finally(() => setHoldersLoading(false));
  }, [dataTab, token?.ca, holdersLoading, holdersTotal]);

  function copyCa() {
    if (!token?.ca) return;
    navigator.clipboard.writeText(token.ca).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function onSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const q = searchInput.trim();
      if (q.length >= 32) { loadToken(q); setSearchInput(""); }
    }
  }

  // Simple rug-safety heuristic that mirrors Alice's panel without
  // requiring a paid Birdeye plan. Real bundler/insider stats are gated
  // behind /token/:ca/analysis (added later, optional Helius parsing).
  const safety = (() => {
    if (!token) return null;
    const s = token.shadowScore;
    const score = s > 0 ? s : 50;
    const liqOK = token.liquidity >= 25_000;
    const holdersOK = token.holders >= 200;
    return { score, liqOK, holdersOK };
  })();

  return (
    <div className="space-y-4 -mx-4 md:-mx-8">
      {/* Search bar */}
      <div className="px-4 md:px-8">
        <div className="flex items-center gap-2 bg-black/40 border border-white/8 rounded-md px-3 py-2 focus-within:border-primary">
          <Search className="w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyUp={onSearch}
            placeholder="Paste a Solana mint address and press Enter"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30 font-mono"
          />
          {loading && <span className="text-[10px] font-mono text-primary tracking-widest animate-pulse">LOADING…</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 px-4 md:px-8">
        {/* LEFT — chart + stats + data tabs */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Token header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0d0d10] border border-white/8 rounded-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white/5 ring-1 ring-white/10">
                <img
                  ref={logoRef}
                  src={token?.logoURI ?? FALLBACK_LOGO}
                  alt={token?.symbol ?? "ShadowNet"}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO; }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold flex items-center gap-2 truncate">
                  <span className="truncate">{token?.symbol ?? "—"}</span>
                  <span className="text-white/40 font-normal text-sm">/ SOL</span>
                </h1>
                {token ? (
                  <button onClick={copyCa} className="flex items-center gap-1.5 text-[11px] font-mono text-white/50 hover:text-primary transition-colors">
                    <span>{token.ca.slice(0,4)}…{token.ca.slice(-4)}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-60" />}
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-white/40">Select a token</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-lg font-bold">{token ? fmtPrice(token.priceUsd) : "$—"}</div>
              <div className={`text-xs font-semibold ${pctClass(token?.change24h)}`}>{fmtPct(token?.change24h)}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/8 rounded-md overflow-hidden">
            {[
              { label: "Market Cap", value: token ? fmtUsd(token.marketCap) : "-" },
              { label: "Liquidity",  value: token ? fmtUsd(token.liquidity)  : "-" },
              { label: "Vol 24h",    value: token ? fmtUsd(token.volume24h)  : "-" },
              { label: "Holders",    value: token && token.holders > 0 ? token.holders.toLocaleString() : "-" },
              { label: "Txns 24h",   value: token ? token.txCount24h.toLocaleString() : "-" },
              { label: "Shadow",     value: token && token.shadowScore > 0 ? String(token.shadowScore) : "-",
                tone: token ? (token.shadowScore >= 75 ? "text-emerald-400" : token.shadowScore >= 50 ? "text-primary" : token.shadowScore >= 25 ? "text-amber-400" : "text-rose-400") : "" },
            ].map(s => (
              <div key={s.label} className="bg-[#0d0d10] py-2.5 px-2 text-center">
                <div className={`font-mono text-sm font-semibold ${s.tone ?? ""}`}>{s.value}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Price-change strip */}
          <div className="flex items-center justify-around gap-2 py-2 px-3 bg-gradient-to-r from-emerald-500/3 via-cyan-500/3 to-rose-500/3 border border-white/8 rounded-md">
            {[
              { label: "1m",  v: token?.change1m  },
              { label: "5m",  v: token?.change5m  },
              { label: "1h",  v: token?.change1h  },
              { label: "24h", v: token?.change24h },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-white/40">{p.label}</span>
                <span className={`font-mono text-xs font-semibold ${pctClass(p.v)}`}>{fmtPct(p.v)}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <ChartFrame ca={token?.ca ?? null} />

          {/* Data tabs */}
          <div className="flex gap-1 border-b border-white/8">
            {(["trades", "holders"] as const).map(t => (
              <button key={t} onClick={() => setDataTab(t)}
                className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${dataTab === t ? "text-primary border-primary" : "text-white/50 border-transparent hover:text-white/70"}`}>
                {t}{t === "holders" && holdersTotal > 0 ? ` (${holdersTotal.toLocaleString()})` : ""}
              </button>
            ))}
          </div>

          {dataTab === "trades" && (
            <div className="px-3 py-6 text-center text-xs text-white/40 bg-[#0d0d10] border border-white/8 rounded-md">
              {token
                ? <>Live trades stream attaches when SOLANA_RPC supports websocket logs. Open the chart in <a className="text-primary" href={`https://dexscreener.com/solana/${token.ca}`} target="_blank" rel="noreferrer">DexScreener</a> for the full tape.</>
                : "Select a token to view trades."}
            </div>
          )}

          {dataTab === "holders" && (
            <div className="bg-[#0d0d10] border border-white/8 rounded-md overflow-hidden">
              {holdersLoading && <div className="px-3 py-6 text-center text-xs text-white/40">Loading holder distribution…</div>}
              {!holdersLoading && holders.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-white/40">
                  {holdersTotal > 0
                    ? `${holdersTotal.toLocaleString()} holders — distribution unavailable`
                    : token ? "Holder distribution requires BIRDEYE_API_KEY on the api-server" : "Select a token to view holders"}
                </div>
              )}
              {!holdersLoading && holders.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-white/40 border-b border-white/8">
                      <th className="px-3 py-2 font-semibold">Wallet</th>
                      <th className="px-3 py-2 font-semibold">Balance</th>
                      <th className="px-3 py-2 font-semibold">% Owned</th>
                      <th className="px-3 py-2 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.map((h, i) => {
                      const tone = h.pctOwned > 10 ? "text-rose-400" : h.pctOwned > 5 ? "text-amber-400" : "text-emerald-400";
                      return (
                        <tr key={h.address} className="border-b border-white/5 hover:bg-white/3">
                          <td className="px-3 py-2 font-mono">
                            <span className="text-white/40 text-[10px] mr-2">#{i+1}</span>
                            <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80">
                              {h.address.slice(0,4)}…{h.address.slice(-4)}
                            </a>
                          </td>
                          <td className="px-3 py-2 font-mono">{h.balance > 1e6 ? `${(h.balance/1e6).toFixed(2)}M` : h.balance > 1e3 ? `${(h.balance/1e3).toFixed(2)}K` : h.balance.toFixed(2)}</td>
                          <td className={`px-3 py-2 font-mono ${tone}`}>{h.pctOwned.toFixed(2)}%</td>
                          <td className="px-3 py-2 font-mono text-emerald-400">${h.valueUsd >= 1e3 ? `${(h.valueUsd/1e3).toFixed(2)}K` : h.valueUsd.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — trade panel + safety */}
        <div className="flex flex-col gap-3">
          <TradePanel
            token={token ? {
              ca: token.ca,
              symbol: token.symbol,
              priceUsd: token.priceUsd,
              liquidity: token.liquidity,
              marketCap: token.marketCap,
              volume24h: token.volume24h,
              buys24h: token.buys24h,
              sells24h: token.sells24h,
            } : null}
            solPrice={solPrice}
          />

          {token && safety && (
            <div className="bg-[#0d0d10] border border-emerald-500/20 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Rug Safety</span>
                <span className={`font-mono text-sm font-bold ${safety.score >= 70 ? "text-emerald-400" : safety.score >= 40 ? "text-amber-400" : "text-rose-400"}`}>{safety.score}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="bg-black/30 rounded px-2 py-1.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase">Liq</div>
                  <div className={safety.liqOK ? "text-emerald-400" : "text-amber-400"}>{safety.liqOK ? "OK" : "LOW"}</div>
                </div>
                <div className="bg-black/30 rounded px-2 py-1.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase">Holders</div>
                  <div className={safety.holdersOK ? "text-emerald-400" : "text-amber-400"}>{safety.holdersOK ? "OK" : "FEW"}</div>
                </div>
                <div className="bg-black/30 rounded px-2 py-1.5 text-center">
                  <div className="text-white/40 text-[9px] uppercase">Score</div>
                  <div className={safety.score >= 70 ? "text-emerald-400" : safety.score >= 40 ? "text-amber-400" : "text-rose-400"}>{safety.score}</div>
                </div>
              </div>
              {!safety.liqOK || !safety.holdersOK ? (
                <div className="flex items-start gap-1.5 mt-2 text-[10px] text-amber-400/80">
                  <AlertTriangle className="w-3 h-3 mt-px flex-shrink-0" />
                  <span>Higher slippage and rug risk on thin pools. Trade small.</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
