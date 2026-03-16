import { useState, useEffect } from "react";
import { useGetFingerprintProfile, useGetRelayNodes, useStartStealthSession } from "@workspace/api-client-react";
import { Shield, RefreshCw, Server, Globe, ExternalLink, XCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function AppSessions() {
  const { data: profile, isLoading: profileLoading, refetch } = useGetFingerprintProfile();
  const { data: nodesData } = useGetRelayNodes();
  const { mutate: startSession, isPending: isStarting, data: activeSession, reset } = useStartStealthSession();

  const [selectedNode, setSelectedNode] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    if (nodesData?.nodes && !selectedNode) {
      const n = nodesData.nodes.find(n => n.status === "online");
      if (n) setSelectedNode(n.id);
    }
  }, [nodesData, selectedNode]);

  function normalize(raw: string) {
    const t = raw.trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : "https://" + t;
  }

  const handleStart = () => {
    setUrlError("");
    const url = normalize(targetUrl);
    if (!url) { setUrlError("Enter a target URL first."); return; }
    try { new URL(url); } catch { setUrlError("Invalid URL — try dexscreener.com"); return; }
    setTargetUrl(url);
    if (profile) startSession({ data: { fingerprintProfileId: profile.profileId, relayNodeId: selectedNode || undefined } });
  };

  const handleTerminate = () => { reset(); setTargetUrl(""); setUrlError(""); };

  const selectedNodeData = nodesData?.nodes.find(n => n.id === selectedNode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Stealth Session</h1>
        <p className="text-xs font-mono text-white/35">Enter a target, select a relay node, then initiate.</p>
      </div>

      {/* Target URL */}
      <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
          <Globe className="w-3.5 h-3.5" /> Target Destination
        </label>
        <input
          type="text"
          value={targetUrl}
          onChange={e => { setTargetUrl(e.target.value); setUrlError(""); }}
          placeholder="e.g. app.uniswap.org or dexscreener.com"
          disabled={!!activeSession}
          className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 disabled:opacity-40 transition-colors"
        />
        {urlError && <p className="text-xs font-mono text-red-400">{urlError}</p>}
      </div>

      {/* Fingerprint */}
      <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" /> Spoofed Fingerprint
          </label>
          <button onClick={() => refetch()} disabled={profileLoading || !!activeSession}
            className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 hover:text-primary transition-colors disabled:opacity-30 border border-white/8 hover:border-primary/30 px-2.5 py-1.5 rounded">
            <RefreshCw className={`w-3 h-3 ${profileLoading ? "animate-spin" : ""}`} />
            RANDOMIZE
          </button>
        </div>
        {profile ? (
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {[
              ["Platform", profile.platform],
              ["Resolution", profile.screenResolution],
              ["Timezone", profile.timezone],
              ["Canvas", profile.canvasHash.slice(0,12) + "…"],
              ["Audio", profile.audioHash.slice(0,12) + "…"],
              ["WebGL", profile.webglRenderer.slice(0,20) + "…"],
            ].map(([k,v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-white/25 shrink-0 w-16">{k}:</span>
                <span className="text-white/60 truncate">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-white/20 animate-pulse">Generating fingerprint...</p>
        )}
      </div>

      {/* Relay Node Selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
          <Server className="w-3.5 h-3.5" /> Relay Node
        </label>
        <div className="relative">
          <select value={selectedNode} onChange={e => setSelectedNode(e.target.value)} disabled={!!activeSession}
            className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer disabled:opacity-40 transition-colors">
            <option value="">Direct Connection (No Relay)</option>
            {nodesData?.nodes.map(n => (
              <option key={n.id} value={n.id} disabled={n.status !== "online"}>
                {n.name} — {n.city}, {n.country} · {n.latencyMs}ms [{n.status.toUpperCase()}]
              </option>
            ))}
          </select>
          <Server className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
        </div>
        {selectedNodeData && (
          <div className="flex gap-4 text-[10px] font-mono text-white/25 px-1">
            <span>Uptime: <span className="text-primary">{selectedNodeData.uptime}%</span></span>
            <span>Load: <span className={selectedNodeData.load > 70 ? "text-yellow-400" : "text-primary"}>{selectedNodeData.load}%</span></span>
            {selectedNodeData.audited && <span className="text-purple-400">✓ Audited</span>}
            {selectedNodeData.noLogs && <span className="text-purple-400">✓ No-Logs</span>}
          </div>
        )}
      </div>

      {/* Action */}
      <AnimatePresence mode="wait">
        {!activeSession ? (
          <motion.button key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleStart} disabled={isStarting || !profile}
            className="w-full py-4 bg-primary text-black font-mono font-bold text-sm rounded-lg hover:bg-white transition-all disabled:opacity-50 tracking-widest flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 30px rgba(57,255,20,0.2)" }}>
            {isStarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isStarting ? "INITIALIZING..." : "INITIATE STEALTH"}
          </motion.button>
        ) : (
          <motion.div key="session" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/40 overflow-hidden" style={{ boxShadow: "0 0 20px rgba(57,255,20,0.08)" }}>
            <div className="bg-primary px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-black font-mono font-bold text-xs tracking-widest">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                SESSION ACTIVE
              </div>
              <span className="text-black font-mono text-[10px]">{activeSession.sessionId.slice(0,12)}…</span>
            </div>
            <div className="p-5 space-y-5 bg-[#050505]">
              <div className="p-4 rounded-lg border border-white/8 bg-black/40 space-y-3">
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Target</p>
                <p className="text-xs font-mono text-white break-all">{targetUrl}</p>
                <button onClick={() => window.open(targetUrl, "_blank", "noopener,noreferrer")}
                  className="w-full py-3 bg-primary text-black font-mono font-bold text-xs rounded flex items-center justify-center gap-2 hover:bg-white transition-colors tracking-widest">
                  <ExternalLink className="w-4 h-4" />
                  LAUNCH TARGET SITE
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div><p className="text-white/25 mb-1">MASKED IP</p><p className="text-white">{activeSession.maskedIp}</p></div>
                <div><p className="text-white/25 mb-1">RELAY NODE</p><p className="text-white truncate">{selectedNodeData?.name || "Direct"}</p></div>
                <div><p className="text-white/25 mb-1">STARTED</p><p className="text-white">{format(new Date(activeSession.startedAt), "HH:mm:ss")}</p></div>
                <div><p className="text-white/25 mb-1">EXPIRES</p><p className="text-primary">{format(new Date(activeSession.expiresAt), "HH:mm:ss")}</p></div>
              </div>
              <button onClick={handleTerminate}
                className="w-full py-3 border border-red-500/30 text-red-400 font-mono text-xs rounded flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors tracking-widest">
                <XCircle className="w-4 h-4" />
                TERMINATE SESSION
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
