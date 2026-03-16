import { useState, useEffect } from "react";
import { useGetFingerprintProfile, useGetRelayNodes, useStartStealthSession } from "@workspace/api-client-react";
import { TerminalBlock, TerminalLine } from "@/components/terminal-block";
import { Shield, RefreshCw, Server, AlertTriangle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function SessionsPage() {
  const { data: profile, isLoading: isProfileLoading, refetch: randomizeProfile } = useGetFingerprintProfile();
  const { data: nodesData } = useGetRelayNodes();
  const { mutate: startSession, isPending: isStarting, data: activeSession } = useStartStealthSession();

  const [selectedNode, setSelectedNode] = useState<string>("");

  // Select first online node by default
  useEffect(() => {
    if (nodesData?.nodes && !selectedNode) {
      const onlineNode = nodesData.nodes.find(n => n.status === "online");
      if (onlineNode) setSelectedNode(onlineNode.id);
    }
  }, [nodesData, selectedNode]);

  const handleStart = () => {
    if (profile) {
      startSession({
        data: {
          fingerprintProfileId: profile.profileId,
          relayNodeId: selectedNode || undefined
        }
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="border-b border-primary/20 pb-6 mb-8">
        <h1 className="text-3xl font-display text-white flex items-center gap-3">
          <Shield className="text-primary w-8 h-8" />
          STEALTH SESSIONS
        </h1>
        <p className="text-muted-foreground font-mono mt-2">
          Isolate browsing data. Randomize canvas hash. Cloak IP address.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Fingerprint & Settings */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display text-primary flex items-center gap-2">
              <Zap className="w-5 h-5" />
              SPOOFED FINGERPRINT
            </h2>
            <button 
              onClick={() => randomizeProfile()}
              disabled={isProfileLoading || isStarting}
              className="text-xs font-mono flex items-center gap-2 px-3 py-1.5 border border-primary/30 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isProfileLoading ? "animate-spin" : ""}`} />
              RANDOMIZE
            </button>
          </div>

          <TerminalBlock title="fingerprint_config.json" className="h-[360px]">
            {isProfileLoading ? (
              <TerminalLine delay={0} className="text-primary animate-pulse">
                Generating cryptographic fingerprint configuration...
              </TerminalLine>
            ) : profile ? (
              <div className="space-y-1 py-2">
                <TerminalLine delay={0.1}><span className="text-secondary">"profileId"</span>: "{profile.profileId}"</TerminalLine>
                <TerminalLine delay={0.2}><span className="text-secondary">"userAgent"</span>: "{profile.userAgent}"</TerminalLine>
                <TerminalLine delay={0.3}><span className="text-secondary">"resolution"</span>: "{profile.screenResolution}"</TerminalLine>
                <TerminalLine delay={0.4}><span className="text-secondary">"colorDepth"</span>: {profile.colorDepth}</TerminalLine>
                <TerminalLine delay={0.5}><span className="text-secondary">"timezone"</span>: "{profile.timezone}"</TerminalLine>
                <TerminalLine delay={0.6}><span className="text-secondary">"platform"</span>: "{profile.platform}"</TerminalLine>
                <TerminalLine delay={0.7}><span className="text-secondary">"webglRenderer"</span>: "{profile.webglRenderer}"</TerminalLine>
                <TerminalLine delay={0.8}><span className="text-secondary">"canvasHash"</span>: "<span className="text-primary">{profile.canvasHash}</span>"</TerminalLine>
                <TerminalLine delay={0.9}><span className="text-secondary">"audioHash"</span>: "<span className="text-primary">{profile.audioHash}</span>"</TerminalLine>
              </div>
            ) : (
              <TerminalLine className="text-destructive">Failed to fetch profile.</TerminalLine>
            )}
          </TerminalBlock>

          <div className="space-y-3 pt-4">
            <label className="text-sm font-mono text-muted-foreground uppercase tracking-wider block">
              Route Through Relay Node:
            </label>
            <div className="relative">
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-full bg-card border border-primary/30 rounded-md py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="">Direct Connection (No Relay)</option>
                {nodesData?.nodes.map(node => (
                  <option key={node.id} value={node.id} disabled={node.status !== "online"}>
                    {node.name} ({node.country}) - {node.latencyMs}ms [{node.status.toUpperCase()}]
                  </option>
                ))}
              </select>
              <Server className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Column: Action & Status */}
        <div className="space-y-6 flex flex-col justify-center">
          
          <AnimatePresence mode="wait">
            {!activeSession ? (
              <motion.div 
                key="start-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center p-12 border border-dashed border-primary/20 rounded-xl bg-card/50"
              >
                <AlertTriangle className="w-12 h-12 text-primary/50 mb-6" />
                <button
                  onClick={handleStart}
                  disabled={isStarting || !profile}
                  className="group relative px-8 py-5 bg-primary text-black font-display font-bold text-xl tracking-widest rounded hover:bg-white hover:text-black transition-all shadow-[0_0_30px_rgba(57,255,20,0.3)] hover:shadow-[0_0_50px_rgba(57,255,20,0.6)] disabled:opacity-50 w-full max-w-sm"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isStarting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Shield className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    )}
                    {isStarting ? "INITIALIZING..." : "LAUNCH SECURE SESSION"}
                  </span>
                </button>
                <p className="mt-6 text-center text-xs text-muted-foreground font-mono max-w-xs leading-relaxed">
                  Launching a session will spawn an isolated browser context with the configured fingerprint.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="active-session"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-primary rounded-xl overflow-hidden box-glow"
              >
                <div className="bg-primary text-black p-4 font-display font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-black rounded-full animate-pulse" />
                    SESSION ACTIVE
                  </span>
                  <span className="font-mono text-sm">{activeSession.sessionId.substring(0, 8)}...</span>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Masked IP</p>
                      <p className="text-lg text-white font-mono">{activeSession.maskedIp || "127.0.0.1"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Relay Node</p>
                      <p className="text-lg text-white font-mono">{activeSession.relayNodeId || "None"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Started</p>
                      <p className="text-sm text-white font-mono">{format(new Date(activeSession.startedAt), "HH:mm:ss 'UTC'")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Expires</p>
                      <p className="text-sm text-primary font-mono">{format(new Date(activeSession.expiresAt), "HH:mm:ss 'UTC'")}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border">
                    <button 
                      onClick={() => window.location.reload()} 
                      className="w-full py-3 border border-destructive text-destructive font-mono hover:bg-destructive/10 transition-colors rounded text-sm tracking-widest"
                    >
                      TERMINATE SESSION
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
      </div>
    </div>
  );
}
