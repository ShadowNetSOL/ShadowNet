import { Link } from "wouter";
import { Shield, Key, Network, ChevronRight, Globe, Activity, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import { useGetRelayNodes } from "@workspace/api-client-react";

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
];

export default function Dashboard() {
  const { data } = useGetRelayNodes();

  const stats = [
    { label: "RELAY NODES", value: data ? `${data.onlineCount}/${data.totalCount}` : "—", icon: Globe, note: "online" },
    { label: "AVG LATENCY", value: "21ms", icon: Activity, note: "global" },
    { label: "WALLETS GENERATED", value: "84.2K", icon: Cpu, note: "total" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/5 text-primary text-[10px] font-mono tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            SYSTEM ONLINE
          </div>
          <h1 className="text-2xl font-mono font-bold text-white mb-2">Dashboard</h1>
          <p className="text-sm font-mono text-white/35">Select a module to begin anonymous operations.</p>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="p-4 rounded-xl border border-white/7 bg-white/[0.02]">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">{s.label}</p>
            <p className="text-xl font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-white/25 mt-1">{s.note}</p>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div className="space-y-3">
        {cards.map((card, i) => (
          <motion.div key={card.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
            <Link href={card.href}>
              <span className="group flex items-center gap-5 p-5 rounded-xl border border-white/7 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer block">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.color === "purple" ? "bg-purple-500/10 border border-purple-500/20" : "bg-primary/10 border border-primary/20"}`}>
                  <card.icon className={`w-5 h-5 ${card.color === "purple" ? "text-purple-400" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-bold text-white mb-1">{card.label}</p>
                  <p className="text-xs font-mono text-white/35 leading-relaxed">{card.desc}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-white/25 group-hover:text-primary transition-colors shrink-0">
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
          <span className="text-primary/60">TIP:</span> For maximum anonymity, always select a relay node before initiating a stealth session. Combine with fingerprint randomization for a full three-layer privacy stack.
        </p>
      </div>
    </div>
  );
}
