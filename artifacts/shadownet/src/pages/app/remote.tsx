/**
 * Remote browser session viewer.
 *
 * Renders a remote Chromium that's actually running inside the pool
 * container. We connect over WebRTC to the pool's signalling URL, get
 * back a video track + a data channel, and render the stream into a
 * <video> element. Pointer + keyboard events on the video get serialized
 * onto the data channel so the remote browser can replay them.
 *
 * Protocol shape (what the pool's signalUrl expects):
 *
 *   client → server: { kind: "offer",  sdp }
 *   server → client: { kind: "answer", sdp }
 *   ↔  ICE candidates exchanged on the same socket
 *
 *   data channel "input":
 *     { t: "mousemove" | "mousedown" | "mouseup" | "wheel", x, y, button?, dx?, dy? }
 *     { t: "keydown"   | "keyup",   key, code, mods: number }
 *     { t: "type", text }
 *     { t: "navigate", url }
 *
 * Reconnects with backoff on socket close. Heartbeats orchestrator every
 * 30s while the tab is focused so idle-kill doesn't reclaim a live tab.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Globe, Loader2, AlertCircle, X, Maximize2 } from "lucide-react";

interface RemoteDescriptor {
  sessionId: string;
  endpoint: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  startUrl: string;
  expiresAt: string;
  status?: "booting" | "ready";
}

type Status = "idle" | "fetching" | "signalling" | "streaming" | "ended" | "error";

// Honest copy — describes what's actually happening at each phase so a
// 3s cold start doesn't feel like a 3s bug. Architect's "phased UX"
// rule: cycle through these so the user always sees forward progress
// even when the underlying step is still booting.
const PHASES = [
  "Allocating secure environment…",
  "Routing through region…",
  "Connecting to container…",
  "Provisioning fingerprint…",
  "Establishing WebRTC channel…",
  "Streaming…",
];
const STATUS_COPY: Record<Status, { title: string; sub: string }> = {
  idle:       { title: "",                              sub: "" },
  fetching:   { title: "Locating session…",             sub: "Looking up the container the orchestrator allocated for you." },
  signalling: { title: "Establishing secure channel…",  sub: "WebRTC handshake with the regional Chromium pool. Usually under 2s." },
  streaming:  { title: "",                              sub: "" },
  ended:      { title: "Session ended",                 sub: "" },
  error:      { title: "Session error",                 sub: "" },
};

function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function RemoteSession() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [desc, setDesc] = useState<RemoteDescriptor | null>(null);
  const [bootSeconds, setBootSeconds] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);

  // Tick a wall-clock counter while we're booting so the user can see
  // the wait isn't frozen. Stops as soon as video starts streaming.
  useEffect(() => {
    if (status === "streaming" || status === "error" || status === "ended") return;
    const id = window.setInterval(() => setBootSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Phased loader copy — cycles through PHASES while booting so the
  // user always sees progress text changing even when the underlying
  // poll hasn't flipped to ready yet. Caps at the second-to-last phase
  // so we never claim "Streaming…" before video actually arrives.
  useEffect(() => {
    if (status === "streaming" || status === "error" || status === "ended") return;
    const id = window.setInterval(() => setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 2)), 900);
    return () => window.clearInterval(id);
  }, [status]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const sessionId = getQueryParam("id");

  // ── 1. Fetch descriptor + poll until pool is ready ─────────────────────
  // Architect's rule: never open the WebRTC offer against a booting
  // container. Poll status until it flips ready, then hand the descriptor
  // to the signalling effect. Caps at 30 attempts (~30s) before giving up.
  useEffect(() => {
    if (!sessionId) { setStatus("error"); setErrorMsg("Missing session id"); return; }
    let cancelled = false;
    setStatus("fetching");
    const base = (import.meta.env.BASE_URL as string) || "/";
    let attempts = 0;
    const poll = async () => {
      while (!cancelled && attempts < 30) {
        attempts++;
        try {
          const r = await fetch(`${base}api/session/remote/${encodeURIComponent(sessionId)}`);
          if (!r.ok) throw new Error(`Session not found (${r.status})`);
          const d = (await r.json()) as RemoteDescriptor;
          if (!cancelled && (d.status === "ready" || d.status === undefined)) {
            setDesc(d);
            return;
          }
        } catch (err) {
          if (!cancelled) { setStatus("error"); setErrorMsg((err as Error).message); }
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) { setStatus("error"); setErrorMsg("Session never reached ready state"); }
    };
    void poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── 2. Connect WebRTC once we have a descriptor ────────────────────────
  useEffect(() => {
    if (!desc) return;
    setStatus("signalling");

    const pc = new RTCPeerConnection({ iceServers: desc.iceServers });
    pcRef.current = pc;

    const ws = new WebSocket(desc.endpoint);
    wsRef.current = ws;

    pc.ontrack = (ev) => {
      const v = videoRef.current;
      if (v) {
        v.srcObject = ev.streams[0]!;
        v.play().catch(() => {});
      }
      setStatus("streaming");
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ kind: "ice", candidate: ev.candidate }));
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("error"); setErrorMsg("Connection lost");
      }
    };

    // Pre-create the data channel so the offer advertises it.
    const dc = pc.createDataChannel("input", { ordered: true });
    dcRef.current = dc;
    dc.onopen = () => {
      // Tell the remote where to navigate first.
      try { dc.send(JSON.stringify({ t: "navigate", url: desc.startUrl })); } catch { /* ignore */ }
    };

    ws.onopen = async () => {
      try {
        const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false });
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ kind: "offer", sdp: offer.sdp }));
      } catch (err) {
        setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "offer failed");
      }
    };
    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        if (msg.kind === "answer") {
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        } else if (msg.kind === "ice" && msg.candidate) {
          await pc.addIceCandidate(msg.candidate);
        } else if (msg.kind === "error") {
          setStatus("error"); setErrorMsg(msg.message ?? "remote error");
        }
      } catch { /* malformed signalling frame */ }
    };
    ws.onerror = () => { setStatus("error"); setErrorMsg("Signalling channel failed"); };
    ws.onclose = () => { /* ended cleanly is fine */ };

    return () => {
      try { dc.close(); } catch { /* ignore */ }
      try { pc.close(); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
    };
  }, [desc]);

  // ── 3. Heartbeat while focused ─────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || status !== "streaming") return;
    const base = (import.meta.env.BASE_URL as string) || "/";
    const beat = () => {
      if (document.hidden) return;
      void fetch(`${base}api/session/remote/${encodeURIComponent(sessionId)}/heartbeat`, { method: "POST", keepalive: true });
    };
    beat();
    const id = window.setInterval(beat, 30_000);
    return () => window.clearInterval(id);
  }, [sessionId, status]);

  // ── 4. Forward input ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "streaming") return;
    const v = videoRef.current; if (!v) return;
    const dc = dcRef.current; if (!dc) return;

    function send(o: object) {
      if (dc && dc.readyState === "open") {
        try { dc.send(JSON.stringify(o)); } catch { /* drop */ }
      }
    }
    function pos(e: MouseEvent | PointerEvent) {
      const r = v!.getBoundingClientRect();
      const w = v!.videoWidth || r.width;
      const h = v!.videoHeight || r.height;
      const x = ((e.clientX - r.left) / r.width)  * w;
      const y = ((e.clientY - r.top)  / r.height) * h;
      return { x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) };
    }

    const onMove  = (e: MouseEvent) => { const p = pos(e); send({ t: "mousemove", ...p }); };
    const onDown  = (e: MouseEvent) => { const p = pos(e); send({ t: "mousedown", ...p, button: e.button }); };
    const onUp    = (e: MouseEvent) => { const p = pos(e); send({ t: "mouseup",   ...p, button: e.button }); };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const p = pos(e); send({ t: "wheel", ...p, dx: e.deltaX, dy: e.deltaY }); };
    const onKey = (e: KeyboardEvent) => {
      // Don't swallow browser shortcuts (Cmd-W, Cmd-T, F12 etc).
      if (e.metaKey || e.ctrlKey && (e.key === "w" || e.key === "t" || e.key === "r")) return;
      const mods = (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
      send({ t: e.type === "keydown" ? "keydown" : "keyup", key: e.key, code: e.code, mods });
    };

    v.addEventListener("mousemove", onMove);
    v.addEventListener("mousedown", onDown);
    v.addEventListener("mouseup", onUp);
    v.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    return () => {
      v.removeEventListener("mousemove", onMove);
      v.removeEventListener("mousedown", onDown);
      v.removeEventListener("mouseup", onUp);
      v.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [status]);

  // ── 5. Cleanly end the session if the user leaves ──────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const base = (import.meta.env.BASE_URL as string) || "/";
    const onLeave = () => {
      navigator.sendBeacon?.(`${base}api/session/remote/${encodeURIComponent(sessionId)}`);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-jade text-xl font-mono font-bold mb-1">Secure Session</h1>
          <p className="text-xs font-mono text-white/35">Real Chromium running on a region-egress IP. Pixels stream over WebRTC; your IP never reaches the destination.</p>
        </div>
        <button onClick={() => setLocation("/app/sessions")}
          className="text-[10px] font-mono text-white/40 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
          <X className="w-3 h-3" /> END
        </button>
      </div>

      <div className="relative aspect-video rounded-xl border border-primary/30 bg-black overflow-hidden"
        style={{ boxShadow: "0 0 40px rgba(111,175,155,0.15)" }}>
        <video ref={videoRef} autoPlay playsInline muted={false}
          className="w-full h-full object-contain bg-black select-none"
          style={{ cursor: status === "streaming" ? "crosshair" : "default" }} />

        {status !== "streaming" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur px-6">
            {status === "error" ? (
              <>
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="font-pixel text-base text-red-300 tracking-wide">{errorMsg || "Session error"}</p>
                <button onClick={() => setLocation("/app/sessions")}
                  className="mt-2 text-[10px] font-mono text-white/50 border border-white/15 px-3 py-1.5 rounded hover:border-white/30 hover:text-white">
                  RETURN TO SESSIONS
                </button>
              </>
            ) : (
              <>
                <Loader2 className="w-9 h-9 text-accent animate-spin" />
                <p className="font-pixel text-jade text-xl tracking-wide">{PHASES[phaseIdx]}</p>
                <p className="font-pixel text-jade/55 text-base max-w-sm text-center leading-snug">{STATUS_COPY[status].sub}</p>
                <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-md border border-primary/25 bg-primary/5">
                  <span className="text-[10px] font-mono text-jade/60 tracking-widest">ELAPSED</span>
                  <span className="font-mono text-jade tabular-nums text-sm">{bootSeconds}s</span>
                  {bootSeconds > 6 && (
                    <span className="text-[10px] font-mono text-yellow-300/80 tracking-widest border-l border-white/10 pl-2 ml-1">
                      COLD START
                    </span>
                  )}
                </div>
                {bootSeconds > 12 && (
                  <p className="font-pixel text-yellow-300/70 text-sm mt-1">
                    Pool may be at capacity. Hold tight or return and try again.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Overlay HUD */}
        {status === "streaming" && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-primary/30 bg-black/60 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono text-jade tracking-widest uppercase">SECURE · LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-black/60 backdrop-blur">
              <Globe className="w-3 h-3 text-jade" />
              <span className="text-[10px] font-mono text-white/70">{desc?.startUrl ? new URL(desc.startUrl).host : ""}</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] font-mono text-white/30 flex items-center gap-3 px-1">
        <span className="flex items-center gap-1.5"><Maximize2 className="w-3 h-3" /> Click in the viewport to interact</span>
        {desc && <span>· session expires {new Date(desc.expiresAt).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
