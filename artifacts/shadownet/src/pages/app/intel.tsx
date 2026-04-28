import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Wallet, Users, Copy, Check, ExternalLink, AlertTriangle, ChevronRight, Activity, Zap, Star, Clock, Github, Shield, ShieldAlert, ShieldCheck, ThumbsUp, ThumbsDown, Code2, GitFork, Scale, FileText } from "lucide-react";

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
}

interface CAResult {
  username: string;
  displayName: string;
  followers: number;
  bio: string;
  verified: boolean;
  joinDate: string | null;
  userId: string | null;
  caCount: number;
  contractAddresses: Array<{ address: string; postedAt: string | null; tweetText: string; tweetId: string }>;
  usernameHistory: {
    currentUsername: string;
    firstSeen: string | null;
    lastSeen: string | null;
    snapshotCount: number;
    possiblePreviousNames: string[];
    note: string;
  } | null;
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
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  codeOverview: string;
  pros: string[];
  cons: string[];
  risks: string[];
}

interface SmartFollowersResult {
  username: string;
  displayName: string;
  followers: number;
  following: number;
  ratio: number;
  smartScore: number;
  smartFollowerCount: number;
  totalEstimated: number;
  smartFollowers: Array<{ username: string; displayName: string; followers: number; tags: string[] }>;
  note: string;
  requiresApiKey: boolean;
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

function WalletAnalyzer() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!address.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try { setResult(await callApi<WalletResult>("intelligence/wallet", { address: address.trim() })); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-mono font-bold text-white mb-1">Wallet Analyzer</h2>
        <p className="text-xs font-mono text-white/35">Paste any Solana address to inspect holdings, activity & score.</p>
      </div>

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
              <div className="grid grid-cols-3 gap-3">
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
            </div>

            {/* Activity */}
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
    </div>
  );
}

// ─── X CA Checker ─────────────────────────────────────────────────────────────

function XCAChecker() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CAResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!username.trim()) return;
    setLoading(true); setError(null); setResult(null);
    // Simulate loading then show COMING SOON message
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setError("COMING SOON! X API integration coming in next update.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-mono font-bold text-white mb-1">X Account CA Checker & Username History</h2>
        <p className="text-xs font-mono text-white/35">Check if an X account has posted contract addresses and view their previous username changes.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
          <input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ""))}
            onKeyDown={e => e.key === "Enter" && check()}
            placeholder="username"
            className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <button onClick={check} disabled={loading || !username.trim()}
          className="px-4 py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg hover:bg-white transition-colors disabled:opacity-40">
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Search className="w-4 h-4" /></motion.div> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs font-mono text-red-400">{error}</p>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div key={result.username} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Profile */}
            <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <XLogo className="w-5 h-5 text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-white">{result.displayName}</p>
                  {result.verified && <Zap className="w-3.5 h-3.5 text-yellow-400" />}
                </div>
                <p className="text-xs font-mono text-white/35">@{result.username}</p>
                {result.bio && <p className="text-xs font-mono text-white/25 mt-1 line-clamp-2">{result.bio}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-bold text-white">{fmtNum(result.followers)}</p>
                <p className="text-[10px] font-mono text-white/30">followers</p>
              </div>
            </div>

            {/* Username History */}
            {result.usernameHistory && (
              <div className="rounded-xl border border-secondary/20 bg-secondary/[0.03] overflow-hidden">
                <div className="px-4 py-3 border-b border-secondary/15 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">Username History</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                      <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Current Username</p>
                      <p className="text-xs font-mono text-white font-bold">@{result.usernameHistory.currentUsername}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                      <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Archive Snapshots</p>
                      <p className="text-xs font-mono text-white font-bold">
                        {result.usernameHistory.snapshotCount > 0 ? result.usernameHistory.snapshotCount.toLocaleString() : "None found"}
                      </p>
                    </div>
                    {result.usernameHistory.firstSeen && (
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">First Archived</p>
                        <p className="text-xs font-mono text-primary">{result.usernameHistory.firstSeen}</p>
                      </div>
                    )}
                    {result.usernameHistory.lastSeen && (
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                        <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Last Archived</p>
                        <p className="text-xs font-mono text-white/60">{result.usernameHistory.lastSeen}</p>
                      </div>
                    )}
                  </div>
                  {result.usernameHistory.possiblePreviousNames.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Previous Usernames Detected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.usernameHistory.possiblePreviousNames.map(name => (
                          <span key={name} className="text-[9px] font-mono px-2 py-1 rounded border border-secondary/20 text-secondary/80 bg-secondary/5">
                            @{name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] font-mono text-white/25 leading-relaxed pt-1 border-t border-white/5">
                    {result.usernameHistory.note}
                  </p>
                </div>
              </div>
            )}

            {/* CA Count summary */}
            <div className={`p-4 rounded-xl border ${result.caCount > 0 ? "border-primary/30 bg-primary/5" : "border-white/8 bg-white/[0.02]"} flex items-center justify-between`}>
              <div>
                <p className="text-xs font-mono text-white/40 mb-1">Contract Addresses Found</p>
                <p className={`text-2xl font-mono font-bold ${result.caCount > 0 ? "text-primary" : "text-white/30"}`}>{result.caCount}</p>
              </div>
              {result.caCount > 0 && <ChevronRight className="w-5 h-5 text-primary/50" />}
            </div>

            {/* CAs list */}
            {result.contractAddresses.length > 0 ? (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 bg-black/40">
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Posted Contract Addresses</p>
                </div>
                <div className="divide-y divide-white/5">
                  {result.contractAddresses.map((ca, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-primary flex-1 break-all">{ca.address}</p>
                        <CopyButton text={ca.address} />
                        {ca.tweetId && (
                          <a href={`https://twitter.com/${result.username}/status/${ca.tweetId}`} target="_blank" rel="noopener noreferrer"
                            className="text-white/30 hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {ca.postedAt && (
                        <p className="text-[10px] font-mono text-white/25 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {ca.postedAt}
                        </p>
                      )}
                      {ca.tweetText && (
                        <p className="text-[10px] font-mono text-white/30 line-clamp-2 leading-relaxed">{ca.tweetText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs font-mono text-white/25">No contract addresses found in recent tweets.</p>
                <p className="text-[10px] font-mono text-white/15 mt-1">Only recent/public tweets are scanned via the free mirror.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Smart Followers ──────────────────────────────────────────────────────────

function SmartFollowers() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartFollowersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!username.trim()) return;
    setLoading(true); setError(null); setResult(null);
    // Simulate loading then show COMING SOON message
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setError("COMING SOON! X API integration coming in next update.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-mono font-bold text-white mb-1">Smart Follower Detector</h2>
        <p className="text-xs font-mono text-white/35">Check if an X account has known alpha traders following them.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
          <input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ""))}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="username"
            className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <button onClick={analyze} disabled={loading || !username.trim()}
          className="px-4 py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg hover:bg-white transition-colors disabled:opacity-40">
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Users className="w-4 h-4" /></motion.div> : <Users className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs font-mono text-red-400">{error}</p>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div key={result.username} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Profile header */}
            <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-mono font-bold text-white">{result.displayName || result.username}</p>
                  <p className="text-xs font-mono text-white/35">@{result.username}</p>
                </div>
                <ScoreRing score={result.smartScore} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "FOLLOWERS", value: fmtNum(result.followers) },
                  { label: "FOLLOWING", value: fmtNum(result.following) },
                  { label: "RATIO", value: result.ratio + "x" },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-lg bg-black/40 text-center">
                    <p className="text-[9px] font-mono text-white/25 uppercase mb-1">{s.label}</p>
                    <p className="text-sm font-mono font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart follower count */}
            <div className="p-4 rounded-xl border border-purple-500/25 bg-purple-500/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-white/40 mb-1">Estimated Smart Followers</p>
                <p className="text-2xl font-mono font-bold text-purple-400">{fmtNum(result.totalEstimated)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-mono font-bold text-purple-400">{result.smartScore}/100</span>
              </div>
            </div>

            {/* API key notice */}
            {result.requiresApiKey && (
              <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 flex gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400/70 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-mono text-yellow-400/70 leading-relaxed">{result.note}</p>
                  <p className="text-[10px] font-mono text-white/25 mt-1">Needed: <span className="text-yellow-400/50">Twitter API v2 Bearer Token</span></p>
                </div>
              </div>
            )}

            {/* Known smart accounts */}
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 bg-black/40 flex items-center justify-between">
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Known Alpha Accounts</p>
                <span className="text-[10px] font-mono text-white/20">DEMO MODE</span>
              </div>
              <div className="divide-y divide-white/5">
                {result.smartFollowers.map(sf => (
                  <div key={sf.username} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-mono text-purple-400 font-bold">{sf.displayName.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white font-bold">{sf.displayName}</p>
                      <p className="text-[10px] font-mono text-white/30">@{sf.username}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-[10px] font-mono text-white/40">{fmtNum(sf.followers)} followers</p>
                      <div className="flex gap-1">
                        {sf.tags.slice(0,2).map(t => (
                          <span key={t} className="text-[8px] font-mono text-purple-400/70 border border-purple-500/20 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
                </div>
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

type IntelTab = "wallet" | "xca" | "followers" | "github";

const tabs: Array<{ id: IntelTab; label: string; icon: React.ElementType; shortLabel: string }> = [
  { id: "wallet",    label: "Wallet Analyzer", icon: Wallet, shortLabel: "WALLET" },
  { id: "xca",       label: "X CA Checker",    icon: XLogo,  shortLabel: "CA" },
  { id: "followers", label: "Smart Followers", icon: Users,  shortLabel: "FOLLOW" },
  { id: "github",    label: "GitHub Scanner",  icon: Github, shortLabel: "GITHUB" },
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
        <p className="text-xs font-mono text-white/35">On-chain wallet analysis, X account intel, smart follower detection, and GitHub repo trust scanning.</p>
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
          {tab === "wallet"    && <WalletAnalyzer />}
          {tab === "xca"       && <XCAChecker />}
          {tab === "followers" && <SmartFollowers />}
          {tab === "github"    && <GithubScanner />}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
