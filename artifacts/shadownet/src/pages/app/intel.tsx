import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Wallet, Users, Copy, Check, ExternalLink, AlertTriangle, ChevronRight, Activity, Star, Clock, Github, Shield, ShieldAlert, ShieldCheck, ThumbsUp, ThumbsDown, Code2, GitFork, Scale, FileText, Sparkles, Rocket, Bell, BellOff, Trash2, ArrowDownLeft, ArrowUpRight, RefreshCw, X } from "lucide-react";

const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletResult {
  address: string;
  solBalance: number;
  solBalanceUsd: number;
  solPrice: number;
  tokenCount: number;
  tokens: Array<{ mint: string; symbol: string; name: string; amount: number; priceUsd: number; valueUsd: number }>;
  txCount: number;
  totalUsd: number;
  firstActivity: string | null;
  lastActivity: string | null;
  score: number;
  aiSummary: string;
}

interface DevToken {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number | null;
  createdAt: string | null;
  signature: string;
}

interface ActivityEvent {
  signature: string;
  timestamp: string;
  slot: number;
  type: "BUY" | "SELL" | "RECEIVE" | "SEND" | "OTHER";
  tokenMint: string | null;
  tokenSymbol: string | null;
  tokenAmount: number | null;
  solDelta: number;
  valueUsd: number | null;
}

interface PnlSummaryUi {
  realizedUsd: number;
  unrealizedUsd: number;
  totalBoughtUsd: number;
  totalSoldUsd: number;
  closedPositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number; // 0-100 integer
  bestTokenMint: string | null;
  bestTokenSymbol: string | null;
  bestTokenRealizedUsd: number | null;
}

interface ArchetypeUi {
  type: "SNIPER" | "AIRDROP_FARMER" | "LIQUIDITY_PROVIDER" | "SMART_MONEY" | "BAG_HOLDER" | "ACTIVE_TRADER" | "DORMANT" | "NORMAL";
  label: string;
  description: string;
  confidence: number;
  signals: string[];
}

interface CopyTradeUi {
  tracked: number;
  winners: number;
  moonshots: number;
  winRate: number;
  message: string;
}

interface ScoreSnapshot { ts: number; score: number }

interface CrossSignalUi {
  mint: string;
  symbol?: string;
  verdict: "SAME_ENTITY_LIKELY" | "CONVERGENT_INTEREST" | "ISOLATED";
  reason: string;
  sources: { wallets: string[]; repos: string[]; x: string[] };
  sourceTypeCount: number;
}

interface OnchainResult {
  devTokens: DevToken[];
  activity: ActivityEvent[];
  scannedTxCount: number;
  pnl?: PnlSummaryUi;
  archetype?: ArchetypeUi;
  copyTrade?: CopyTradeUi | null;
  onchainScore?: number;
  scoreHistory?: ScoreSnapshot[];
  crossSignals?: CrossSignalUi[];
}

interface TrackedWallet {
  address: string;
  label?: string;
  addedAt: number;
  lastSeenSig?: string;
  notify?: boolean;
}

// ─── Tracked-wallets storage (localStorage; never sent to server) ────────────

const TRACKED_KEY = "shadownet:tracked-wallets";

function readTracked(): TrackedWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRACKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(w => typeof w?.address === "string") : [];
  } catch { return []; }
}

function writeTracked(list: TrackedWallet[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(TRACKED_KEY, JSON.stringify(list)); } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("shadownet:tracked-changed"));
  }
}

function isTracked(address: string): boolean {
  return readTracked().some(w => w.address === address);
}

function toggleTracked(address: string, label?: string): boolean {
  const list = readTracked();
  const existing = list.findIndex(w => w.address === address);
  if (existing >= 0) {
    list.splice(existing, 1);
    writeTracked(list);
    return false;
  }
  list.unshift({ address, label, addedAt: Date.now(), notify: true });
  writeTracked(list);
  return true;
}

function updateTracked(address: string, patch: Partial<TrackedWallet>): void {
  const list = readTracked();
  const i = list.findIndex(w => w.address === address);
  if (i < 0) return;
  list[i] = { ...list[i], ...patch };
  writeTracked(list);
}

function useTrackedList(): TrackedWallet[] {
  const [list, setList] = useState<TrackedWallet[]>(() => readTracked());
  useEffect(() => {
    const handler = () => setList(readTracked());
    window.addEventListener("shadownet:tracked-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("shadownet:tracked-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return list;
}

interface OwnerProfileUi {
  login: string;
  type: "User" | "Organization";
  createdAt: string | null;
  ageDays: number | null;
  publicRepos: number;
  followers: number;
}

interface ScamHitUi {
  id: string;
  label: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
}

interface ScamPatternsUi {
  matched: string[];
  drainerSignatures: string[];
  obfuscationDetected: boolean;
  riskScore: number;
  verdict?: "LIKELY_MALICIOUS" | "SUSPICIOUS" | "LOW_CONCERN" | "CLEAN";
  confidence?: number;
  hits?: ScamHitUi[];
}

interface AntiGamingUi {
  starsPerDay: number;
  starsSpike: boolean;
  commitConsistency: number;
  burstyCommits: boolean;
  ownerYoungAccount: boolean;
  flags: string[];
}

interface StructuralRiskUi {
  contributorCount: number;
  topContributorShare: number;
  soloDevDominance: boolean;
  youngContributorCohort: boolean;
  commitMessageEntropy: number;
  lowEntropyMessages: boolean;
  isFork: boolean;
  parentFullName: string | null;
  forkOfTemplate: boolean;
  flags: string[];
  topContributors: Array<{
    login: string;
    contributions: number;
    accountAgeDays: number | null;
  }>;
}

interface GithubScanResult {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  license: string | null;
  createdAt: string;
  pushedAt: string;
  ageDays: number;
  daysSincePush: number;
  contributors: number;
  isFork: boolean;
  isArchived: boolean;
  topics: string[];
  hasReadme: boolean;
  depCount: number | null;
  devDepCount: number | null;
  fileCount: number;
  htmlUrl: string;
  trustScore: number;
  rawTrustScore?: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  codeOverview: string;
  pros: string[];
  cons: string[];
  risks: string[];
  owner_profile?: OwnerProfileUi | null;
  scamPatterns?: ScamPatternsUi;
  antiGaming?: AntiGamingUi;
  structuralRisk?: StructuralRiskUi;
  crossSignals?: CrossSignalUi[];
  mentionedMints?: string[];
  scoreHistory?: ScoreSnapshot[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL;

async function callApi<T>(endpoint: string, body: object): Promise<T> {
  const r = await fetch(`${BASE}api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "Unknown error");
  return d as T;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return Math.floor(days / 365) + "y ago";
  if (days > 30) return Math.floor(days / 30) + "mo ago";
  if (days > 0) return days + "d ago";
  const hrs = Math.floor(diff / 3600000);
  return hrs > 0 ? hrs + "h ago" : "recently";
}

function Sparkline({ points, width = 60, height = 18, color = "#39FF14" }: { points: number[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="opacity-80">
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ARCHETYPE_STYLES: Record<ArchetypeUi["type"], { color: string; bg: string; border: string; label: string }> = {
  SNIPER:             { color: "#fb923c", bg: "bg-orange-500/8",  border: "border-orange-500/25",  label: "SNIPER" },
  AIRDROP_FARMER:     { color: "#a78bfa", bg: "bg-purple-500/8",  border: "border-purple-500/25",  label: "AIRDROP FARMER" },
  LIQUIDITY_PROVIDER: { color: "#22d3ee", bg: "bg-cyan-500/8",    border: "border-cyan-500/25",    label: "LP" },
  SMART_MONEY:        { color: "#39FF14", bg: "bg-primary/10",    border: "border-primary/30",     label: "SMART MONEY" },
  BAG_HOLDER:         { color: "#ef4444", bg: "bg-red-500/8",     border: "border-red-500/25",     label: "BAG HOLDER" },
  ACTIVE_TRADER:      { color: "#60a5fa", bg: "bg-blue-500/8",    border: "border-blue-500/25",    label: "ACTIVE TRADER" },
  DORMANT:            { color: "#94a3b8", bg: "bg-white/5",       border: "border-white/15",       label: "DORMANT" },
  NORMAL:             { color: "#94a3b8", bg: "bg-white/5",       border: "border-white/15",       label: "STANDARD" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-white/30 hover:text-primary transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#39FF14" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <span className="absolute text-sm font-mono font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Wallet Analyzer ─────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  const map = {
    BUY:     { Icon: ArrowDownLeft, color: "#39FF14", label: "BUY" },
    SELL:    { Icon: ArrowUpRight, color: "#ef4444", label: "SELL" },
    RECEIVE: { Icon: ArrowDownLeft, color: "#8B5CF6", label: "IN" },
    SEND:    { Icon: ArrowUpRight, color: "#f59e0b", label: "OUT" },
    OTHER:   { Icon: Activity,     color: "#ffffff66", label: "TX" },
  } as const;
  const m = map[type];
  return (
    <div className="flex items-center gap-1.5">
      <m.Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
      <span className="text-[9px] font-mono tracking-widest" style={{ color: m.color }}>{m.label}</span>
    </div>
  );
}

function TrackButton({ address, label }: { address: string; label?: string }) {
  const [tracked, setTracked] = useState(false);
  useEffect(() => { setTracked(isTracked(address)); }, [address]);

  const click = async () => {
    const wasOff = !tracked;
    const nowTracked = toggleTracked(address, label);
    setTracked(nowTracked);
    // Request notification permission the first time someone enables tracking
    if (wasOff && nowTracked && typeof Notification !== "undefined" && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  };

  return (
    <button onClick={click}
      className={`px-3 py-2 rounded-lg border text-[10px] font-mono tracking-widest transition-colors flex items-center gap-1.5 ${
        tracked
          ? "bg-secondary/15 border-secondary/40 text-secondary hover:bg-secondary/25"
          : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.07] hover:text-white"
      }`}>
      {tracked ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
      {tracked ? "TRACKING" : "TRACK WALLET"}
    </button>
  );
}

function WalletAnalyzer() {
  const [tab, setTab] = useState<"analyze" | "tracked">("analyze");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onchain, setOnchain] = useState<OnchainResult | null>(null);
  const [onchainLoading, setOnchainLoading] = useState(false);

  const analyze = async () => {
    if (!address.trim()) return;
    setLoading(true); setError(null); setResult(null); setOnchain(null);
    try {
      const r = await callApi<WalletResult>("intelligence/wallet", { address: address.trim() });
      setResult(r);
      // Lazy-load on-chain details (dev tokens + activity) without blocking the main view
      setOnchainLoading(true);
      callApi<OnchainResult>("intelligence/wallet/onchain", { address: r.address, limit: 80 })
        .then(setOnchain)
        .catch(() => setOnchain({ devTokens: [], activity: [], scannedTxCount: 0 }))
        .finally(() => setOnchainLoading(false));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const trackedList = useTrackedList();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-mono font-bold text-white mb-1">Wallet Analyzer</h2>
          <p className="text-xs font-mono text-white/35">Paste any Solana address to inspect holdings, activity & score.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg border border-white/8 bg-black/40">
        <button onClick={() => setTab("analyze")}
          className={`flex-1 px-3 py-2 rounded-md text-[10px] font-mono tracking-widest transition-colors flex items-center justify-center gap-1.5 ${
            tab === "analyze" ? "bg-primary/15 text-primary" : "text-white/40 hover:text-white/70"
          }`}>
          <Search className="w-3 h-3" /> ANALYZE
        </button>
        <button onClick={() => setTab("tracked")}
          className={`flex-1 px-3 py-2 rounded-md text-[10px] font-mono tracking-widest transition-colors flex items-center justify-center gap-1.5 ${
            tab === "tracked" ? "bg-secondary/15 text-secondary" : "text-white/40 hover:text-white/70"
          }`}>
          <Bell className="w-3 h-3" /> TRACKED {trackedList.length > 0 && <span className="text-[9px] opacity-70">({trackedList.length})</span>}
        </button>
      </div>

      {tab === "analyze" && (
        <>
          {/* Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input value={address} onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && analyze()}
                placeholder="Solana wallet address…"
                className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" />
            </div>
            <button onClick={analyze} disabled={loading || !address.trim()}
              className="px-4 py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg hover:bg-white transition-colors disabled:opacity-40 tracking-widest">
              {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Search className="w-4 h-4" /></motion.div> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-red-400">{error}</p>
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div key={result.address} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Header Card */}
                <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-mono text-white/30">ADDRESS</p>
                        <CopyButton text={result.address} />
                      </div>
                      <p className="text-xs font-mono text-white truncate">{result.address.slice(0,16)}…{result.address.slice(-8)}</p>
                    </div>
                    <ScoreRing score={result.score} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "PORTFOLIO", value: fmtUsd(result.totalUsd) },
                      { label: "SOL BALANCE", value: result.solBalance.toFixed(3) + " SOL" },
                      { label: "TRANSACTIONS", value: result.txCount >= 100 ? "100+" : String(result.txCount) },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-lg bg-black/40 text-center">
                        <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider mb-1">{s.label}</p>
                        <p className="text-sm font-mono font-bold text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Track button */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/6">
                    <p className="text-[10px] font-mono text-white/30 leading-relaxed">
                      Get a feed of buys & sells from this wallet.
                    </p>
                    <TrackButton address={result.address} />
                  </div>
                </div>

                {/* AI Analysis */}
                {result.aiSummary && (
                  <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/[0.04]">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <p className="text-[10px] font-mono text-purple-400 tracking-widest">AI ANALYSIS</p>
                    </div>
                    <p className="text-xs font-mono text-white/75 leading-relaxed">{result.aiSummary}</p>
                  </div>
                )}

                {/* Activity timestamps */}
                {(result.firstActivity || result.lastActivity) && (
                  <div className="flex gap-3">
                    {result.firstActivity && (
                      <div className="flex-1 p-3 rounded-lg border border-white/6 bg-black/30">
                        <p className="text-[9px] font-mono text-white/25 uppercase mb-1">First Active</p>
                        <p className="text-xs font-mono text-white/60">{timeAgo(result.firstActivity)}</p>
                      </div>
                    )}
                    {result.lastActivity && (
                      <div className="flex-1 p-3 rounded-lg border border-white/6 bg-black/30">
                        <p className="text-[9px] font-mono text-white/25 uppercase mb-1">Last Active</p>
                        <p className="text-xs font-mono text-primary">{timeAgo(result.lastActivity)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Archetype + on-chain score + score history */}
                {onchain?.archetype && (() => {
                  const a = onchain.archetype!;
                  const style = ARCHETYPE_STYLES[a.type] ?? ARCHETYPE_STYLES.NORMAL;
                  const hist = (onchain.scoreHistory ?? []).map(s => s.score);
                  return (
                    <div className={`rounded-xl border ${style.border} ${style.bg} p-4 space-y-3`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono tracking-widest" style={{ color: style.color }}>{style.label}</span>
                            <span className="text-[9px] font-mono text-white/30">· {a.confidence}% confidence</span>
                          </div>
                          <p className="text-sm font-mono text-white font-bold">{a.label}</p>
                          <p className="text-xs font-mono text-white/55 mt-1 leading-relaxed">{a.description}</p>
                        </div>
                        {typeof onchain.onchainScore === "number" && (
                          <div className="text-right shrink-0">
                            <p className="text-[9px] font-mono text-white/30 uppercase">On-chain Score</p>
                            <p className="text-2xl font-mono font-bold" style={{ color: style.color }}>{onchain.onchainScore}</p>
                            {hist.length >= 2 && (
                              <div className="mt-1 flex justify-end">
                                <Sparkline points={hist} color={style.color} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {a.signals.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                          {a.signals.map((s, i) => (
                            <li key={i} className="text-[10px] font-mono text-white/55 px-2 py-0.5 rounded bg-black/30 border border-white/5">{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {/* Copy-trade signal */}
                {onchain?.copyTrade && (
                  <div className="rounded-xl border border-secondary/25 bg-secondary/[0.05] p-3 flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-secondary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-secondary tracking-widest mb-0.5">COPY-TRADE SIGNAL</p>
                      <p className="text-xs font-mono text-white/75">{onchain.copyTrade.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-mono text-white/30">WIN RATE</p>
                      <p className="text-sm font-mono font-bold text-secondary">{onchain.copyTrade.winRate}%</p>
                    </div>
                  </div>
                )}

                {/* PnL panel */}
                {onchain?.pnl && (onchain.pnl.closedPositions > 0 || onchain.pnl.totalBoughtUsd > 0) && (() => {
                  const p = onchain.pnl!;
                  const realizedColor = p.realizedUsd > 0 ? "text-primary" : p.realizedUsd < 0 ? "text-red-400" : "text-white/60";
                  return (
                    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-primary/70" />
                          <p className="text-[10px] font-mono text-white/60 tracking-widest">REALIZED PnL · {onchain.scannedTxCount} TXS</p>
                        </div>
                        <p className="text-[9px] font-mono text-white/30">{p.closedPositions} closed · {p.winningPositions}W / {p.losingPositions}L</p>
                      </div>
                      <div className="grid grid-cols-3 gap-px bg-white/5">
                        <div className="p-3 bg-black/40">
                          <p className="text-[9px] font-mono text-white/30 uppercase mb-1">Realized</p>
                          <p className={`text-sm font-mono font-bold ${realizedColor}`}>{p.realizedUsd >= 0 ? "+" : ""}{fmtUsd(p.realizedUsd)}</p>
                        </div>
                        <div className="p-3 bg-black/40">
                          <p className="text-[9px] font-mono text-white/30 uppercase mb-1">Win Rate</p>
                          <p className="text-sm font-mono font-bold text-white">{p.winRate}%</p>
                        </div>
                        <div className="p-3 bg-black/40">
                          <p className="text-[9px] font-mono text-white/30 uppercase mb-1">Volume</p>
                          <p className="text-sm font-mono font-bold text-white/80">{fmtUsd(p.totalBoughtUsd + p.totalSoldUsd)}</p>
                        </div>
                      </div>
                      {p.bestTokenSymbol && p.bestTokenRealizedUsd !== null && p.bestTokenRealizedUsd > 0 && (
                        <div className="px-4 py-2 border-t border-white/5 bg-primary/[0.03] flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-primary" />
                          <p className="text-[10px] font-mono text-white/60">
                            Best trade: <span className="text-primary font-bold">{p.bestTokenSymbol}</span> · +{fmtUsd(p.bestTokenRealizedUsd)} realized
                          </p>
                        </div>
                      )}
                      <p className="px-4 py-2 text-[9px] font-mono text-white/25 leading-relaxed border-t border-white/5">
                        Approximate — based on SOL flow at scan time. Limited to the last {onchain.scannedTxCount} transactions.
                      </p>
                    </div>
                  );
                })()}

                {/* Cross-signal intelligence: this wallet's tokens that other channels (repos / X) also touched */}
                {onchain?.crossSignals && onchain.crossSignals.length > 0 && (
                  <div className="rounded-xl border border-secondary/30 bg-gradient-to-br from-secondary/[0.06] via-black/30 to-primary/[0.04] overflow-hidden">
                    <div className="px-4 py-3 border-b border-secondary/15 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-secondary" />
                        <p className="text-[10px] font-mono text-secondary tracking-widest">CROSS-SIGNAL INTELLIGENCE</p>
                      </div>
                      <p className="text-[9px] font-mono text-white/30">{onchain.crossSignals.length} match{onchain.crossSignals.length === 1 ? "" : "es"}</p>
                    </div>
                    <p className="px-4 py-2 text-[10px] font-mono text-white/50 border-b border-white/5">
                      Tokens this wallet traded that ALSO appear in scanned GitHub repos or X mentions — same-entity signal.
                    </p>
                    <div className="divide-y divide-white/5">
                      {onchain.crossSignals.map(cs => {
                        const verdictColor =
                          cs.verdict === "SAME_ENTITY_LIKELY" ? "text-red-400 bg-red-500/10 border-red-500/40"
                          : cs.verdict === "CONVERGENT_INTEREST" ? "text-amber-300 bg-amber-500/10 border-amber-500/40"
                          : "text-white/50 bg-white/5 border-white/10";
                        const verdictLabel =
                          cs.verdict === "SAME_ENTITY_LIKELY" ? "SAME ENTITY LIKELY"
                          : cs.verdict === "CONVERGENT_INTEREST" ? "CONVERGENT INTEREST"
                          : "ISOLATED";
                        return (
                          <div key={cs.mint} className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-white">{cs.symbol || cs.mint.slice(0, 6) + "…"}</span>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${verdictColor}`}>{verdictLabel}</span>
                              <span className="text-[9px] font-mono text-white/30">{cs.sourceTypeCount}/3 sources</span>
                            </div>
                            <p className="text-[10px] font-mono text-white/65 leading-relaxed">{cs.reason}</p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {cs.sources.repos.slice(0, 4).map(r => (
                                <a key={r} href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70 hover:border-secondary/40 hover:text-secondary transition-colors">
                                  repo:{r}
                                </a>
                              ))}
                              {cs.sources.wallets.slice(0, 4).map(w => (
                                <span key={w} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                  wallet:{w.slice(0, 4)}…{w.slice(-4)}
                                </span>
                              ))}
                              {cs.sources.x.slice(0, 4).map(x => (
                                <span key={x} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                  x:@{x}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Dev Tokens (coins launched by this wallet) */}
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] overflow-hidden">
                  <div className="px-4 py-3 border-b border-primary/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[10px] font-mono text-primary tracking-widest">DEV TOKENS — COINS LAUNCHED</p>
                    </div>
                    {onchainLoading && (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RefreshCw className="w-3 h-3 text-primary/50" />
                      </motion.div>
                    )}
                  </div>
                  {onchainLoading && !onchain ? (
                    <p className="text-[10px] font-mono text-white/30 text-center py-5">Scanning recent transactions…</p>
                  ) : onchain && onchain.devTokens.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {onchain.devTokens.map(t => (
                        <div key={t.mint} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-mono text-primary font-bold">{t.symbol.slice(0,3).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-white font-bold truncate">{t.symbol} <span className="text-white/40 font-normal">{t.name && t.name !== "Unknown Token" ? `· ${t.name}` : ""}</span></p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-[10px] font-mono text-white/30 truncate">{t.mint.slice(0,16)}…</p>
                              <CopyButton text={t.mint} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {t.priceUsd > 0 ? (
                              <p className="text-xs font-mono text-white">${t.priceUsd < 0.01 ? t.priceUsd.toFixed(7) : t.priceUsd.toFixed(4)}</p>
                            ) : (
                              <p className="text-[10px] font-mono text-white/30">no price</p>
                            )}
                            {t.createdAt && <p className="text-[9px] font-mono text-white/30">{timeAgo(t.createdAt)}</p>}
                          </div>
                          <a href={`https://dexscreener.com/solana/${t.mint}`} target="_blank" rel="noopener noreferrer"
                            className="text-white/30 hover:text-primary transition-colors shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-white/30 text-center py-5">
                      No coins launched detected{onchain ? ` in last ${onchain.scannedTxCount} txs` : ""}.
                    </p>
                  )}
                </div>

                {/* Token Holdings */}
                {result.tokens.length > 0 && (
                  <div className="rounded-xl border border-white/8 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6 bg-black/40 flex items-center justify-between">
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Token Holdings</p>
                      <p className="text-[10px] font-mono text-white/25">{result.tokenCount} tokens</p>
                    </div>
                    <div className="divide-y divide-white/5">
                      {result.tokens.slice(0, 10).map(t => (
                        <div key={t.mint} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-mono text-primary font-bold">{t.symbol.slice(0,3)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-white font-bold">{t.symbol}</p>
                            <p className="text-[10px] font-mono text-white/30 truncate">{t.mint.slice(0,12)}…</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono text-white">{t.valueUsd > 0 ? fmtUsd(t.valueUsd) : "—"}</p>
                            <p className="text-[10px] font-mono text-white/30">{t.amount > 0.001 ? fmtNum(t.amount) : "<0.001"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.tokens.length === 0 && (
                  <p className="text-xs font-mono text-white/25 text-center py-4">No token holdings found.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {tab === "tracked" && <TrackedWalletsView />}
    </div>
  );
}

// ─── Tracked Wallets Feed ─────────────────────────────────────────────────────

function TrackedWalletsView() {
  const tracked = useTrackedList();
  const [feeds, setFeeds] = useState<Record<string, OnchainResult | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const lastSeenRef = useRef<Record<string, string | undefined>>({});
  // Per-wallet monotonic request ID + already-notified sig set to prevent stale/duplicate notifications.
  const reqIdRef = useRef<Record<string, number>>({});
  const notifiedRef = useRef<Record<string, Set<string>>>({});

  const refreshOne = useCallback(async (addr: string, options?: { silent?: boolean }) => {
    const myId = (reqIdRef.current[addr] ?? 0) + 1;
    reqIdRef.current[addr] = myId;
    setLoading(s => ({ ...s, [addr]: true }));
    try {
      const r = await callApi<OnchainResult>("intelligence/wallet/onchain", { address: addr, limit: 60 });
      // Drop stale responses — only the latest in-flight request applies
      if (reqIdRef.current[addr] !== myId) return;

      setFeeds(s => ({ ...s, [addr]: r }));

      const prevSig = lastSeenRef.current[addr];
      const newest = r.activity[0];
      if (newest && newest.signature !== prevSig) {
        if (prevSig && !options?.silent) {
          // Find all events newer than prevSig
          const newEvents: ActivityEvent[] = [];
          for (const ev of r.activity) {
            if (ev.signature === prevSig) break;
            newEvents.push(ev);
          }
          if (newEvents.length > 0 && typeof Notification !== "undefined" && Notification.permission === "granted") {
            const seen = (notifiedRef.current[addr] ??= new Set());
            const e = newEvents.find(ev => !seen.has(ev.signature));
            if (e) {
              seen.add(e.signature);
              const short = addr.slice(0, 4) + "…" + addr.slice(-4);
              try {
                new Notification(`ShadowNet: ${e.type} on ${short}`, {
                  body: `${e.tokenSymbol ?? "token"} ${e.tokenAmount ? fmtNum(Math.abs(e.tokenAmount)) : ""}${e.valueUsd ? ` (≈${fmtUsd(e.valueUsd)})` : ""}`,
                  tag: `shadownet-${addr}-${e.signature}`,
                  silent: false,
                });
              } catch {}
            }
          }
        }
        lastSeenRef.current[addr] = newest.signature;
        updateTracked(addr, { lastSeenSig: newest.signature });
      }
    } catch {
      if (reqIdRef.current[addr] !== myId) return;
      setFeeds(s => ({ ...s, [addr]: s[addr] ?? { devTokens: [], activity: [], scannedTxCount: 0 } }));
    } finally {
      if (reqIdRef.current[addr] === myId) {
        setLoading(s => ({ ...s, [addr]: false }));
      }
    }
  }, []);

  // Initial load + bootstrap lastSeenSig from localStorage
  useEffect(() => {
    for (const w of tracked) {
      if (w.lastSeenSig) lastSeenRef.current[w.address] = w.lastSeenSig;
      if (!feeds[w.address]) refreshOne(w.address, { silent: true });
    }
    // Cleanup feeds for removed wallets
    setFeeds(prev => {
      const addrs = new Set(tracked.map(t => t.address));
      const next: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) if (addrs.has(k)) next[k] = v;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked.map(t => t.address).join("|")]);

  // Auto-poll every 45s while this view is mounted
  useEffect(() => {
    if (tracked.length === 0) return;
    const id = window.setInterval(() => {
      for (const w of tracked) refreshOne(w.address);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [tracked, refreshOne]);

  if (tracked.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-3">
          <Bell className="w-5 h-5 text-secondary/60" />
        </div>
        <p className="text-sm font-mono text-white/60">No wallets tracked yet</p>
        <p className="text-xs font-mono text-white/30 max-w-sm mx-auto leading-relaxed">
          Analyze a wallet then hit <span className="text-secondary">TRACK WALLET</span> to follow its buys and sells. Tracked wallets are stored only in this browser — never sent to ShadowNet.
        </p>
      </div>
    );
  }

  const totalEvents = Object.values(feeds).reduce((s, f) => s + (f?.activity.length ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-white/40 tracking-widest">
          {tracked.length} TRACKED · {totalEvents} EVENTS · POLLS EVERY 45s
        </p>
        <button onClick={() => { for (const w of tracked) refreshOne(w.address); }}
          className="text-[10px] font-mono text-white/40 hover:text-primary transition-colors flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" /> REFRESH ALL
        </button>
      </div>

      {tracked.map(w => {
        const feed = feeds[w.address];
        const isLoading = loading[w.address];
        return (
          <div key={w.address} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 bg-black/40 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center shrink-0">
                <Wallet className="w-3.5 h-3.5 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white truncate">{w.address.slice(0,12)}…{w.address.slice(-6)}</p>
                <p className="text-[9px] font-mono text-white/30">added {timeAgo(new Date(w.addedAt).toISOString())}</p>
              </div>
              <button onClick={() => refreshOne(w.address)}
                title="Refresh now"
                className="text-white/30 hover:text-primary transition-colors p-1">
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </motion.div>
                ) : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => toggleTracked(w.address)}
                title="Stop tracking"
                className="text-white/30 hover:text-red-400 transition-colors p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {!feed && isLoading && (
              <p className="text-[10px] font-mono text-white/30 text-center py-5">Scanning…</p>
            )}
            {feed && feed.activity.length === 0 && (
              <p className="text-[10px] font-mono text-white/30 text-center py-5">
                No buy/sell activity in last {feed.scannedTxCount} txs.
              </p>
            )}
            {feed && feed.activity.length > 0 && (
              <div className="divide-y divide-white/5">
                {feed.activity.slice(0, 10).map(ev => (
                  <a key={ev.signature}
                    href={`https://solscan.io/tx/${ev.signature}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="shrink-0">
                      <ActivityIcon type={ev.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-white font-bold truncate">
                          {ev.tokenAmount ? fmtNum(Math.abs(ev.tokenAmount)) : ""} {ev.tokenSymbol ?? "?"}
                        </p>
                        {ev.valueUsd && <span className="text-[10px] font-mono text-white/40">≈ {fmtUsd(ev.valueUsd)}</span>}
                      </div>
                      <p className="text-[9px] font-mono text-white/25">
                        {timeAgo(ev.timestamp)}{Math.abs(ev.solDelta) > 0.001 ? ` · ${ev.solDelta > 0 ? "+" : ""}${ev.solDelta.toFixed(3)} SOL` : ""}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-white/20 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[9px] font-mono text-white/20 text-center leading-relaxed pt-2">
        Notifications are sent only by your browser. Tracked wallet list lives in <span className="text-white/40">localStorage</span> on this device — never uploaded.
      </p>
    </div>
  );
}

// ─── X Account Scanner (merged: profile + username history + posted CAs + smart followers) ──

function XAccountScanner() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setLoading(true); setError(null); setScanned(null);
    // Single unified scan — runs all sub-checks in parallel.
    // Backend integration is pending; surface a clear coming-soon notice while preserving the layout.
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setScanned(u);
    setError("X API integration is coming next update — this UI shows what each scan will produce.");
  };

  const sections: Array<{ title: string; desc: string; icon: React.ElementType; color: string }> = [
    { title: "PROFILE",          desc: "Handle, display name, bio, verification, follower & following counts.",        icon: XLogo,    color: "#ffffff" },
    { title: "USERNAME HISTORY", desc: "Previous handles detected from public archive snapshots & rename patterns.",   icon: Clock,    color: "#8B5CF6" },
    { title: "POSTED CONTRACTS", desc: "Solana contract addresses found in recent posts, with tweet links & dates.",   icon: FileText, color: "#39FF14" },
    { title: "SMART FOLLOWERS",  desc: "Known alpha traders, devs & KOLs that follow this account, ranked by signal.", icon: Star,     color: "#8B5CF6" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-mono font-bold text-white mb-1">X Account Intelligence</h2>
        <p className="text-xs font-mono text-white/35">One scan: profile, username history, posted contracts & smart followers.</p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
          <input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ""))}
            onKeyDown={e => e.key === "Enter" && scan()}
            placeholder="username"
            className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <button onClick={scan} disabled={loading || !username.trim()}
          className="px-5 py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg hover:bg-white transition-colors disabled:opacity-40 tracking-widest flex items-center gap-2">
          {loading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
              <Search className="w-4 h-4" />
            </motion.div>
          ) : <Search className="w-4 h-4" />}
          SCAN
        </button>
      </div>

      {/* What this scan returns — always visible */}
      <div className="grid grid-cols-2 gap-2.5">
        {sections.map(s => (
          <div key={s.title} className="p-3 rounded-lg border border-white/6 bg-white/[0.015]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <s.icon className="w-3 h-3" style={{ color: s.color }} />
              <p className="text-[9px] font-mono tracking-widest" style={{ color: s.color }}>{s.title}</p>
            </div>
            <p className="text-[10px] font-mono text-white/45 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-amber-500/25 bg-amber-500/5 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[10px] font-mono text-amber-400 tracking-widest mb-1">COMING SOON</p>
            <p className="text-xs font-mono text-amber-400/80 leading-relaxed">{error}</p>
            {scanned && (
              <p className="text-[10px] font-mono text-white/30 mt-2">
                Queued scan: <span className="text-white/60">@{scanned}</span>
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[9px] font-mono text-white/20 text-center leading-relaxed pt-1">
        Requires Twitter API v2 Bearer Token to enable. Privacy-preserving: handles are queried per-scan and never persisted server-side.
      </p>
    </div>
  );
}


// ─── GitHub Scanner ──────────────────────────────────────────────────────────

function GithubScanner() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GithubScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try { setResult(await callApi<GithubScanResult>("intelligence/github-scan", { repo: input.trim() })); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const riskMeta = (level: "LOW" | "MEDIUM" | "HIGH") => {
    switch (level) {
      case "LOW":    return { color: "#39FF14", Icon: ShieldCheck, label: "LOW RISK",    bg: "bg-primary/8", border: "border-primary/25" };
      case "MEDIUM": return { color: "#f59e0b", Icon: Shield,      label: "MEDIUM RISK", bg: "bg-amber-500/8", border: "border-amber-500/25" };
      case "HIGH":   return { color: "#ef4444", Icon: ShieldAlert, label: "HIGH RISK",   bg: "bg-red-500/8", border: "border-red-500/25" };
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-mono font-bold text-white mb-1">GitHub Repo Scanner</h2>
        <p className="text-xs font-mono text-white/35">Analyze any public repo for trust score, code overview, and security risks.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && scan()}
            placeholder="owner/repo or github.com/owner/repo"
            className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <button onClick={scan} disabled={loading || !input.trim()}
          className="px-4 py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg hover:bg-white transition-colors disabled:opacity-40">
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Search className="w-4 h-4" /></motion.div> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {loading && (
        <div className="p-4 rounded-lg border border-primary/15 bg-primary/[0.03] flex items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
            <Activity className="w-4 h-4 text-primary" />
          </motion.div>
          <p className="text-xs font-mono text-primary/80">Fetching repo & running AI analysis…</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-red-400">{error}</p>
        </div>
      )}

      <AnimatePresence>
        {result && (() => {
          const risk = riskMeta(result.riskLevel);
          return (
            <motion.div key={result.fullName} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Header card */}
              <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Github className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-mono font-bold text-white hover:text-primary transition-colors truncate flex items-center gap-1.5 group">
                        {result.fullName}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                    {result.description && (
                      <p className="text-xs font-mono text-white/45 line-clamp-2">{result.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {result.isArchived && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono text-amber-400">ARCHIVED</span>
                      )}
                      {result.isFork && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-white/50">FORK</span>
                      )}
                      {result.language && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-mono text-purple-300">{result.language}</span>
                      )}
                      {result.license && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/8 border border-primary/20 text-[9px] font-mono text-primary">{result.license}</span>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={result.trustScore} />
                </div>

                {/* Risk badge */}
                <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${risk.border} ${risk.bg}`}>
                  <risk.Icon className="w-4 h-4 shrink-0" style={{ color: risk.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono tracking-widest" style={{ color: risk.color }}>{risk.label}</p>
                    <p className="text-xs font-mono text-white/70 mt-0.5">{result.summary}</p>
                  </div>
                  {(result.scoreHistory ?? []).length >= 2 && (
                    <div className="shrink-0 self-center">
                      <Sparkline points={result.scoreHistory!.map(s => s.score)} color={risk.color} width={50} height={20} />
                    </div>
                  )}
                </div>

                {/* Owner profile */}
                {result.owner_profile && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-white/8 bg-black/30">
                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-white/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white truncate">
                        {result.owner_profile.login}
                        <span className="text-white/40"> · {result.owner_profile.type}</span>
                      </p>
                      <p className="text-[10px] font-mono text-white/40 mt-0.5">
                        {result.owner_profile.ageDays !== null
                          ? `Account ${result.owner_profile.ageDays >= 365 ? `${Math.floor(result.owner_profile.ageDays / 365)}y` : `${result.owner_profile.ageDays}d`} old`
                          : "Account age unknown"}
                        {" · "}{fmtNum(result.owner_profile.publicRepos)} repos
                        {" · "}{fmtNum(result.owner_profile.followers)} followers
                      </p>
                    </div>
                    {result.antiGaming?.ownerYoungAccount && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-mono text-amber-400">YOUNG ACCOUNT</span>
                    )}
                  </div>
                )}

                {/* Scam patterns — confidence-tiered verdict */}
                {result.scamPatterns && (result.scamPatterns.hits?.length || result.scamPatterns.matched.length > 0) && (() => {
                  const sp = result.scamPatterns!;
                  const hits = sp.hits ?? [];
                  const verdict = sp.verdict ?? (hits.some(h => h.severity === "HIGH") ? "LIKELY_MALICIOUS" : hits.length > 0 ? "SUSPICIOUS" : "CLEAN");
                  const verdictMeta = {
                    LIKELY_MALICIOUS: { label: "LIKELY MALICIOUS", border: "border-red-500/50", bg: "bg-red-500/[0.08]", text: "text-red-400", chipBg: "bg-red-500/15", chipText: "text-red-300" },
                    SUSPICIOUS:       { label: "SUSPICIOUS",        border: "border-amber-500/40", bg: "bg-amber-500/[0.06]", text: "text-amber-400", chipBg: "bg-amber-500/10", chipText: "text-amber-300" },
                    LOW_CONCERN:      { label: "LOW CONCERN",       border: "border-yellow-500/30", bg: "bg-yellow-500/[0.04]", text: "text-yellow-400", chipBg: "bg-yellow-500/10", chipText: "text-yellow-300" },
                    CLEAN:            { label: "CLEAN",             border: "border-white/10", bg: "bg-black/20", text: "text-white/40", chipBg: "bg-white/5", chipText: "text-white/50" },
                  }[verdict];
                  const sevColor = (s: "HIGH" | "MEDIUM" | "LOW") =>
                    s === "HIGH" ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : s === "MEDIUM" ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                    : "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
                  return (
                    <div className={`rounded-xl border ${verdictMeta.border} ${verdictMeta.bg} p-4 space-y-3`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className={`w-4 h-4 ${verdictMeta.text}`} />
                          <p className={`text-[10px] font-mono ${verdictMeta.text} tracking-widest`}>SCAM PATTERN VERDICT</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded ${verdictMeta.chipBg} ${verdictMeta.chipText} text-[10px] font-mono font-bold tracking-wider border ${verdictMeta.border}`}>
                            {verdictMeta.label}
                          </span>
                          <span className="text-[9px] font-mono text-white/40">
                            risk {sp.riskScore}/100
                            {typeof sp.confidence === "number" && sp.confidence > 0 ? ` · conf ${(sp.confidence * 100).toFixed(0)}%` : ""}
                          </span>
                        </div>
                      </div>
                      {hits.length > 0 ? (
                        <ul className="space-y-2">
                          {hits.map((h, i) => (
                            <li key={i} className="space-y-1">
                              <div className="flex items-start gap-2 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${sevColor(h.severity)}`}>{h.severity}</span>
                                <span className="text-xs font-mono text-white/85 leading-relaxed">{h.label}</span>
                              </div>
                              {h.evidence && (
                                <p className="ml-12 text-[10px] font-mono text-white/40 italic leading-snug break-all">"{h.evidence}"</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="space-y-1.5">
                          {sp.matched.map((m, i) => (
                            <li key={i} className="flex gap-2 text-xs font-mono text-white/70 leading-relaxed">
                              <AlertTriangle className="w-3 h-3 text-white/40 shrink-0 mt-0.5" />
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {sp.obfuscationDetected && hits.length === 0 && (
                        <p className="text-[10px] font-mono text-red-300/70">⚠ Obfuscated JS detected — manual code review strongly advised.</p>
                      )}
                    </div>
                  );
                })()}

                {/* Anti-gaming chips */}
                {result.antiGaming && (result.antiGaming.flags.length > 0 || result.antiGaming.starsSpike) && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-[10px] font-mono text-amber-400 tracking-widest">ANTI-GAMING SIGNALS</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-[10px] font-mono text-white/60">
                        {result.antiGaming.starsPerDay.toFixed(1)} stars/day
                      </span>
                      {result.antiGaming.starsSpike && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">STAR SPIKE</span>
                      )}
                      {result.antiGaming.burstyCommits && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">BURSTY COMMITS</span>
                      )}
                      {result.antiGaming.commitConsistency > 0 && (
                        <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-[10px] font-mono text-white/60">
                          consistency {(result.antiGaming.commitConsistency * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {result.antiGaming.flags.length > 0 && (
                      <ul className="pt-1 border-t border-white/5 space-y-1">
                        {result.antiGaming.flags.map((f, i) => (
                          <li key={i} className="text-[10px] font-mono text-amber-200/70">· {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Structural risk: contributor overlap, commit entropy, fork similarity */}
                {result.structuralRisk && (result.structuralRisk.flags.length > 0 || result.structuralRisk.topContributors.length > 0) && (() => {
                  const sr = result.structuralRisk!;
                  const hasFlags = sr.flags.length > 0;
                  const accent = hasFlags ? "border-orange-500/30 bg-orange-500/[0.04]" : "border-white/10 bg-black/20";
                  const headerColor = hasFlags ? "text-orange-300" : "text-white/55";
                  return (
                    <div className={`rounded-xl border ${accent} p-3 space-y-3`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className={`w-3.5 h-3.5 ${headerColor}`} />
                          <p className={`text-[10px] font-mono ${headerColor} tracking-widest`}>STRUCTURAL RISK</p>
                        </div>
                        <span className="text-[9px] font-mono text-white/30">
                          entropy {(sr.commitMessageEntropy * 100).toFixed(0)}% · top contributor {(sr.topContributorShare * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sr.soloDevDominance && (
                          <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-[10px] font-mono text-orange-300">SOLO-DEV DOMINANCE</span>
                        )}
                        {sr.youngContributorCohort && (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[10px] font-mono text-red-300">YOUNG CONTRIBUTOR COHORT</span>
                        )}
                        {sr.lowEntropyMessages && (
                          <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-[10px] font-mono text-orange-300">LOW MESSAGE ENTROPY</span>
                        )}
                        {sr.forkOfTemplate && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">FORK OF TEMPLATE</span>
                        )}
                        {sr.isFork && !sr.forkOfTemplate && sr.parentFullName && (
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/55">FORK OF {sr.parentFullName}</span>
                        )}
                      </div>
                      {sr.topContributors.length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[9px] font-mono text-white/30 tracking-widest uppercase mb-1.5">Top contributors</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sr.topContributors.map(c => {
                              const young = c.accountAgeDays !== null && c.accountAgeDays < 60;
                              return (
                                <a key={c.login} href={`https://github.com/${c.login}`} target="_blank" rel="noopener noreferrer"
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${young ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-white/5 border-white/10 text-white/65 hover:border-primary/30"}`}>
                                  {c.login} <span className="text-white/30">· {c.contributions}</span>
                                  {c.accountAgeDays !== null && (
                                    <span className={young ? "text-red-400" : "text-white/30"}> · {c.accountAgeDays}d</span>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sr.flags.length > 0 && (
                        <ul className="pt-2 border-t border-white/5 space-y-1">
                          {sr.flags.map((f, i) => (
                            <li key={i} className="text-[10px] font-mono text-orange-200/70">· {f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {/* Cross-signal: tokens this repo references that other channels also touched */}
                {result.crossSignals && result.crossSignals.length > 0 && (
                  <div className="rounded-xl border border-secondary/30 bg-gradient-to-br from-secondary/[0.06] via-black/30 to-primary/[0.04] overflow-hidden">
                    <div className="px-4 py-3 border-b border-secondary/15 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-secondary" />
                        <p className="text-[10px] font-mono text-secondary tracking-widest">CROSS-SIGNAL INTELLIGENCE</p>
                      </div>
                      <p className="text-[9px] font-mono text-white/30">{result.crossSignals.length} match{result.crossSignals.length === 1 ? "" : "es"}</p>
                    </div>
                    <p className="px-4 py-2 text-[10px] font-mono text-white/50 border-b border-white/5">
                      Tokens mentioned in this repo's README that ALSO appear in scanned wallets or X mentions.
                    </p>
                    <div className="divide-y divide-white/5">
                      {result.crossSignals.map(cs => {
                        const verdictColor =
                          cs.verdict === "SAME_ENTITY_LIKELY" ? "text-red-400 bg-red-500/10 border-red-500/40"
                          : cs.verdict === "CONVERGENT_INTEREST" ? "text-amber-300 bg-amber-500/10 border-amber-500/40"
                          : "text-white/50 bg-white/5 border-white/10";
                        const verdictLabel =
                          cs.verdict === "SAME_ENTITY_LIKELY" ? "SAME ENTITY LIKELY"
                          : cs.verdict === "CONVERGENT_INTEREST" ? "CONVERGENT INTEREST"
                          : "ISOLATED";
                        return (
                          <div key={cs.mint} className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-white">{cs.mint.slice(0, 10)}…</span>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${verdictColor}`}>{verdictLabel}</span>
                              <span className="text-[9px] font-mono text-white/30">{cs.sourceTypeCount}/3 sources</span>
                              <CopyButton text={cs.mint} />
                            </div>
                            <p className="text-[10px] font-mono text-white/65 leading-relaxed">{cs.reason}</p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {cs.sources.wallets.slice(0, 4).map(w => (
                                <span key={w} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                  wallet:{w.slice(0, 4)}…{w.slice(-4)}
                                </span>
                              ))}
                              {cs.sources.repos.slice(0, 4).map(r => (
                                <span key={r} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                  repo:{r}
                                </span>
                              ))}
                              {cs.sources.x.slice(0, 4).map(x => (
                                <span key={x} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                  x:@{x}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mentioned mints (no cross-signal yet — informational) */}
                {result.mentionedMints && result.mentionedMints.length > 0 && (!result.crossSignals || result.crossSignals.length === 0) && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-white/40" />
                      <p className="text-[10px] font-mono text-white/55 tracking-widest">SOLANA ADDRESSES IN README</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.mentionedMints.slice(0, 6).map(m => (
                        <a key={m} href={`https://dexscreener.com/solana/${m}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/65 hover:border-primary/30 hover:text-primary transition-colors">
                          {m.slice(0, 6)}…{m.slice(-4)}
                        </a>
                      ))}
                    </div>
                    <p className="text-[9px] font-mono text-white/30">
                      No cross-channel match yet — scan a wallet that holds one of these to test the same-entity signal.
                    </p>
                  </div>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "STARS", value: fmtNum(result.stars), icon: Star },
                  { label: "FORKS", value: fmtNum(result.forks), icon: GitFork },
                  { label: "CONTRIBUTORS", value: fmtNum(result.contributors), icon: Users },
                  { label: "OPEN ISSUES", value: fmtNum(result.openIssues), icon: AlertTriangle },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg border border-white/6 bg-black/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className="w-3 h-3 text-white/30" />
                      <p className="text-[9px] font-mono text-white/30 tracking-widest">{s.label}</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Activity */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg border border-white/6 bg-black/30">
                  <p className="text-[9px] font-mono text-white/25 uppercase mb-1">Created</p>
                  <p className="text-xs font-mono text-white/60">{timeAgo(result.createdAt)}</p>
                </div>
                <div className="flex-1 p-3 rounded-lg border border-white/6 bg-black/30">
                  <p className="text-[9px] font-mono text-white/25 uppercase mb-1">Last Push</p>
                  <p className={`text-xs font-mono ${result.daysSincePush > 365 ? "text-amber-400" : "text-primary"}`}>{timeAgo(result.pushedAt)}</p>
                </div>
              </div>

              {/* Code Overview */}
              {result.codeOverview && (
                <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="w-3.5 h-3.5 text-purple-400" />
                    <p className="text-[10px] font-mono text-white/40 tracking-widest">CODE OVERVIEW</p>
                  </div>
                  <p className="text-xs font-mono text-white/70 leading-relaxed">{result.codeOverview}</p>
                </div>
              )}

              {/* Pros */}
              {result.pros.length > 0 && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] font-mono text-primary tracking-widest">WHAT'S GOOD</p>
                  </div>
                  <ul className="space-y-2">
                    {result.pros.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs font-mono text-white/70 leading-relaxed">
                        <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {result.cons.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-[10px] font-mono text-amber-400 tracking-widest">WHAT'S WEAK</p>
                  </div>
                  <ul className="space-y-2">
                    {result.cons.map((c, i) => (
                      <li key={i} className="flex gap-2 text-xs font-mono text-white/70 leading-relaxed">
                        <ChevronRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {result.risks.length > 0 && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <p className="text-[10px] font-mono text-red-400 tracking-widest">SECURITY RISKS</p>
                  </div>
                  <ul className="space-y-2">
                    {result.risks.map((r, i) => (
                      <li key={i} className="flex gap-2 text-xs font-mono text-white/70 leading-relaxed">
                        <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Repo facts footer */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-white/6 bg-black/30">
                  <FileText className="w-3 h-3 text-white/30" />
                  <p className="text-[10px] font-mono text-white/40">{result.fileCount} root files</p>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-white/6 bg-black/30">
                  <Scale className="w-3 h-3 text-white/30" />
                  <p className="text-[10px] font-mono text-white/40">{result.license ?? "No license"}</p>
                </div>
                {result.depCount !== null && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-white/6 bg-black/30 col-span-2">
                    <Code2 className="w-3 h-3 text-white/30" />
                    <p className="text-[10px] font-mono text-white/40">{result.depCount} runtime + {result.devDepCount} dev dependencies</p>
                  </div>
                )}
              </div>

              <p className="text-[9px] font-mono text-white/20 text-center">AI-assisted analysis. Always verify critical findings independently.</p>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Intel Hub ───────────────────────────────────────────────────────────

type IntelTab = "wallet" | "x" | "github";

const tabs: Array<{ id: IntelTab; label: string; icon: React.ElementType; shortLabel: string }> = [
  { id: "wallet", label: "Wallet Analyzer",      icon: Wallet, shortLabel: "WALLET" },
  { id: "x",      label: "X Account Intel",      icon: XLogo,  shortLabel: "X" },
  { id: "github", label: "GitHub Scanner",       icon: Github, shortLabel: "GITHUB" },
];

export default function IntelHub() {
  const [tab, setTab] = useState<IntelTab>("wallet");

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[9px] font-mono tracking-widest mb-3">
          <Activity className="w-3 h-3" />
          INTELLIGENCE SUITE
        </div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Intel</h1>
        <p className="text-xs font-mono text-white/35">On-chain wallet analysis, X account intelligence, and GitHub repo trust scanning.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-black/60 border border-white/6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg transition-all text-[9px] font-mono tracking-widest ${tab === t.id ? "bg-primary/15 text-primary border border-primary/25" : "text-white/30 hover:text-white/60"}`}>
            <t.icon className="w-4 h-4" />
            {t.shortLabel}
          </button>
        ))}
      </div>

      {/* Tool content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
          {tab === "wallet" && <WalletAnalyzer />}
          {tab === "x"      && <XAccountScanner />}
          {tab === "github" && <GithubScanner />}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
