import { useState, useEffect } from "react";
import { useGetFingerprintProfile, useGetRelayNodes, useStartStealthSession } from "@workspace/api-client-react";
import { TerminalBlock, TerminalLine } from "@/components/terminal-block";
import { Shield, RefreshCw, Server, AlertTriangle, Zap, Globe, ExternalLink, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function SessionsPage() {
  const { data: profile, isLoading: isProfileLoading, refetch: randomizeProfile } = useGetFingerprintProfile();
  const { data: nodesData } = useGetRelayNodes();
  const { mutate: startSession, isPending: isStarting, data: activeSession, reset: resetSession } = useStartStealthSession();

  const [selectedNode, setSelectedNode] = useState<string>("");
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [urlError, setUrlError] = useState<string>("");

  useEffect(() => {
    if (nodesData?.nodes && !selectedNode) {
      const onlineNode = nodesData.nodes.find(n => n.status === "online");
      if (onlineNode) setSelectedNode(onlineNode.id);
    }
  }, [nodesData, selectedNode]);

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
  }

  const handleStart = () => {
    setUrlError("");
    const normalized = normalizeUrl(targetUrl);
    if (!normalized) {
      setUrlError("Enter a target URL to route through the relay.");
      return;
    }
    try {
      new URL(normalized);
    } catch {
      setUrlError("Invalid URL. Try something like: example.com");
      return;
    }
    setTargetUrl(normalized);
    if (profile) {
      startSession({
        data: {
          fingerprintProfileId: profile.profileId,
          relayNodeId: selectedNode || undefined,
        },
      });
    }
  };

  const handleLaunch = () => {
    const url = normalizeUrl(targetUrl);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleTerminate = () => {
    resetSession();
    setTargetUrl("");
    setUrlError("");
  };

  const selectedNodeData = nodesData?.nodes.find(n => n.id === selectedNode);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="border-b border-primary/20 pb-6 mb-8">
        <h1 className="text-3xl font-display text-white flex items-center gap-3">
          <Shield className="text-primary w-8 h-8" />
          STEALTH SESSIONS
        </h1>
        <p className="text-muted-foreground font-mono mt-2">
          Enter your target site, select a relay node, randomize your fingerprint, then initiate.
        </p>
      </div>

      {/* Target URL input — prominent at the top */}
      <div className="bg-card border border-primary/30 rounded-xl p-6 space-y-4">
        <label className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Target Destination
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={targetUrl}
            onChange={e => { setTargetUrl(e.target.value); setUrlError(""); }}
            placeholder="e.g. dexscreener.com or https://app.uniswap.org"
            disabled={!!activeSession}
            className="flex-1 bg-background border border-primary/30 rounded-md py-3 px-4 text-white font-mono text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        {urlError && (
          <p className="text-destructive font-mono text-xs flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" />
            {urlError}
          </p>
        )}
        <p className="text-xs text-muted-foreground font-mono">
          The site you want to access. Your traffic will be routed through the selected relay node with a spoofed fingerprint before reaching this destination.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Fingerprint & Node */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display text-primary flex items-center gap-2">
              <Zap className="w-5 h-5" />
              SPOOFED FINGERPRINT
            </h2>
            <button
              onClick={() => randomizeProfile()}
              disabled={isProfileLoading || isStarting || !!activeSession}
              className="text-xs font-mono flex items-center gap-2 px-3 py-1.5 border border-primary/30 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isProfileLoading ? "animate-spin" : ""}`} />
              RANDOMIZE
            </button>
          </div>

          <TerminalBlock title="fingerprint_config.json" className="h-[300px]">
            {isProfileLoading ? (
              <TerminalLine delay={0} className="text-primary animate-pulse">
                Generating cryptographic fingerprint...
              </TerminalLine>
            ) : profile ? (
              <div className="space-y-1 py-2">
                <TerminalLine delay={0.1}><span className="text-secondary">"userAgent"</span>: "<span className="text-white/70 text-[10px]">{profile.userAgent.slice(0, 42)}...</span>"</TerminalLine>
                <TerminalLine delay={0.2}><span className="text-secondary">"resolution"</span>: "{profile.screenResolution}"</TerminalLine>
                <TerminalLine delay={0.3}><span className="text-secondary">"colorDepth"</span>: {profile.colorDepth}</TerminalLine>
                <TerminalLine delay={0.4}><span className="text-secondary">"timezone"</span>: "{profile.timezone}"</TerminalLine>
                <TerminalLine delay={0.5}><span className="text-secondary">"platform"</span>: "{profile.platform}"</TerminalLine>
                <TerminalLine delay={0.6}><span className="text-secondary">"webglRenderer"</span>: "<span className="text-white/70 text-[10px]">{profile.webglRenderer.slice(0, 40)}...</span>"</TerminalLine>
                <TerminalLine delay={0.7}><span className="text-secondary">"canvasHash"</span>: "<span className="text-primary">{profile.canvasHash}</span>"</TerminalLine>
                <TerminalLine delay={0.8}><span className="text-secondary">"audioHash"</span>: "<span className="text-primary">{profile.audioHash}</span>"</TerminalLine>
              </div>
            ) : (
              <TerminalLine className="text-destructive">Failed to load profile.</TerminalLine>
            )}
          </TerminalBlock>

          <div className="space-y-3">
            <label className="text-sm font-mono text-muted-foreground uppercase tracking-wider block">
              Route Through Relay Node:
            </label>
            <div className="relative">
              <select
                value={selectedNode}
                onChange={e => setSelectedNode(e.target.value)}
                disabled={!!activeSession}
                className="w-full bg-card border border-primary/30 rounded-md py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Direct Connection (No Relay)</option>
                {nodesData?.nodes.map(node => (
                  <option key={node.id} value={node.id} disabled={node.status !== "online"}>
                    {node.name} — {node.city}, {node.country} · {node.latencyMs}ms [{node.status.toUpperCase()}]
                  </option>
                ))}
              </select>
              <Server className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            {selectedNodeData && (
              <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                <span>Uptime: <span className="text-primary">{selectedNodeData.uptime}%</span></span>
                <span>Load: <span className={selectedNodeData.load > 70 ? "text-yellow-400" : "text-primary"}>{selectedNodeData.load}%</span></span>
                {selectedNodeData.audited && <span className="text-secondary">✓ Audited</span>}
                {selectedNodeData.noLogs && <span className="text-secondary">✓ No-logs</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Action & Status */}
        <div className="space-y-6 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {!activeSession ? (
              <motion.div
                key="start-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center p-10 border border-dashed border-primary/20 rounded-xl bg-card/50 space-y-6"
              >
                <Shield className="w-14 h-14 text-primary/30" />
                <div className="w-full space-y-3">
                  <button
                    onClick={handleStart}
                    disabled={isStarting || !profile}
                    className="group relative w-full px-8 py-5 bg-primary text-black font-display font-bold text-xl tracking-widest rounded hover:bg-white hover:text-black transition-all shadow-[0_0_30px_rgba(57,255,20,0.3)] hover:shadow-[0_0_50px_rgba(57,255,20,0.6)] disabled:opacity-50"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {isStarting ? (
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      ) : (
                        <Shield className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      )}
                      {isStarting ? "INITIALIZING..." : "INITIATE STEALTH"}
                    </span>
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground font-mono leading-relaxed max-w-xs">
                  Fingerprint will be randomized, IP cloaked through the selected relay, and an isolated session context will be created before routing you to your target.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="active-session"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-primary rounded-xl overflow-hidden"
                style={{ boxShadow: "0 0 24px rgba(57,255,20,0.15)" }}
              >
                <div className="bg-primary text-black p-4 font-display font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-black rounded-full animate-pulse" />
                    SESSION ACTIVE
                  </span>
                  <span className="font-mono text-sm">{activeSession.sessionId.slice(0, 10)}…</span>
                </div>

                <div className="p-6 space-y-5">
                  {/* Target URL launch */}
                  <div className="bg-background/60 border border-primary/20 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Target Destination</p>
                    <p className="text-sm font-mono text-white break-all">{targetUrl}</p>
                    <button
                      onClick={handleLaunch}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-black font-display font-bold tracking-widest rounded hover:bg-white transition-all shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                    >
                      <ExternalLink className="w-5 h-5" />
                      LAUNCH TARGET SITE
                    </button>
                    <p className="text-[10px] font-mono text-muted-foreground/60 text-center">
                      Opens in a new tab via your active stealth session
                    </p>
                  </div>

                  {/* Session stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Masked IP</p>
                      <p className="text-base text-white font-mono">{activeSession.maskedIp || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Relay Node</p>
                      <p className="text-base text-white font-mono truncate">{selectedNodeData?.name || "Direct"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Started</p>
                      <p className="text-sm text-white font-mono">{format(new Date(activeSession.startedAt), "HH:mm:ss")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1 uppercase">Expires</p>
                      <p className="text-sm text-primary font-mono">{format(new Date(activeSession.expiresAt), "HH:mm:ss")}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={handleTerminate}
                      className="w-full py-3 border border-destructive/60 text-destructive font-mono hover:bg-destructive/10 transition-colors rounded text-sm tracking-widest flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
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
