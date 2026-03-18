import { useState, useEffect } from "react";
import { useGetFingerprintProfile, useGetRelayNodes, useStartStealthSession } from "@workspace/api-client-react";
import { Shield, RefreshCw, Server, Globe, XCircle, Zap, CheckCircle, Clock, Wifi, Eye } from "lucide-react";
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
  const [stealthUrl, setStealthUrl] = useState("");

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

    // Track session count
    try { localStorage.setItem("sn_sessions", String((parseInt(localStorage.getItem("sn_sessions") ?? "0", 10)) + 1)); } catch {}

    if (profile) {
      startSession({ data: { fingerprintProfileId: profile.profileId, relayNodeId: selectedNode || undefined } });
    }

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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Stealth Session</h1>
        <p className="text-xs font-mono text-white/35">Your IP never touches the destination — all traffic routes via our relay node.</p>
      </div>

      <div className="space-y-4">
            {/* ── SECTION 1: GEO-RELAY (real US proxy) ── */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
              <div className="px-4 pt-4 pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-primary uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Geo-Relay
                  </p>
                  <span className="text-[8px] font-mono bg-primary/15 text-primary px-2 py-0.5 rounded-full">US SERVER · IP CLOAKED</span>
                </div>
                <p className="text-[9px] font-mono text-white/30">Geo-blocked sites — traffic routes through our US server. Your real IP never reaches the destination.</p>
              </div>
              {/* URL bar */}
              <div className="px-4 pb-3 flex gap-2">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={e => { setTargetUrl(e.target.value); setUrlError(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && targetUrl.trim()) { const u = normalize(targetUrl); if (u) window.open(`${BASE}api/proxy?url=${encodeURIComponent(u)}`, "_blank", "noopener,noreferrer"); }}}
                  placeholder="any geo-blocked site…"
                  className="flex-1 bg-black border border-primary/20 rounded-lg py-2.5 px-3 text-white font-mono text-xs placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => { const u = normalize(targetUrl); if (!u) { setUrlError("Enter a URL"); return; } window.open(`${BASE}api/proxy?url=${encodeURIComponent(u)}`, "_blank", "noopener,noreferrer"); }}
                  disabled={!targetUrl.trim()}
                  className="px-4 py-2.5 bg-primary text-black font-mono font-bold text-[10px] rounded-lg hover:bg-white transition-colors disabled:opacity-40 tracking-wider whitespace-nowrap"
                  style={{ boxShadow: "0 0 10px rgba(57,255,20,0.3)" }}
                >RELAY →</button>
              </div>
              {urlError && <p className="px-4 pb-2 text-xs font-mono text-red-400">{urlError}</p>}
              <p className="px-4 pb-4 text-[8px] font-mono text-white/20 uppercase tracking-widest">Access 18+ &amp; region locked sites via relay</p>
            </div>

            {/* ── SECTION 2: STEALTH BROWSE (direct + fingerprint masking) ── */}
            <div className="rounded-xl border border-secondary/25 bg-secondary/5 overflow-hidden">
              <div className="px-4 pt-4 pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-secondary uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Stealth Browse
                  </p>
                  <span className="text-[8px] font-mono bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">FINGERPRINT MASKED</span>
                </div>
                <p className="text-[9px] font-mono text-white/30">Standard sites — browser identity &amp; fingerprint spoofed. Opens with stealth session active.</p>
              </div>
              {/* Stealth status pills */}
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {["Canvas blocked","WebGL spoofed","AudioCtx masked","Font hash randomised","UA normalised"].map(p => (
                  <span key={p} className="text-[7px] font-mono px-2 py-0.5 rounded-full border border-secondary/20 text-secondary/60">{p}</span>
                ))}
              </div>
              {/* URL bar */}
              <div className="px-4 pb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="enter any site url…"
                  onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { const u = v.startsWith("http") ? v : "https://" + v; setStealthUrl(u); (e.target as HTMLInputElement).value = ""; } } }}
                  className="flex-1 bg-black border border-secondary/20 rounded-lg py-2.5 px-3 text-white font-mono text-xs placeholder:text-white/20 focus:outline-none focus:border-secondary/50 transition-colors"
                />
                <button
                  onClick={e => { const inp = (e.currentTarget.previousElementSibling as HTMLInputElement); const v = inp?.value.trim(); if (v) { const u = v.startsWith("http") ? v : "https://" + v; setStealthUrl(u); inp.value = ""; } }}
                  className="px-4 py-2.5 bg-secondary text-white font-mono font-bold text-[10px] rounded-lg hover:bg-secondary/80 transition-colors tracking-wider whitespace-nowrap"
                  style={{ boxShadow: "0 0 10px rgba(139,92,246,0.3)" }}
                >OPEN →</button>
              </div>
              {stealthUrl && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-mono text-secondary/60">
                    <span>Browsing with fingerprint spoofing</span>
                    <button onClick={() => setStealthUrl("")} className="text-secondary/40 hover:text-secondary">✕ Close</button>
                  </div>
                  <iframe
                    src={`${BASE}api/proxy?url=${encodeURIComponent(stealthUrl)}`}
                    className="w-full bg-black border border-secondary/20 rounded-lg"
                    style={{ height: "60vh" }}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popup-escape allow-presentation"
                    allow="microphone; camera; geolocation"
                  />
                </div>
              )}
            </div>

            {!activeSession && (
              <>
                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/5" />
                  <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Optional: verify relay + get IP proof</p>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                {/* Target URL for verify */}
                <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    <Shield className="w-3.5 h-3.5" /> Relay Verification
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
                <div className="p-5 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    <Server className="w-3.5 h-3.5" /> Relay Node
                  </label>
                  {nodesData?.nodes && nodesData.nodes.length > 0 ? (
                    <div className="space-y-2">
                      {nodesData.nodes.map(node => {
                        const isSelected = selectedNode === node.id;
                        const isOnline = node.status === "online";
                        return (
                          <button
                            key={node.id}
                            onClick={() => isOnline && setSelectedNode(node.id)}
                            disabled={!isOnline}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                              isSelected
                                ? "border-primary/50 bg-primary/5"
                                : isOnline
                                  ? "border-white/8 bg-black hover:border-white/20"
                                  : "border-white/4 bg-black opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-primary" : isOnline ? "bg-green-500" : "bg-red-400"}`} />
                              <div>
                                <p className="text-xs font-mono text-white/80">{node.name} · <span className="text-white/30 text-[10px]">{node.country}</span></p>
                                <div className="flex gap-2 mt-0.5 text-[9px] font-mono text-white/30">
                                  <span>Uptime <span className="text-green-400">{node.uptime}</span></span>
                                  <span>Load <span className="text-white/50">{node.currentLoad}</span></span>
                                  {node.features?.includes("audited") && <span className="text-primary">✓ Audited</span>}
                                  {node.features?.includes("no-logs") && <span className="text-primary">✓ No-Logs</span>}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[8px] font-mono text-primary border border-primary/30 px-1.5 py-0.5 rounded shrink-0">SELECTED</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-white/20 animate-pulse">Loading nodes…</p>
                  )}
                </div>

                {/* Initiate */}
                <button
                  onClick={handleStart}
                  disabled={isStarting || relayLoading || !targetUrl.trim()}
                  className="w-full py-4 font-mono font-bold text-sm tracking-[0.15em] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #39FF14, #2adb00)", color: "#050505", boxShadow: "0 0 24px rgba(57,255,20,0.3)" }}
                >
                  {relayLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      VERIFYING RELAY…
                    </span>
                  ) : isStarting ? "INITIALIZING…" : "INITIATE STEALTH"}
                </button>
              </>
            )}

            {/* Relay result */}
            <AnimatePresence>
              {relayResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-xl border overflow-hidden ${relayResult.ok ? "border-primary/30 bg-primary/5" : "border-red-500/30 bg-red-500/5"}`}
                >
                  {relayResult.ok ? (
                    <div className="p-4 space-y-3">
                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="font-mono font-bold text-sm text-primary tracking-widest">RELAY VERIFIED — IP MASKED</span>
                      </div>

                      {/* Relay IP proof */}
                      <div className="bg-black/40 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {[
                          ["RELAY IP", relayResult.relayIp ?? "—"],
                          ["STATUS", `${relayResult.status} ${relayResult.statusText ?? ""}`],
                          ["LATENCY", relayResult.latencyMs ? `${relayResult.latencyMs}ms` : "—"],
                          ["SERVER", relayResult.server ?? "—"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <p className="text-white/25 mb-0.5">{k}</p>
                            <p className="text-white/80 font-bold truncate">{v}</p>
                          </div>
                        ))}
                      </div>

                      {relayResult.pageTitle && (
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <Globe className="w-3 h-3 text-white/30" />
                          <p className="text-xs font-mono text-white/70 truncate">{relayResult.pageTitle}</p>
                        </div>
                      )}

                      {/* Browse button */}
                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => window.open(`${BASE}api/proxy?url=${encodeURIComponent(relayResult.targetUrl ?? "")}`, "_blank", "noopener,noreferrer")}
                          className="w-full py-3 bg-primary text-black font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-2 hover:bg-white transition-colors tracking-widest"
                          style={{ boxShadow: "0 0 16px rgba(57,255,20,0.2)" }}>
                          <Eye className="w-3.5 h-3.5" />
                          BROWSE VIA RELAY
                        </button>
                      </div>

                      {/* Terminate */}
                      <button onClick={handleTerminate}
                        className="w-full py-2 font-mono text-xs text-white/30 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 border border-white/5 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" /> TERMINATE SESSION
                      </button>
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-xs font-mono text-red-400/80">{relayResult.error}</p>
                      <p className="text-[10px] font-mono text-white/30 mt-2">The relay could not reach the target site. Check the URL and try again.</p>
                      <button onClick={handleTerminate} className="mt-3 text-[10px] font-mono text-white/30 hover:text-white/60 border border-white/8 px-3 py-1.5 rounded">
                        RESET
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Session meta (when active) */}
            {activeSession && (
              <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-1">
                {[
                  { icon: Clock, label: "Started", val: format(new Date(activeSession.startedAt), "HH:mm:ss") },
                  { icon: Wifi, label: "Status", val: activeSession.status },
                  { icon: Globe, label: "Target", val: activeSession.targetUrl?.replace(/^https?:\/\//, "").slice(0, 18) ?? "—" },
                  { icon: Server, label: "Node", val: selectedNodeData?.name?.split(" ")[0] ?? "Shadow Alpha" },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-white/20 shrink-0" />
                    <div>
                      <p className="text-white/25 text-[9px]">{label}</p>
                      <p className="text-white/70 text-[10px]">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
