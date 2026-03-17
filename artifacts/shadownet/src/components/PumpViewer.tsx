import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink, Globe, Flame, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const BASE = import.meta.env.BASE_URL as string;

interface PumpToken {
  address: string;
  symbol: string;
  name: string;
  icon: string | null;
  description: string | null;
  priceUsd: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pumpUrl: string;
  dexUrl: string;
  twitter: string | null;
  website: string | null;
}

function fmt(n: number | null, prefix = ""): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(2)}`;
}

function fmtPrice(n: number | null): string {
  if (n === null) return "—";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.01) return `$${n.toFixed(8)}`;
  return `$${n.toFixed(6)}`;
}

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-white/30">—</span>;
  const up = v >= 0;
  return (
    <span className={up ? "text-green-400" : "text-red-400"}>
      {up ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

type SortKey = "marketCap" | "volume24h" | "priceChange24h" | "new";

export default function PumpViewer() {
  const [tokens, setTokens] = useState<PumpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}api/pump-tokens`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setTokens(data.tokens ?? []);
      setLastFetch(data.fetchedAt ?? Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...tokens].sort((a, b) => {
    if (sort === "marketCap") return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    if (sort === "volume24h") return (b.volume24h ?? 0) - (a.volume24h ?? 0);
    if (sort === "priceChange24h") return (b.priceChange24h ?? -999) - (a.priceChange24h ?? -999);
    return 0;
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-primary" />
          <span className="font-mono font-bold text-xs text-primary tracking-widest">PUMP.FUN LIVE FEED</span>
          <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono px-1.5 py-0.5 rounded">RELAY ACTIVE</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-white/30 hover:text-primary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1">
        {(["new", "marketCap", "volume24h", "priceChange24h"] as SortKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-2 py-1 text-[9px] font-mono rounded transition-colors ${
              sort === s
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/3 text-white/30 border border-white/5 hover:text-white/50"
            }`}
          >
            {s === "new" ? "NEW" : s === "marketCap" ? "MKT CAP" : s === "volume24h" ? "VOLUME" : "24H"}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/3 rounded-xl p-3 animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-2 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-xs font-mono text-red-400">{error}</p>
          <button onClick={load} className="mt-2 text-[10px] font-mono text-primary hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <AnimatePresence>
          <div className="space-y-2">
            {sorted.map((token, i) => (
              <motion.div
                key={token.address}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white/3 hover:bg-white/5 border border-white/5 hover:border-primary/20 rounded-xl p-3 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="relative flex-shrink-0">
                    {token.icon ? (
                      <img
                        src={token.icon}
                        alt={token.symbol}
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-primary text-xs font-mono font-bold">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-white truncate">{token.symbol}</span>
                        <span className="text-white/30 text-[9px] font-mono truncate hidden sm:inline">{token.name}</span>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="font-mono text-xs text-white">{fmtPrice(token.priceUsd)}</div>
                        <div className="text-[9px]"><Change v={token.priceChange24h} /></div>
                      </div>
                    </div>

                    {/* Description */}
                    {token.description && (
                      <p className="text-[9px] font-mono text-white/30 truncate mb-1.5">{token.description}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[9px] font-mono text-white/30 mb-2">
                      {token.marketCap !== null && (
                        <span>MC <span className="text-white/50">{fmt(token.marketCap, "$")}</span></span>
                      )}
                      {token.volume24h !== null && (
                        <span>VOL <span className="text-white/50">{fmt(token.volume24h, "$")}</span></span>
                      )}
                      {token.buys24h !== null && token.sells24h !== null && (
                        <span>
                          <span className="text-green-400/70">{token.buys24h}B</span>
                          <span className="text-white/20"> / </span>
                          <span className="text-red-400/70">{token.sells24h}S</span>
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => window.open(`${BASE}api/proxy?url=${encodeURIComponent(token.pumpUrl)}`, "_blank", "noopener,noreferrer")}
                        className="flex items-center gap-1 px-2 py-1 bg-primary text-black font-mono font-bold text-[9px] rounded-md hover:bg-white transition-colors tracking-wider"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        PUMP.FUN
                      </button>
                      <a
                        href={token.dexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[9px] rounded-md hover:bg-purple-500/20 transition-colors"
                      >
                        <DollarSign className="w-2.5 h-2.5" />
                        DEXSCREENER
                      </a>
                      {token.twitter && (
                        <a
                          href={token.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[9px] rounded-md hover:bg-blue-500/20 transition-colors"
                        >
                          <XLogo className="w-2.5 h-2.5" />
                          X
                        </a>
                      )}
                      {token.website && (
                        <a
                          href={token.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-white/5 text-white/40 border border-white/10 font-mono text-[9px] rounded-md hover:bg-white/10 transition-colors"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          WEB
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {lastFetch && (
        <p className="text-[9px] font-mono text-white/20 text-center">
          Data via Dexscreener · {new Date(lastFetch).toLocaleTimeString()} · Relay IP masked
        </p>
      )}
    </div>
  );
}
