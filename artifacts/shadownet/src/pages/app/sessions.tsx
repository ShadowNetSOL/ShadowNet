import { useState, useEffect } from "react";
import { useGetFingerprintProfile, useGetRelayNodes, useStartStealthSession } from "@workspace/api-client-react";
import { Shield, RefreshCw, Server, Globe, XCircle, Zap, Lock, CheckCircle, Clock, Wifi, ExternalLink, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL as string;

interface RelayResult {
  ok: boolean;
  targetUrl?: string;
  targetHost?: string;
  status?: number;
  statusText?: string;
  latencyMs?: number;
  relayIp?: string;
  server?: string;
  contentType?: string;
  pageTitle?: string;
  redirected?: boolean;
  error?: string;
}

export default function AppSessions() {
  const { data: profile, isLoading: profileLoading, refetch } = useGetFingerprintProfile();
  const { data: nodesData } = useGetRelayNodes();
  const { mutate: startSession, isPending: isStarting, data: activeSession, reset } = useStartStealthSession();

  const [selectedNode, setSelectedNode] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [relayResult, setRelayResult] = useState<RelayResult | null>(null);
  const [relayLoading, setRelayLoading] = useState(false);

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

  const handleStart = async () => {
    setUrlError("");
    setRelayResult(null);
    const url = normalize(targetUrl);
    if (!url) { setUrlError("Enter a target URL first."); return; }
    try { new URL(url); } catch { setUrlError("Invalid URL — try pump.fun"); return; }
    setTargetUrl(url);

    // Start session record
    if (profile) {
      startSession({ data: { fingerprintProfileId: profile.profileId, relayNodeId: selectedNode || undefined } });
    }

    // Run the relay verification
    setRelayLoading(true);
    try {
      const resp = await fetch(`${BASE}api/relay/verify?url=${encodeURIComponent(url)}`);
      const data = await resp.json() as RelayResult;
      setRelayResult(data);
    } catch {
      setRelayResult({ ok: false, error: "Relay could not reach target" });
    } finally {
      setRelayLoading(false);
    }
  };

  const handleTerminate = () => {
    reset();
    setTargetUrl("");
    setUrlError("");
    setRelayResult(null);
  };

  const selectedNodeData = nodesData?.nodes.find(n => n.id === selectedNode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Stealth Session</h1>
        <p className="text-xs font-mono text-white/35">Target is reached from our server — your IP never touches the destination.</p>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-primary/15 bg-primary/5">
        <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/50 leading-relaxed">
          ShadowNet connects to the target <span className="text-primary">server-side</span>. The site sees our relay node's IP, not yours. We verify the connection and return proof below.
        </p>
      </div>

      {!activeSession && (
        <>
          {/* Quick picks */}
          <div className="p-3.5 rounded-lg border border-white/6 bg-white/[0.015]">
            <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">Quick targets</p>
            <div className="flex flex-wrap gap-1.5">
              {["pump.fun","solana.com","jup.ag","raydium.io","birdeye.so","phantom.app"].map(s => (
                <button key={s} onClick={() => { setTargetUrl("https://" + s); setUrlError(""); }}
                  className="text-[9px] font-mono px-2 py-1 rounded border border-white/8 text-white/35 hover:text-primary hover:border-primary/30 transition-colors">
                  {s}
                </button>
              ))}
            </div>
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
              placeholder="e.g. pump.fun or https://jup.ag"
              className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {urlError && <p className="text-xs font-mono text-red-400">{urlError}</p>}
          </div>

          {/* Fingerprint */}
          <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5" /> Spoofed Fingerprint
              </label>
              <button onClick={() => refetch()} disabled={profileLoading}
                className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 hover:text-primary transition-colors border border-white/8 hover:border-primary/30 px-2.5 py-1.5 rounded">
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
                  ["Canvas", profile.canvasHash.slice(0, 12) + "…"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-white/25 shrink-0 w-16">{k}:</span>
                    <span className="text-white/60 truncate">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-white/20 animate-pulse">Generating fingerprint…</p>
            )}
          </div>

          {/* Relay Node */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
              <Server className="w-3.5 h-3.5" /> Relay Node
            </label>
            <div className="relative">
              <select value={selectedNode} onChange={e => setSelectedNode(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer transition-colors">
                <option value="">Direct (no relay)</option>
                {nodesData?.nodes.map(n => (
                  <option key={n.id} value={n.id} disabled={n.status !== "online"}>
                    {n.name} — {n.city}, {n.country} · {n.latencyMs}ms
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

          <button onClick={handleStart} disabled={isStarting || !profile || relayLoading}
            className="w-full py-4 bg-primary text-black font-mono font-bold text-sm rounded-lg hover:bg-white transition-all disabled:opacity-50 tracking-widest flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 30px rgba(57,255,20,0.2)" }}>
            {(isStarting || relayLoading) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {relayLoading ? "CONNECTING RELAY…" : isStarting ? "INITIALIZING…" : "INITIATE STEALTH"}
          </button>
        </>
      )}

      {/* Active session + relay results */}
      <AnimatePresence>
        {activeSession && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/40 overflow-hidden"
            style={{ boxShadow: "0 0 20px rgba(57,255,20,0.08)" }}>

            {/* Header */}
            <div className="bg-primary px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-black font-mono font-bold text-xs tracking-widest">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                SESSION ACTIVE
              </div>
              <span className="text-black font-mono text-[10px]">{activeSession.sessionId.slice(0, 12)}…</span>
            </div>

            <div className="p-5 space-y-4 bg-[#050505]">

              {/* Relay verification result */}
              {relayLoading && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-black/40 border border-white/6">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <p className="text-xs font-mono text-white/40">Relay connecting to target…</p>
                </div>
              )}

              {relayResult && (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={`rounded-lg border overflow-hidden ${relayResult.ok ? "border-primary/30" : "border-red-500/30"}`}>
                    {/* Verification header */}
                    <div className={`px-4 py-2.5 flex items-center gap-2 ${relayResult.ok ? "bg-primary/10" : "bg-red-500/10"}`}>
                      {relayResult.ok
                        ? <CheckCircle className="w-4 h-4 text-primary" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                      <span className={`text-xs font-mono font-bold tracking-widest ${relayResult.ok ? "text-primary" : "text-red-400"}`}>
                        {relayResult.ok ? "RELAY VERIFIED — IP MASKED" : "RELAY FAILED"}
                      </span>
                    </div>

                    {relayResult.ok ? (
                      <div className="p-4 space-y-3">
                        {/* IP proof */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-black/60 border border-white/5">
                            <p className="text-[9px] font-mono text-white/25 uppercase mb-1">Your Real IP</p>
                            <p className="text-xs font-mono text-red-400/80">Hidden ✓</p>
                          </div>
                          <div className="p-3 rounded-lg bg-black/60 border border-primary/20">
                            <p className="text-[9px] font-mono text-white/25 uppercase mb-1">Relay IP Shown</p>
                            <p className="text-xs font-mono text-primary font-bold">{relayResult.relayIp}</p>
                          </div>
                        </div>

                        {/* Target info */}
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                          <div className="p-2.5 rounded bg-black/40 border border-white/5">
                            <p className="text-white/25 mb-1 flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> STATUS</p>
                            <p className={`font-bold ${(relayResult.status ?? 0) < 400 ? "text-primary" : "text-yellow-400"}`}>
                              {relayResult.status} {relayResult.statusText}
                            </p>
                          </div>
                          <div className="p-2.5 rounded bg-black/40 border border-white/5">
                            <p className="text-white/25 mb-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> LATENCY</p>
                            <p className="text-white font-bold">{relayResult.latencyMs}ms</p>
                          </div>
                          <div className="p-2.5 rounded bg-black/40 border border-white/5">
                            <p className="text-white/25 mb-1 flex items-center gap-1"><Server className="w-2.5 h-2.5" /> SERVER</p>
                            <p className="text-white truncate">{relayResult.server}</p>
                          </div>
                        </div>

                        {relayResult.pageTitle && (
                          <div className="px-3 py-2 rounded bg-black/40 border border-white/5">
                            <p className="text-[9px] font-mono text-white/25 uppercase mb-0.5">Page Title</p>
                            <p className="text-xs font-mono text-white/70 truncate">{relayResult.pageTitle}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="space-y-2 pt-1">
                          <button
                            onClick={() => window.open(`${BASE}api/proxy?url=${encodeURIComponent(relayResult.targetUrl ?? "")}`, "_blank", "noopener,noreferrer")}
                            className="w-full py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-colors tracking-widest"
                            style={{ boxShadow: "0 0 16px rgba(57,255,20,0.2)" }}>
                            <Eye className="w-3.5 h-3.5" />
                            BROWSE VIA RELAY
                          </button>
                          <p className="text-[9px] font-mono text-white/20 text-center">
                            All traffic routes through relay · Bypasses geo-blocks
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <p className="text-xs font-mono text-red-400/80">{relayResult.error}</p>
                        <p className="text-[10px] font-mono text-white/30 mt-2">The relay could not reach the target site. Check the URL and try again.</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Session meta */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-1">
                <div><p className="text-white/25 mb-1">RELAY NODE</p><p className="text-white truncate">{selectedNodeData?.name || "Direct"}</p></div>
                <div><p className="text-white/25 mb-1">FINGERPRINT</p><p className="text-white truncate">{profile?.profileId.slice(0, 14)}…</p></div>
                <div><p className="text-white/25 mb-1">STARTED</p><p className="text-white">{format(new Date(activeSession.startedAt), "HH:mm:ss")}</p></div>
                <div><p className="text-white/25 mb-1">EXPIRES</p><p className="text-primary">{format(new Date(activeSession.expiresAt), "HH:mm:ss")}</p></div>
              </div>

              <button onClick={handleTerminate}
                className="w-full py-3 border border-red-500/30 text-red-400 font-mono text-xs rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors tracking-widest">
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
