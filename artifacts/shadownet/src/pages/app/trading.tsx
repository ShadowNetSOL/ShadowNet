import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Clipboard,
  Plus,
  RefreshCw,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Activity,
  Twitter,
  Globe,
  Send,
  Star,
  ExternalLink,
  Flame,
  Wallet,
  Cpu,
  Gauge,
} from "lucide-react";
import {
  fetchTokens,
  fetchNetworkPulse,
  isLiveFeed,
  mockTokens,
  type ShadowToken,
  type NetworkPulse,
} from "@/lib/trading-api";

// ── Types ─────────────────────────────────────────────────────────────
type Tier = "all" | "micro" | "small" | "mid" | "large";
type SortKey = "score" | "age" | "mcap" | "liquidity" | "holders" | "volume" | "change";

const tierBuckets: Record<Tier, (m: number) => boolean> = {
  all: () => true,
  micro: (m) => m < 250_000,
  small: (m) => m >= 250_000 && m < 1_500_000,
  mid: (m) => m >= 1_500_000 && m < 10_000_000,
  large: (m) => m >= 10_000_000,
};

const sorters: Record<SortKey, (a: ShadowToken, b: ShadowToken) => number> = {
  score: (a, b) => b.shadowScore - a.shadowScore,
  age: (a, b) => a.ageMin - b.ageMin,
  mcap: (a, b) => b.mcap - a.mcap,
  liquidity: (a, b) => b.liquidity - a.liquidity,
  holders: (a, b) => b.holders - a.holders,
  volume: (a, b) => b.volume24h - a.volume24h,
  change: (a, b) => b.change24h - a.change24h,
};

// ── Helpers ───────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
function fmtAge(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / (60 * 24))}d`;
}
function shortCa(ca: string): string {
  if (ca.length <= 10) return ca;
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`;
}

// ── Network pulse strip ───────────────────────────────────────────────
function NetworkPulseStrip({ pulse }: { pulse: NetworkPulse | null }) {
  return (
    <div className="flex items-center gap-3 text-[9px] font-mono text-white/35 tracking-widest">
      <span className="flex items-center gap-1.5">
        <Cpu className="w-3 h-3 text-accent/60" />
        SLOT <span className="text-accent/80 tabular-nums">{pulse ? pulse.slot.toLocaleString() : "—"}</span>
      </span>
      <span className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1.5">
        <Gauge className="w-3 h-3 text-primary/60" />
        TPS <span className="text-primary/80 tabular-nums">{pulse ? Math.round(pulse.tps) : "—"}</span>
      </span>
      <span className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        RELAY <span className="text-primary/80 tabular-nums">{pulse?.feedNodes ?? "—"}</span>
      </span>
    </div>
  );
}

// ── Token avatar — defaults to ShadowNet logo when no logoURI ─────────
function TokenAvatar({ token }: { token: ShadowToken }) {
  const [errored, setErrored] = useState(false);
  const src = !errored && token.logoURI ? token.logoURI : "/logo.jpg";
  return (
    <img
      src={src}
      alt={token.symbol}
      onError={() => setErrored(true)}
      className="w-7 h-7 rounded-md object-cover ring-1 ring-primary/30 shrink-0 bg-black"
    />
  );
}

// ── Signal pill ───────────────────────────────────────────────────────
function SignalPill({ s }: { s: ShadowToken["signal"] }) {
  const map: Record<ShadowToken["signal"], { c: string; b: string; bg: string }> = {
    BUY:     { c: "text-primary",     b: "border-primary/30",     bg: "bg-primary/[0.06]" },
    PUMPING: { c: "text-accent",      b: "border-accent/40",      bg: "bg-accent/[0.08]" },
    WATCH:   { c: "text-white/55",    b: "border-white/15",       bg: "bg-white/[0.02]" },
    AVOID:   { c: "text-destructive", b: "border-destructive/30", bg: "bg-destructive/[0.06]" },
  };
  const v = map[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${v.b} ${v.bg} ${v.c} text-[9px] font-mono tracking-widest`}>
      {s === "PUMPING" && <Flame className="w-2.5 h-2.5" />}
      {s}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-primary" : score >= 60 ? "bg-accent" : score >= 40 ? "bg-secondary" : "bg-destructive";
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-mono tabular-nums ${score >= 60 ? "text-primary" : "text-white/50"}`}>{score}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function Trading() {
  const [tier, setTier] = useState<Tier>("micro");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [query, setQuery] = useState("");
  const [quickBuy, setQuickBuy] = useState(0.1);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [tokens, setTokens] = useState<ShadowToken[]>(mockTokens);
  const [pulse, setPulse] = useState<NetworkPulse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; msg: string } | null>(null);

  // Restore watchlist
  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem("sn_watchlist") ?? "[]");
      if (Array.isArray(w)) setWatchlist(w);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("sn_watchlist", JSON.stringify(watchlist)); } catch {}
  }, [watchlist]);

  // Load token feed (live when VITE_API_BASE is set; otherwise mock data)
  useEffect(() => {
    if (!isLiveFeed) return;
    const ctl = new AbortController();
    setRefreshing(true);
    fetchTokens({ tier, sort: sortKey, search: query, signal: ctl.signal })
      .then((rows) => { setTokens(rows); setFeedError(null); })
      .catch((e: Error) => { if (e.name !== "AbortError") setFeedError(e.message); })
      .finally(() => setRefreshing(false));
    return () => ctl.abort();
  }, [tier, sortKey, query]);

  // Load network pulse, repoll every 6s
  useEffect(() => {
    if (!isLiveFeed) {
      setPulse({ slot: 287_412_902, tps: 4120, blockTimeMs: 410, feedNodes: 12 });
      return;
    }
    let alive = true;
    const tick = () => fetchNetworkPulse().then((p) => alive && setPulse(p)).catch(() => {});
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tokens
      .filter((t) => tierBuckets[tier](t.mcap))
      .filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.ca.toLowerCase().includes(q))
      .sort(sorters[sortKey]);
  }, [tokens, tier, sortKey, query]);

  const watchTokens = tokens.filter((t) => watchlist.includes(t.ca));

  const showToast = (title: string, msg: string) => {
    setToast({ title, msg });
    setTimeout(() => setToast(null), 2400);
  };

  const toggleWatch = (ca: string) => {
    setWatchlist((w) => (w.includes(ca) ? w.filter((c) => c !== ca) : [...w, ca]));
  };

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuery(text.trim());
        showToast("CA loaded", text.trim().slice(0, 24) + "…");
      }
    } catch { showToast("clipboard blocked", "grant clipboard permission"); }
  };

  const handleBuy = (t: ShadowToken) => {
    showToast(`BUY ${t.symbol}`, `${quickBuy} SOL → routing via Jupiter Ultra`);
    // TODO: wire to fetchQuote → wallet sign → executeSwap
    // The api-server attaches feeAccount + platformFeeBps automatically.
  };

  const handleRefresh = () => {
    if (!isLiveFeed) { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); return; }
    setRefreshing(true);
    fetchTokens({ tier, sort: sortKey, search: query })
      .then((rows) => { setTokens(rows); setFeedError(null); })
      .catch((e: Error) => setFeedError(e.message))
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/5 text-primary text-[10px] font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {isLiveFeed ? "FEED LIVE — JUPITER ULTRA ROUTED" : "PREVIEW MODE — SET VITE_API_BASE FOR LIVE FEED"}
          </div>
          <NetworkPulseStrip pulse={pulse} />
        </div>
        <h1 className="text-2xl font-mono font-bold text-white mb-2">Trading Terminal</h1>
        <p className="text-sm font-mono text-white/35">Discover SPL tokens across their lifecycle, watchlist hot caps, quick-buy via routed swap.</p>
        {feedError && (
          <div className="mt-3 px-3 py-2 rounded-md border border-destructive/25 bg-destructive/[0.05] text-[10px] font-mono text-destructive tracking-widest">
            FEED ERROR — {feedError}
          </div>
        )}
      </motion.div>

      {/* Search + Quick Buy */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/8 bg-white/[0.02] focus-within:border-primary/30">
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search symbol, name, or paste contract address…"
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder:text-white/25 outline-none"
          />
          <button onClick={pasteClipboard} className="flex items-center gap-1 text-[9px] font-mono text-white/40 hover:text-primary transition-colors tracking-widest">
            <Clipboard className="w-3 h-3" /> PASTE
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/8 bg-white/[0.02]">
          <Wallet className="w-3.5 h-3.5 text-accent/70" />
          <span className="text-[9px] font-mono text-white/30 tracking-widest">QUICK BUY</span>
          <input
            type="number"
            value={quickBuy}
            min={0.01}
            step={0.05}
            onChange={(e) => setQuickBuy(parseFloat(e.target.value) || 0)}
            className="w-16 bg-transparent text-xs font-mono text-primary outline-none tabular-nums text-right"
          />
          <span className="text-[10px] font-mono text-white/40">SOL</span>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/8 bg-white/[0.02] text-[10px] font-mono text-white/40 hover:text-primary hover:border-primary/30 tracking-widest">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} /> REFRESH
        </button>
      </motion.div>

      {/* Watchlist */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold text-white flex items-center gap-2">
            <Star className="w-4 h-4 text-accent" /> Watchlist
            <span className="text-[9px] font-mono text-white/30 tracking-widest border border-white/10 rounded-full px-1.5 py-0.5">BETA</span>
          </h2>
          <span className="text-[9px] font-mono text-white/25 tracking-widest">{watchTokens.length} TRACKED</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {watchTokens.map((t) => (
            <button key={t.ca} onClick={() => toggleWatch(t.ca)}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/[0.03] hover:border-primary/40 transition-all">
              <TokenAvatar token={t} />
              <span className="text-[11px] font-mono font-bold text-primary">{t.symbol}</span>
              <span className={`text-[10px] font-mono tabular-nums ${t.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(1)}%
              </span>
              <span className="text-[9px] font-mono text-white/30">{fmtUSD(t.mcap)}</span>
            </button>
          ))}
          <button onClick={() => showToast("paste a CA", "use the search bar to add custom tokens")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/15 bg-white/[0.01] text-[10px] font-mono text-white/40 hover:text-primary hover:border-primary/30 tracking-widest">
            <Plus className="w-3 h-3" /> ADD TOKEN
          </button>
          <button onClick={pasteClipboard}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/15 bg-white/[0.01] text-[10px] font-mono text-white/40 hover:text-accent hover:border-accent/30 tracking-widest">
            <Clipboard className="w-3 h-3" /> PASTE CA
          </button>
        </div>
      </section>

      {/* Discover */}
      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-mono font-bold text-white">Discover Tokens</h2>
            <p className="text-[11px] font-mono text-white/30 mt-1">Live SPL feed scored by SHADOW engine — filter by market-cap tier.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-white/30 tracking-widest">SORT</span>
            <div className="relative">
              <ArrowUpDown className="w-3 h-3 text-white/40 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none pl-7 pr-7 py-1.5 rounded-md border border-white/10 bg-black/40 text-[10px] font-mono text-white/70 tracking-widest cursor-pointer hover:border-primary/30 outline-none">
                <option value="score">SHADOW SCORE</option>
                <option value="age">AGE (NEWEST)</option>
                <option value="mcap">MARKET CAP</option>
                <option value="liquidity">LIQUIDITY</option>
                <option value="holders">HOLDERS</option>
                <option value="volume">VOLUME</option>
                <option value="change">24H CHANGE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tier filters */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg border border-white/8 bg-white/[0.015] w-fit">
          {(["all", "micro", "small", "mid", "large"] as Tier[]).map((t) => (
            <button key={t} onClick={() => setTier(t)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono tracking-widest transition-all ${
                tier === t ? "bg-primary/15 text-primary border border-primary/30" : "text-white/40 hover:text-white/70 border border-transparent"
              }`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/7 bg-white/[0.015] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-black/40">
                <tr className="text-left text-[9px] font-mono text-white/35 tracking-widest uppercase">
                  <th className="px-3 py-2.5 font-normal">Age</th>
                  <th className="px-3 py-2.5 font-normal">Token</th>
                  <th className="px-3 py-2.5 font-normal">Socials</th>
                  <th className="px-3 py-2.5 font-normal">M.Cap</th>
                  <th className="px-3 py-2.5 font-normal">Liquidity</th>
                  <th className="px-3 py-2.5 font-normal">Holders</th>
                  <th className="px-3 py-2.5 font-normal">Volume</th>
                  <th className="px-3 py-2.5 font-normal">24h</th>
                  <th className="px-3 py-2.5 font-normal">TX</th>
                  <th className="px-3 py-2.5 font-normal">Score</th>
                  <th className="px-3 py-2.5 font-normal">Signal</th>
                  <th className="px-3 py-2.5 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-white/30 text-xs">no tokens match this filter.</td></tr>
                )}
                {filtered.map((t, i) => {
                  const watched = watchlist.includes(t.ca);
                  return (
                    <motion.tr key={t.ca}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                      className="border-t border-white/5 hover:bg-primary/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-white/55 tabular-nums">{fmtAge(t.ageMin)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleWatch(t.ca)} className={`shrink-0 transition-colors ${watched ? "text-accent" : "text-white/15 hover:text-white/40"}`}>
                            <Star className={`w-3 h-3 ${watched ? "fill-current" : ""}`} />
                          </button>
                          <TokenAvatar token={t} />
                          <div className="min-w-0">
                            <div className="text-white font-bold tracking-wider">{t.symbol}</div>
                            <div className="text-[9px] text-white/30 truncate max-w-[140px]">{t.name} · <span className="text-white/40">{shortCa(t.ca)}</span></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-white/30">
                          {t.socials.x   && <a href={t.socials.x}   target="_blank" rel="noreferrer" className="hover:text-primary"><Twitter className="w-3 h-3" /></a>}
                          {t.socials.tg  && <a href={t.socials.tg}  target="_blank" rel="noreferrer" className="hover:text-primary"><Send className="w-3 h-3" /></a>}
                          {t.socials.web && <a href={t.socials.web} target="_blank" rel="noreferrer" className="hover:text-primary"><Globe className="w-3 h-3" /></a>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-white/75 tabular-nums">{fmtUSD(t.mcap)}</td>
                      <td className="px-3 py-2.5 text-white/60 tabular-nums">{fmtUSD(t.liquidity)}</td>
                      <td className="px-3 py-2.5 text-white/60 tabular-nums">{fmtNum(t.holders)}</td>
                      <td className="px-3 py-2.5 text-white/60 tabular-nums">{fmtUSD(t.volume24h)}</td>
                      <td className={`px-3 py-2.5 tabular-nums ${t.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                        <span className="inline-flex items-center gap-1">
                          {t.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-primary/70 tabular-nums">{fmtNum(t.buys24h)}</span>
                          <span className="text-white/15">/</span>
                          <span className="text-destructive/80 tabular-nums">{fmtNum(t.sells24h)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><ScoreBar score={t.shadowScore} /></td>
                      <td className="px-3 py-2.5"><SignalPill s={t.signal} /></td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button onClick={() => handleBuy(t)}
                            className="px-3 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono tracking-widest hover:bg-primary/20 transition-colors flex items-center gap-1">
                            <Activity className="w-3 h-3" /> BUY
                          </button>
                          <a href={`https://dexscreener.com/solana/${t.ca}`} target="_blank" rel="noreferrer"
                            className="p-1 rounded-md border border-white/10 text-white/40 hover:text-accent hover:border-accent/30 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="p-4 rounded-lg border border-white/5 bg-white/[0.015]">
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          <span className="text-primary/60">ROUTING:</span> swaps execute through the Jupiter Ultra API for &lt;2s landing &amp; built-in MEV protection.
          Platform fees route directly to <code className="text-primary/70">FEE_ACCOUNT_*</code> in the same tx — see <code className="text-primary/70">trading-api.ts</code> header for the full env-vars list and fee mechanics.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 right-4 z-40 px-4 py-3 rounded-lg border border-primary/30 bg-black/90 backdrop-blur shadow-[0_0_24px_-6px_rgba(111,175,155,0.4)]">
          <div className="text-[10px] font-mono text-primary tracking-widest mb-0.5">{toast.title}</div>
          <div className="text-[11px] font-mono text-white/70">{toast.msg}</div>
        </motion.div>
      )}
    </div>
  );
}
