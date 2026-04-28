import { useState } from "react";
import { useGetRelayNodes, useConnectToRelayNode } from "@workspace/api-client-react";
import { Network, Activity, Globe, ShieldCheck, EyeOff, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function RelayPage() {
  const { data, isLoading } = useGetRelayNodes();
  const { mutate: connectToNode, isPending: isConnecting } = useConnectToRelayNode();
  
  const [search, setSearch] = useState("");
  const [activeConnection, setActiveConnection] = useState<string | null>(null);

  const nodes = data?.nodes || [];
  
  const filteredNodes = nodes.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) || 
    n.country.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = (nodeId: string) => {
    connectToNode({ nodeId }, {
      onSuccess: () => {
        setActiveConnection(nodeId);
        // Would normally trigger a toast here
      }
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="border-b border-accent/20 pb-6 mb-8">
        <h1 className="text-3xl font-display text-white flex items-center gap-3">
          <Network className="text-accent w-8 h-8" />
          RELAY NETWORK
        </h1>
        <p className="text-muted-foreground font-mono mt-2">
          Global decentralized registry of audited, no-log OpenClaw routing nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border border-border p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded text-accent">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">TOTAL NODES</p>
            <p className="text-xl font-display text-white">{data?.totalCount || 0}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">ONLINE NODES</p>
            <p className="text-xl font-display text-white">{data?.onlineCount || 0}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-secondary/10 rounded text-secondary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">AUDIT VERIFIED</p>
            <p className="text-xl font-display text-white">100%</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/40">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search nodes by location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            Displaying {filteredNodes.length} active relays
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="p-4 font-normal text-muted-foreground">NODE_ID</th>
                <th className="p-4 font-normal text-muted-foreground">LOCATION</th>
                <th className="p-4 font-normal text-muted-foreground">LATENCY</th>
                <th className="p-4 font-normal text-muted-foreground">LOAD</th>
                <th className="p-4 font-normal text-muted-foreground">STATUS</th>
                <th className="p-4 font-normal text-muted-foreground">VERIFICATION</th>
                <th className="p-4 font-normal text-muted-foreground text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-accent animate-pulse">
                    Scanning global relay registry...
                  </td>
                </tr>
              ) : filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No matching relay nodes found.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={node.id} 
                    className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${activeConnection === node.id ? 'bg-accent/10' : ''}`}
                  >
                    <td className="p-4 text-white font-bold">{node.name}</td>
                    <td className="p-4 text-muted-foreground">{node.city}, {node.country}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${node.latencyMs < 50 ? 'bg-primary/20 text-primary' : node.latencyMs < 150 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-destructive/20 text-destructive'}`}>
                        {node.latencyMs}ms
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden border border-border">
                        <div 
                          className="h-full bg-accent transition-all" 
                          style={{ width: `${node.load}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">{node.load}% capacity</span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-primary animate-pulse-glow' : 'bg-destructive'}`} />
                        {node.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      {node.audited && (
                        <span title="Audited" className="inline-flex">
                          <ShieldCheck className="w-4 h-4 text-primary" aria-label="Audited" />
                        </span>
                      )}
                      {node.noLogs && (
                        <span title="No Logs Verified" className="inline-flex">
                          <EyeOff className="w-4 h-4 text-secondary" aria-label="No Logs Verified" />
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {activeConnection === node.id ? (
                        <span className="inline-block px-4 py-2 border border-accent text-accent rounded text-xs tracking-wider">
                          CONNECTED
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleConnect(node.id)}
                          disabled={node.status !== 'online' || isConnecting}
                          className="px-4 py-2 bg-background border border-border hover:border-accent hover:text-accent text-white rounded transition-colors text-xs tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ROUTE
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
