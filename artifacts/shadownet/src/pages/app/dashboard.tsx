import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Shield, Key, Network, ChevronRight, Globe, Activity, Cpu, Radar, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useGetRelayNodes } from "@workspace/api-client-react";

export function trackStat(key: "sn_sessions" | "sn_wallets" | "sn_tokens") {
  try {
    const current = parseInt(localStorage.getItem(key) ?? "0", 10);
    localStorage.setItem(key, String(current + 1));
  } catch {}
}

export function getStat(key: "sn_sessions" | "sn_wallets" | "sn_tokens"): number {
  try { return parseInt(localStorage.getItem(key) ?? "0", 10); } catch { return 0; }
}

const cards = [
  {
    href: "/app/sessions",
    icon: Shield,
    label: "Stealth Session",
    desc: "Launch a fingerprint-randomized, IP-cloaked browsing session to any destination.",
    cta: "LAUNCH SESSION",
    color: "primary" as const,
  },
  {
    href: "/app/wallet",
    icon: Key,
    label: "Wallet Generator",
    desc: "Generate an anonymous Ed25519 Solana keypair. Phantom-importable, zero retention.",
    cta: "GENERATE KEYS",
    color: "purple" as const,
  },
  {
    href: "/app/relay",
    icon: Network,
    label: "Relay Network",
    desc: "Browse and connect to audited, no-log relay nodes across 12+ countries.",
    cta: "VIEW RELAYS",
    color: "primary" as const,
  },
  {
    href: "/app/intel",
    icon: Radar,
    label: "Intel Hub",
    desc: "Analyze Solana wallets, scan X accounts for CAs, and track smart-money followers.",
    cta: "OPEN INTEL",
    color: "purple" as const,
  },
];

export default function Dashboard() {
  const { data, isLoading, refetch } = useGetRelayNodes();
  const [localStats, setLocalStats] = useState({ sessions: 0, wallets: 0, tokens: 0 });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setLocalStats({
      sessions: getStat("sn_sessions"),
      wallets: getStat("sn_wallets"),
      tokens: getStat("sn_tokens"),
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const onlineNodes = data?.nodes?.filter((n: { status: string }) => n.status === "online") ?? [];
  const avgLatency = onlineNodes.length > 0
    ? Math.round(onlineNodes.reduce((s: number, n: { latencyMs?: number }) => s + (n.latencyMs ?? 0), 0) / onlineNodes.length)
    : null;

  const stats = [
    {
      label: "RELAY NODES",
      value: data ? `${data.onlineCount}/${data.totalCount}` : "—",
      sub: "online / total",
      color: "primary",
      live: true,
    },
    {
      label: "AVG LATENCY",
      value: isLoading ? "—" : avgLatency !== null ? `${avgLatency}ms` : "—",
      sub: "across relay network",
      color: "primary",
      live: true,
    },
    {
      label: "YOUR SESSIONS",
      value: localStats.sessions.toString(),
      sub: "initiated this device",
      color: "secondary",
      live: false,
    },
    {
      label: "WALLETS MADE",
      value: localStats.wallets.toString(),
      sub: "generated this device",
      color: "secondary",
      live: false,
    },
  ];

  const timeStr = now.toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" });

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/5 text-primary text-[10px] font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            SYSTEM ONLINE — {timeStr} UTC
          </div>
          <button onClick={() => { refetch(); setLocalStats({ sessions: getStat("sn_sessions"), wallets: getStat("sn_wallets"), tokens: getStat("sn_tokens") }); }}
            className="flex items-center gap-1.5 text-[10px] font-mono text-white/25 hover:text-white/60 transition-colors">
            <RefreshCw className="w-3 h-3" /> REFRESH
          </button>
        </div>
        <h1 className="text-2xl font-mono font-bold text-white mb-2">Dashboard</h1>
        <p className="text-sm font-mono text-white/35">Select a module to begin anonymous operations.</p>
      </motion.div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`p-4 rounded-xl border ${s.color === "primary" ? "border-primary/15 bg-primary/[0.03]" : "border-secondary/15 bg-secondary/[0.03]"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{s.label}</p>
              {s.live && <span className="text-[7px] font-mono text-primary/60 border border-primary/20 px-1.5 py-0.5 rounded-full">LIVE</span>}
            </div>
            <p className={`text-2xl font-mono font-bold ${s.color === "primary" ? "text-white" : "text-secondary"}`}>{s.value}</p>
            <p className="text-[9px] font-mono text-white/20 mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div className="space-y-3">
        {cards.map((card, i) => (
          <motion.div key={card.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
            <Link href={card.href}>
              <span className={`group flex items-center gap-5 p-5 rounded-xl border border-white/7 bg-white/[0.02] transition-all cursor-pointer block ${
                card.color === "purple" ? "hover:border-secondary/30 hover:bg-secondary/[0.03]" : "hover:border-primary/30 hover:bg-primary/[0.03]"
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.color === "purple" ? "bg-secondary/10 border border-secondary/20" : "bg-primary/10 border border-primary/20"}`}>
                  <card.icon className={`w-5 h-5 ${card.color === "purple" ? "text-secondary" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-bold text-white mb-1">{card.label}</p>
                  <p className="text-xs font-mono text-white/35 leading-relaxed">{card.desc}</p>
                </div>
                <div className={`flex items-center gap-2 text-[10px] font-mono text-white/25 transition-colors shrink-0 ${card.color === "purple" ? "group-hover:text-secondary" : "group-hover:text-primary"}`}>
                  {card.cta} <ChevronRight className="w-3 h-3" />
                </div>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Tip */}
      <div className="p-4 rounded-lg border border-white/5 bg-white/[0.015]">
        <p className="text-[10px] font-mono text-white/25 leading-relaxed">
          <span className="text-primary/60">TIP:</span> For maximum anonymity, always select a relay node before initiating a stealth session. Use Intel Hub to verify contract addresses before buying.
        </p>
      </div>
    </div>
  );
}
