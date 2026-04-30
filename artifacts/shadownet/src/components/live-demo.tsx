/**
 * Live demo panel for the marketing landing.
 *
 * Three tabs, all wired to the real APIs the dashboard uses:
 *
 *   Sessions  → /api/session/fingerprint  +  orchestrate() + launchUrl()
 *   Wallet    → real Solana keypair generation in-browser (no server hit)
 *   Relay     → /api/relay/nodes
 *
 * The point: the marketing copy isn't pretending. Type a URL, click
 * Initiate, the proxy actually opens. The fingerprint shown is the one
 * that will be applied. The relay nodes shown are the regions actually
 * available on this deployment.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Globe, RefreshCw, Copy, Eye, EyeOff, Loader2, Network } from "lucide-react";
import { useGetFingerprintProfile, useGetRelayNodes } from "@workspace/api-client-react";
import { launchUrl, persistFingerprint, precheck, orchestrate } from "@/lib/proxy";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useGenerateWallet, type GeneratedWallet } from "@/lib/wallet";

type Tab = "sessions" | "wallet" | "relay";

export function LiveDemo() {
  const [tab, setTab] = useState<Tab>("sessions");

  return (
    <div className="rounded-2xl border border-primary/20 bg-[#0a0c0b] overflow-hidden"
      style={{ boxShadow: "0 0 80px rgba(111,175,155,0.06)" }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-black/40">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="" className="w-5 h-5 rounded-sm object-cover ring-1 ring-primary/40" />
          <span className="text-xs font-mono font-bold text-jade tracking-widest">SHADOWNET<span className="text-white/30">_</span></span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-jade/60">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          LIVE · WIRED TO BACKEND
        </span>
      </div>

      <div className="flex border-b border-white/8">
        {(["sessions","wallet","relay"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[11px] font-mono tracking-[0.25em] transition-colors ${
              tab === t ? "text-jade border-b-2 border-primary bg-primary/5" : "text-white/30 hover:text-white/60"
            }`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 md:p-10 min-h-[360px]">
        {tab === "sessions" && <SessionsDemo />}
        {tab === "wallet"   && <WalletDemo />}
        {tab === "relay"    && <RelayDemo />}
      </div>
    </div>
  );
}

// ── Sessions demo ───────────────────────────────────────────────────────

function SessionsDemo() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: profile, isFetching, refetch } = useGetFingerprintProfile();
  const { data: nodesData } = useGetRelayNodes();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // Persist to the inject-hook localStorage so the proxied tab actually
  // wears the fingerprint shown in this preview.
  useEffect(() => {
    if (!profile) return;
    persistFingerprint({
      userAgent: profile.userAgent,
      platform: profile.platform,
      language: profile.language,
      languages: [profile.language],
      timezone: profile.timezone,
      screenResolution: profile.screenResolution,
      colorDepth: profile.colorDepth,
      webglVendor: profile.webglVendor,
      webglRenderer: profile.webglRenderer,
      canvasNoise: profile.canvasHash,
      audioNoise: profile.audioHash,
    });
  }, [profile]);

  const onLaunch = async () => {
    let target = url.trim();
    if (!target) { toast({ title: "Enter a destination URL" }); return; }
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    try { new URL(target); } catch { toast({ title: "Invalid URL" }); return; }

    setBusy(true);
    try {
      // Real precheck → real orchestrator → real proxy launch.
      let challenge: string | null = null;
      try { const p = await precheck(target); challenge = p.challenge; } catch {}
      const entitlement = (localStorage.getItem("sn_entitlement") as "free" | "holder") || "free";
      const decision = await orchestrate(target, { entitlement, precheck: challenge ? { challenge, confidence: 0.5 } : undefined });

      if (decision.type === "remote" && decision.available) {
        setLocation(`/app/remote?id=${encodeURIComponent(decision.sessionId)}`);
        return;
      }
      const proxied = await launchUrl(target);
      window.open(proxied, "_blank", "noreferrer");
    } catch (err) {
      toast({ title: "Launch failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onlineNode = nodesData?.nodes.find(n => n.status === "online");
  // Build a clean region label — never "Local Relay — —, United States".
  // If city is empty, drop both city + dash. If name is empty, fall back
  // to country only.
  const regionLabel = (() => {
    if (!onlineNode) return "Loading regions…";
    const parts = [onlineNode.city, onlineNode.country].filter((s) => s && s.trim()).join(", ");
    if (onlineNode.name && parts) return `${onlineNode.name} · ${parts}`;
    return onlineNode.name || parts || "Region available";
  })();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-6 md:gap-8">
      <div className="space-y-4">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.25em]">Target Destination</p>
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void onLaunch(); }}
            placeholder="e.g. pump.fun"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 h-11 rounded-lg border border-white/10 bg-black/50 px-4 text-sm font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50" />
        </div>

        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.25em] mt-4">Relay Region</p>
        <div className="h-11 rounded-lg border border-white/10 bg-black/50 flex items-center px-4 gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
          <span className="text-sm font-mono text-jade truncate">{regionLabel}</span>
        </div>

        <button onClick={() => void onLaunch()} disabled={busy || !profile}
          className="w-full mt-6 h-12 rounded-lg bg-primary text-black font-mono font-bold tracking-[0.18em] sm:tracking-[0.25em] text-[11px] sm:text-xs flex items-center justify-center gap-2 hover:bg-accent transition-colors disabled:opacity-50"
          style={{ boxShadow: "0 0 24px rgba(111,175,155,0.3)" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Shield className="w-4 h-4 shrink-0" />}
          <span className="whitespace-nowrap">{busy ? "ROUTING…" : "INITIATE STEALTH"}</span>
        </button>
        <p className="text-[10px] font-mono text-white/25 leading-relaxed">
          Fires real precheck, asks the orchestrator for a routing decision, and opens through the live proxy. No mock.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-black/50 p-4 font-mono text-[11px] space-y-1.5 relative">
        <button onClick={() => void refetch()} disabled={isFetching}
          className="absolute top-3 right-3 text-jade/60 hover:text-jade disabled:opacity-50" title="Re-roll fingerprint">
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
        </button>
        <p className="text-white/30">&gt; <span className="text-jade">fingerprint_config.json</span></p>
        {!profile ? (
          <p className="text-white/40 animate-pulse">Generating coherent fingerprint…</p>
        ) : (
          <>
            <Row k="userAgent"      v={profile.userAgent} />
            <Row k="platform"       v={profile.platform} />
            <Row k="resolution"     v={profile.screenResolution} />
            <Row k="timezone"       v={profile.timezone} />
            <Row k="language"       v={profile.language} />
            <Row k="webglRenderer"  v={profile.webglRenderer} />
            <Row k="canvasHash"     v={profile.canvasHash} />
            <Row k="audioHash"      v={profile.audioHash} />
            <p className="pt-1 text-jade/60 text-[10px]">
              Bound to your session — written to localStorage so the proxy injects the same identity into every page you open.
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  // No truncation — long UA / WebGL renderer strings wrap inside the
  // box on mobile rather than overflow off-screen. break-all because
  // these values often have no spaces (canvas hashes, UA tokens).
  return (
    <p className="break-all leading-snug"><span className="text-accent">"{k}"</span>: <span className="text-white/70">"{v}"</span></p>
  );
}

// ── Wallet demo ─────────────────────────────────────────────────────────

function WalletDemo() {
  const { toast } = useToast();
  const { mutate, data, isPending } = useGenerateWallet();
  const [reveal, setReveal] = useState(false);

  // Hand the same generator the /app/wallet page uses: BIP-39 mnemonic,
  // SLIP-0010 derivation, ed25519 keypair, all client-side. Phantom can
  // import the private key directly.
  function generate() { mutate(); setReveal(false); }
  const wallet: GeneratedWallet | undefined = data;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono font-bold text-jade tracking-widest mb-1">ZERO RETENTION</p>
          <p className="text-[10px] font-mono text-white/45">
            Generated in your browser via @solana/web3.js. Server never sees it. Phantom-importable.
          </p>
        </div>
        <button onClick={generate} disabled={isPending}
          className="shrink-0 h-10 px-6 rounded-lg bg-secondary text-jade font-mono font-bold text-xs tracking-widest hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-2">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isPending ? "GENERATING" : "GENERATE"}
        </button>
      </div>

      <div className="space-y-3">
        <KeyRow label="Public Key"   value={wallet?.publicKey ?? ""}  redact={false} onCopy={() => wallet && copy(wallet.publicKey, "Public key")} />
        <KeyRow label="Private Key"  value={wallet?.privateKey ?? ""} redact={!reveal} onCopy={() => wallet && copy(wallet.privateKey, "Private key")} onToggle={() => setReveal(r => !r)} revealed={reveal} />
        <KeyRow label="Mnemonic"     value={wallet?.mnemonic ?? ""}   redact={!reveal} onCopy={() => wallet && copy(wallet.mnemonic, "Mnemonic")} />
      </div>
      <p className="text-[10px] font-mono text-white/25">
        Refresh the page and the keys are gone forever. ShadowNet doesn't and can't recover them.
      </p>
    </motion.div>
  );
}

function KeyRow({ label, value, redact, onCopy, onToggle, revealed }: {
  label: string; value: string; redact: boolean; onCopy: () => void; onToggle?: () => void; revealed?: boolean;
}) {
  const display = !value ? "—" : redact ? "•".repeat(Math.min(value.length, 44)) : value;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.25em]">{label}</p>
      <div className="h-11 rounded-lg border border-white/10 bg-black/40 flex items-center px-4 gap-2">
        <span className="flex-1 text-[11px] font-mono text-jade truncate">{display}</span>
        {onToggle && (
          <button onClick={onToggle} className="text-white/40 hover:text-jade" title={revealed ? "Hide" : "Reveal"}>
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button onClick={onCopy} disabled={!value} className="text-white/40 hover:text-jade disabled:opacity-30">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Relay demo ──────────────────────────────────────────────────────────

function RelayDemo() {
  const { data, isLoading } = useGetRelayNodes();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {[0,1,2].map(i => (
          <div key={i} className="h-14 rounded-lg border border-white/8 bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.25em]">
          {data.onlineCount} of {data.totalCount} regions online
        </p>
        <span className="text-[10px] font-mono text-jade/60 flex items-center gap-1.5">
          <Network className="w-3 h-3" /> live registry
        </span>
      </div>
      {data.nodes.map((n) => (
        <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/7 hover:border-primary/30 transition-colors">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            n.status === "online" ? "bg-accent animate-pulse" :
            n.status === "maintenance" ? "bg-yellow-400" : "bg-red-500/70"
          }`} />
          <span className="flex-1 text-xs font-mono text-jade truncate">{n.name}</span>
          <span className="text-xs font-mono text-white/35 hidden sm:block">{[n.city, n.country].filter(Boolean).join(", ") || "—"}</span>
          <span className="hidden md:inline-block w-16 h-1 rounded-full bg-white/10 overflow-hidden">
            <span className="block h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, n.load)}%` }} />
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            n.status === "online" ? "text-jade bg-primary/10" : "text-white/40 bg-white/5"
          }`}>
            {n.status === "online" ? "READY" : n.status.toUpperCase()}
          </span>
          <button
            onClick={() => {
              if (n.status !== "online") return;
              localStorage.setItem("sn_preferred_region", n.id);
              toast({ title: `Routing through ${n.name}`, description: "Saved as preferred region for this browser." });
              setLocation("/app/sessions");
            }}
            disabled={n.status !== "online"}
            className="text-[10px] font-mono px-2.5 py-1 rounded border border-white/10 hover:border-primary/40 hover:text-jade disabled:opacity-30 transition-colors">
            <Globe className="w-3 h-3 inline-block mr-1 -mt-0.5" />
            ROUTE
          </button>
        </div>
      ))}
    </motion.div>
  );
}
