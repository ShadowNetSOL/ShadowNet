import { useState } from "react";
import { useGetRelayNodes, useConnectToRelayNode } from "@workspace/api-client-react";
import { Network, Search, ShieldCheck, EyeOff, Globe, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function AppRelay() {
  const { data, isLoading } = useGetRelayNodes();
  const { mutate: connectToNode, isPending: isConnecting } = useConnectToRelayNode();
  const [search, setSearch] = useState("");
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const nodes = data?.nodes || [];
  const filtered = nodes.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Relay Network</h1>
        <p className="text-xs font-mono text-white/35">Audited, no-log routing nodes across 12+ countries.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "TOTAL", value: data?.totalCount ?? "—", icon: Globe },
          { label: "ONLINE", value: data?.onlineCount ?? "—", icon: Activity },
          { label: "AUDITED", value: data ? "100%" : "—", icon: ShieldCheck },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-white/7 bg-white/[0.02] flex items-center gap-3">
            <s.icon className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-white/25 uppercase">{s.label}</p>
              <p className="text-lg font-mono font-bold text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
        <input type="text" placeholder="Search by name or country…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
      </div>

      {/* Nodes list */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs font-mono text-primary/50 animate-pulse text-center py-8">Scanning global relay registry…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs font-mono text-white/20 text-center py-8">No matching nodes found.</p>
        ) : (
          filtered.map((node, i) => (
            <motion.div key={node.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`p-4 rounded-xl border transition-all ${activeNode === node.id ? "border-primary/40 bg-primary/5" : "border-white/7 bg-white/[0.02] hover:border-white/12"}`}>
              <div className="flex items-center gap-4">
                <span className={`w-2 h-2 rounded-full shrink-0 ${node.status === "online" ? "bg-primary animate-pulse" : node.status === "maintenance" ? "bg-yellow-400" : "bg-red-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-mono font-bold text-white">{node.name}</span>
                    {node.audited && <ShieldCheck className="w-3 h-3 text-purple-400" />}
                    {node.noLogs && <EyeOff className="w-3 h-3 text-purple-400" />}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-white/30">
                    <span>{node.city}, {node.country}</span>
                    <span className={`px-1.5 py-0.5 rounded ${node.latencyMs < 50 ? "text-primary bg-primary/10" : node.latencyMs < 150 ? "text-yellow-400 bg-yellow-400/10" : "text-red-400 bg-red-400/10"}`}>
                      {node.latencyMs}ms
                    </span>
                    <span>Load: {node.load}%</span>
                    <span>↑ {node.uptime}%</span>
                  </div>
                </div>
                {node.status === "online" && (
                  activeNode === node.id ? (
                    <span className="text-[10px] font-mono text-primary border border-primary/30 px-3 py-1.5 rounded shrink-0">CONNECTED</span>
                  ) : (
                    <button disabled={isConnecting}
                      onClick={() => connectToNode({ nodeId: node.id }, { onSuccess: () => setActiveNode(node.id) })}
                      className="text-[10px] font-mono text-white/35 border border-white/10 hover:border-primary/30 hover:text-white px-3 py-1.5 rounded transition-colors disabled:opacity-40 shrink-0 tracking-widest">
                      ROUTE
                    </button>
                  )
                )}
                {node.status !== "online" && (
                  <span className={`text-[10px] font-mono px-3 py-1.5 rounded shrink-0 ${node.status === "maintenance" ? "text-yellow-400/50 border border-yellow-400/15" : "text-red-400/50 border border-red-400/15"}`}>
                    {node.status.toUpperCase()}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
