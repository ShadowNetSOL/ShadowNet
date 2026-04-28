import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { Shield, Key, Network, Radar, ChevronRight, Check, X, Github } from "lucide-react";

const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

/* ─── Particle Grid Background ─── */
function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const dots: { x: number; y: number; opacity: number; speed: number }[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const spacing = 40;
    for (let x = 0; x < canvas.width; x += spacing) {
      for (let y = 0; y < canvas.height; y += spacing) {
        dots.push({ x, y, opacity: Math.random() * 0.5 + 0.05, speed: Math.random() * 0.01 + 0.003 });
      }
    }
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.5;
      dots.forEach(d => {
        const flicker = Math.sin(t * d.speed * 60 + d.x + d.y) * 0.5 + 0.5;
        const alpha = d.opacity * flicker;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(57,255,20,${alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Animated Network Nodes ─── */
function NodeVisualization() {
  const nodes = [
    { cx: "50%", cy: "50%", r: 10, glow: true },
    { cx: "20%", cy: "30%", r: 6, glow: false },
    { cx: "80%", cy: "25%", r: 6, glow: false },
    { cx: "15%", cy: "70%", r: 6, glow: false },
    { cx: "82%", cy: "68%", r: 6, glow: false },
    { cx: "50%", cy: "15%", r: 5, glow: false },
    { cx: "50%", cy: "85%", r: 5, glow: false },
  ];
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,5],[2,5],[3,6],[4,6]];
  return (
    <svg viewBox="0 0 400 320" className="w-full h-full opacity-80">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {edges.map(([a,b], i) => {
        const na = nodes[a], nb = nodes[b];
        const ax = parseFloat(na.cx) / 100 * 400, ay = parseFloat(na.cy) / 100 * 320;
        const bx = parseFloat(nb.cx) / 100 * 400, by = parseFloat(nb.cy) / 100 * 320;
        return (
          <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
            stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.25"
            strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-8" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
          </line>
        );
      })}
      {nodes.map((n, i) => {
        const cx = parseFloat(n.cx) / 100 * 400, cy = parseFloat(n.cy) / 100 * 320;
        return (
          <g key={i}>
            {n.glow && <circle cx={cx} cy={cy} r={n.r * 3} fill="#39FF14" fillOpacity="0.06" filter="url(#glow2)">
              <animate attributeName="r" values={`${n.r*2.5};${n.r*4};${n.r*2.5}`} dur="2s" repeatCount="indefinite"/>
            </circle>}
            <circle cx={cx} cy={cy} r={n.r} fill={n.glow ? "#39FF14" : "transparent"} stroke="#39FF14"
              strokeWidth={n.glow ? "0" : "1"} strokeOpacity={n.glow ? "1" : "0.5"} filter={n.glow ? "url(#glow)" : undefined}>
              {n.glow && <animate attributeName="r" values={`${n.r};${n.r*1.3};${n.r}`} dur="2s" repeatCount="indefinite"/>}
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Section Fade-in wrapper ─── */
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Section label ─── */
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-primary uppercase mb-4">
      <span className="w-4 h-px bg-primary" />
      {children}
      <span className="w-4 h-px bg-primary" />
    </div>
  );
}

const capabilities = [
  {
    icon: Shield,
    title: "Stealth Sessions",
    desc: "Every session gets a freshly generated fingerprint — spoofed canvas, WebGL, audio, fonts, timezone, and user-agent. IP cloaked through a relay node. Zero cross-session data leakage.",
    tags: ["Fingerprint Randomization", "IP Cloaking", "Session Isolation"],
    color: "primary",
  },
  {
    icon: Key,
    title: "Anonymous Wallets",
    desc: "Ed25519 keypairs derived from BIP-39 mnemonics. Base58-encoded private keys importable directly into Phantom. Never stored, never logged. Generated in-memory and discarded.",
    tags: ["Ed25519 Keypairs", "BIP-39 Mnemonic", "Phantom Compatible"],
    color: "primary",
  },
  {
    icon: Network,
    title: "Relay Network",
    desc: "A curated registry of independently audited relay nodes across 12+ countries. Each node verified for no-logging compliance, security hardening, and uptime. Select by latency or jurisdiction.",
    tags: ["Audited Nodes", "No-Log Verified", "Global Coverage"],
    color: "primary",
  },
  {
    icon: Radar,
    title: "Intel Hub",
    desc: "On-chain intelligence suite for Solana. Analyze any wallet's full PnL history, scan X accounts for contract address calls, and identify smart-money followers — all without leaving ShadowNet.",
    tags: ["Wallet Analyzer", "X CA Checker", "Smart Followers"],
    color: "secondary",
  },
];

const architecturePillars = [
  { title: "Zero Retention", body: "No session data, wallet keys, or connection logs are persisted anywhere. Every record is ephemeral by design." },
  { title: "Session Isolation", body: "Each stealth session runs in a sandboxed context. Cookies, cache, and local storage never carry over between sessions." },
  { title: "Independent Audits", body: "Every relay node in the ShadowNet registry undergoes third-party security audits for logging policies and network isolation." },
  { title: "Client-Side Keys", body: "Wallet keypairs are generated server-side and transmitted once over TLS. ShadowNet holds no copy after the response is delivered." },
];

const comparisonRows = [
  { feature: "Fingerprint Randomization", shadownet: true, vpn: false, browser: false },
  { feature: "IP Cloaking via Relay", shadownet: true, vpn: true, browser: false },
  { feature: "Session Isolation", shadownet: true, vpn: false, browser: false },
  { feature: "Anonymous Wallet Generation", shadownet: true, vpn: false, browser: false },
  { feature: "No Server-Side Data Retention", shadownet: true, vpn: false, browser: false },
  { feature: "Audited Infrastructure", shadownet: true, vpn: false, browser: false },
  { feature: "Web3 / dApp Optimized", shadownet: true, vpn: false, browser: false },
  { feature: "On-Chain Intel Hub", shadownet: true, vpn: false, browser: false },
];

export default function Landing() {
  const [activeTab, setActiveTab] = useState<"sessions"|"wallet"|"relay">("sessions");

  return (
    <div className="bg-[#050505] text-white min-h-screen overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-white/5 bg-[#050505]/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-black" />
          </div>
          <span className="font-mono font-bold tracking-widest text-primary text-sm">SHADOWNET</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/docs">
            <span className="text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer tracking-wider hidden sm:block">DOCS</span>
          </Link>
          <Link href="/app/dashboard">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black text-xs font-mono font-bold rounded hover:bg-white transition-colors cursor-pointer tracking-wider">
              LAUNCH APP <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
          <a
            href="https://x.com/shadownetsol?s=21"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ShadowNet on X"
            className="text-white/50 hover:text-white transition-colors"
          >
            <XLogo className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/ShadowNetSOL/ShadowNet"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ShadowNet on GitHub"
            className="text-white/50 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
        <ParticleGrid />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/20 to-[#050505] pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono tracking-widest mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              SYSTEM ONLINE &bull; CORE CONNECTED
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-7xl md:text-8xl font-mono font-bold leading-[0.95] tracking-tight mb-8">
            ENTER THE<br />
            <span className="text-primary" style={{ textShadow: "0 0 40px rgba(57,255,20,0.4)" }}>SHADOW.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
            className="text-base sm:text-lg text-white/50 font-mono max-w-2xl mx-auto mb-12 leading-relaxed">
            A privacy-first Web3 access layer. Fingerprint-randomized stealth sessions, anonymous Solana wallet generation, and a global network of audited relay nodes — all with zero data retention.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app/dashboard">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-black font-mono font-bold rounded hover:bg-white transition-all cursor-pointer text-sm tracking-widest"
                style={{ boxShadow: "0 0 40px rgba(57,255,20,0.3)" }}>
                LAUNCH APP <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/docs">
              <span className="inline-flex items-center gap-2 px-8 py-4 border border-white/15 text-white/70 hover:border-primary/40 hover:text-white font-mono rounded transition-all cursor-pointer text-sm tracking-widest">
                VIEW DOCS
              </span>
            </Link>
          </motion.div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs font-mono text-white/20 tracking-widest">SCROLL</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ── CORE CAPABILITIES ── */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
          <FadeIn>
            <SectionLabel>Core Capabilities</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-mono font-bold leading-tight mb-6">
              Four layers.<br />
              <span className="text-primary">One stack.</span>
            </h2>
            <p className="text-white/45 font-mono text-sm leading-relaxed max-w-md">
              ShadowNet operates across four independent modules that compound on each other: stealth sessions, anonymous wallets, a global relay network, and on-chain intelligence. Every layer closes a distinct tracking vector that conventional tools leave open.
            </p>
          </FadeIn>
          <FadeIn delay={0.2} className="h-72">
            <NodeVisualization />
          </FadeIn>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map((c, i) => {
            const isSecondary = c.color === "secondary";
            return (
              <FadeIn key={c.title} delay={i * 0.1}>
                <div className={`group h-full p-8 rounded-xl border bg-white/[0.02] transition-all duration-300 cursor-default ${
                  isSecondary
                    ? "border-white/8 hover:border-secondary/30 hover:bg-secondary/[0.03]"
                    : "border-white/8 hover:border-primary/30 hover:bg-primary/[0.03]"
                }`}>
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-6 transition-colors ${
                    isSecondary
                      ? "bg-secondary/10 border-secondary/20 group-hover:bg-secondary/20"
                      : "bg-primary/10 border-primary/20 group-hover:bg-primary/20"
                  }`}>
                    <c.icon className={`w-5 h-5 ${isSecondary ? "text-secondary" : "text-primary"}`} />
                  </div>
                  <h3 className="text-lg font-mono font-bold text-white mb-3">{c.title}</h3>
                  <p className="text-white/40 font-mono text-sm leading-relaxed mb-6">{c.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.tags.map(tag => (
                      <span key={tag} className={`px-2 py-1 rounded text-[10px] font-mono border ${
                        isSecondary
                          ? "text-secondary/70 border-secondary/15 bg-secondary/5"
                          : "text-primary/70 border-primary/15 bg-primary/5"
                      }`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ── THE PRODUCT ── */}
      <section className="py-32 px-6 md:px-12 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <SectionLabel>The Product</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-mono font-bold">
              Built for the<br /><span className="text-primary">anonymous web.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden" style={{ boxShadow: "0 0 80px rgba(57,255,20,0.04)" }}>
              {/* Fake app TopBar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-black/40">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-sm bg-primary flex items-center justify-center">
                    <Shield className="w-3 h-3 text-black" />
                  </div>
                  <span className="text-xs font-mono font-bold text-primary tracking-widest">SHADOWNET</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    SECURE
                  </span>
                </div>
              </div>
              {/* Tab switcher */}
              <div className="flex border-b border-white/8">
                {(["sessions","wallet","relay"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-xs font-mono tracking-widest transition-colors ${activeTab === tab ? "text-primary border-b-2 border-primary bg-primary/5" : "text-white/30 hover:text-white/60"}`}>
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Tab content preview */}
              <div className="p-6 md:p-10 min-h-[320px]">
                {activeTab === "sessions" && (
                  <motion.div key="sessions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-xs font-mono text-white/30 uppercase tracking-widest">Target Destination</p>
                      <div className="flex gap-2">
                        <div className="flex-1 h-10 rounded border border-white/10 bg-white/5 flex items-center px-4">
                          <span className="text-xs font-mono text-white/25">e.g. app.uniswap.org</span>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">Relay Node</p>
                      <div className="h-10 rounded border border-white/10 bg-white/5 flex items-center px-4 gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-mono text-white/50">Shadow Alpha — Zurich, Switzerland · 12ms</span>
                      </div>
                      <div className="mt-6 h-12 rounded bg-primary flex items-center justify-center gap-2 cursor-pointer">
                        <Shield className="w-4 h-4 text-black" />
                        <span className="text-xs font-mono font-bold text-black tracking-widest">INITIATE STEALTH</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-black/40 p-4 font-mono text-xs space-y-2">
                      <p className="text-white/30">&gt; <span className="text-primary">fingerprint_config.json</span></p>
                      {[["userAgent","Mozilla/5.0 (Macintosh...)"],["resolution","3840x2160"],["timezone","Europe/Berlin"],["canvasHash","a3f8e21c4b7d"],["audioHash","8f2a9c3d1e5b"]].map(([k,v]) => (
                        <p key={k}><span className="text-purple-400">"{k}"</span>: "<span className="text-white/70">{v}</span>"</p>
                      ))}
                    </div>
                  </motion.div>
                )}
                {activeTab === "wallet" && (
                  <motion.div key="wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-mono font-bold text-white mb-1">ZERO RETENTION POLICY</p>
                        <p className="text-xs font-mono text-white/40">Keys generated in volatile memory. Never stored.</p>
                      </div>
                      <div className="shrink-0 h-10 px-6 rounded bg-purple-500 flex items-center cursor-pointer">
                        <span className="text-xs font-mono font-bold text-white tracking-widest">GENERATE</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[["Public Key", "9yCAKVTugKqsMem4vQKZxRbpkQ7rHjQFGa8m..."],["Private Key", "••••••••••••••••••••••••••"],["Mnemonic", "••••• ••••• ••••• ••••• ••••• •••••"]].map(([l,v]) => (
                        <div key={l} className="space-y-1">
                          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{l}</p>
                          <div className="h-10 rounded border border-white/10 bg-black/40 flex items-center px-4">
                            <span className="text-xs font-mono text-white/50 truncate">{v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {activeTab === "relay" && (
                  <motion.div key="relay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    {[
                      { name: "Shadow Alpha", loc: "Zurich, Switzerland", ms: "12ms", load: 23, status: "online" },
                      { name: "Phantom Node", loc: "Amsterdam, Netherlands", ms: "18ms", load: 41, status: "online" },
                      { name: "Ghost Relay", loc: "Reykjavik, Iceland", ms: "31ms", load: 17, status: "online" },
                      { name: "Cipher Hub", loc: "Bucharest, Romania", ms: "24ms", load: 58, status: "online" },
                    ].map(n => (
                      <div key={n.name} className="flex items-center gap-4 p-3 rounded-lg border border-white/6 hover:border-white/12 transition-colors cursor-default">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                        <span className="flex-1 text-xs font-mono text-white/80">{n.name}</span>
                        <span className="text-xs font-mono text-white/35 hidden sm:block">{n.loc}</span>
                        <span className="text-xs font-mono text-primary px-2 py-0.5 rounded bg-primary/10">{n.ms}</span>
                        <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden hidden md:block">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${n.load}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-white/30 border border-white/10 px-2 py-1 rounded cursor-pointer hover:border-primary/30 hover:text-white/60">ROUTE</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── ARCHITECTURE & SECURITY ── */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <FadeIn>
            <SectionLabel>Architecture &amp; Security</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-mono font-bold leading-tight mb-6">
              Engineered for<br /><span className="text-primary">verifiable privacy.</span>
            </h2>
            <p className="text-white/40 font-mono text-sm leading-relaxed mb-10 max-w-md">
              Every component of the ShadowNet stack is designed around the principle of zero data retention. Nothing that could identify you is written to disk at any layer.
            </p>
            <div className="space-y-5">
              {architecturePillars.map((p, i) => (
                <FadeIn key={p.title} delay={i * 0.08}>
                  <div className="flex gap-5 p-5 rounded-xl border border-white/7 bg-white/[0.02] hover:border-primary/20 transition-colors">
                    <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-mono font-bold text-primary">{String(i+1).padStart(2,"0")}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white mb-1">{p.title}</h3>
                      <p className="text-xs font-mono text-white/40 leading-relaxed">{p.body}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.2} className="hidden md:block">
            <div className="relative rounded-2xl border border-white/8 bg-[#0a0a0a] p-8 overflow-hidden h-[480px] flex items-center justify-center">
              <div className="absolute inset-0 opacity-20"><ParticleGrid /></div>
              <div className="relative z-10 space-y-5 w-full">
                {[
                  { label: "Fingerprint Layer", value: "RANDOMIZED", color: "text-primary" },
                  { label: "Transport Layer", value: "RELAY ROUTED", color: "text-primary" },
                  { label: "Session Layer", value: "ISOLATED", color: "text-primary" },
                  { label: "Key Layer", value: "EPHEMERAL", color: "text-purple-400" },
                  { label: "Log Layer", value: "NONE", color: "text-primary" },
                ].map((row, i) => (
                  <div key={row.label} className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-white/25 w-32 shrink-0 uppercase tracking-wider">{row.label}</span>
                    <div className="flex-1 h-px bg-white/8 relative">
                      <motion.div className="absolute left-0 top-0 h-px bg-primary"
                        initial={{ width: 0 }} whileInView={{ width: "100%" }}
                        transition={{ duration: 1, delay: i * 0.15, ease: "easeOut" }} viewport={{ once: true }} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${row.color} w-24 text-right`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── VERIFIABLE PRIVACY WITHOUT IDENTITY ── */}
      <section className="py-32 px-6 md:px-12 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <SectionLabel>Verifiable Privacy Without Identity</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-mono font-bold leading-tight">
              Not just a VPN.<br />
              <span className="text-primary">The entire stack.</span>
            </h2>
            <p className="text-white/40 font-mono text-sm max-w-xl mx-auto mt-6 leading-relaxed">
              A VPN hides your IP. ShadowNet hides everything — your device, your session, your keys, and your identity across every layer of the stack.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-4 border-b border-white/8 bg-black/40">
                <div className="p-4 col-span-1" />
                <div className="p-4 text-center font-mono text-xs font-bold text-primary tracking-widest border-l border-white/8">
                  SHADOWNET
                </div>
                <div className="p-4 text-center font-mono text-xs text-white/30 tracking-widest border-l border-white/8">
                  STANDARD VPN
                </div>
                <div className="p-4 text-center font-mono text-xs text-white/30 tracking-widest border-l border-white/8">
                  REGULAR BROWSER
                </div>
              </div>
              {comparisonRows.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-4 border-b border-white/5 ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}`}>
                  <div className="p-4 font-mono text-xs text-white/50">{row.feature}</div>
                  <div className="p-4 flex justify-center border-l border-white/8">
                    {row.shadownet ? <Check className="w-4 h-4 text-primary" /> : <X className="w-4 h-4 text-white/20" />}
                  </div>
                  <div className="p-4 flex justify-center border-l border-white/8">
                    {row.vpn ? <Check className="w-4 h-4 text-white/30" /> : <X className="w-4 h-4 text-white/15" />}
                  </div>
                  <div className="p-4 flex justify-center border-l border-white/8">
                    {row.browser ? <Check className="w-4 h-4 text-white/30" /> : <X className="w-4 h-4 text-white/15" />}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-48 px-6 text-center overflow-hidden">
        <div className="absolute inset-0"><ParticleGrid /></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-6xl md:text-8xl font-mono font-bold leading-[0.9] mb-8">
              ENTER THE<br />
              <span className="text-primary" style={{ textShadow: "0 0 60px rgba(57,255,20,0.5)" }}>SHADOW.</span>
            </h2>
            <p className="text-white/40 font-mono text-sm mb-12 max-w-md mx-auto leading-relaxed">
              Your fingerprint. Your IP. Your identity. All of it, gone. This is what anonymous access to Web3 looks like.
            </p>
            <Link href="/app/dashboard">
              <span className="inline-flex items-center gap-3 px-10 py-5 bg-primary text-black font-mono font-bold text-sm rounded hover:bg-white transition-all cursor-pointer tracking-widest"
                style={{ boxShadow: "0 0 60px rgba(57,255,20,0.4)" }}>
                LAUNCH APP <ChevronRight className="w-5 h-5" />
              </span>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative border-t border-white/5 px-6 md:px-12 py-12 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-white/25">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-sm bg-primary flex items-center justify-center">
                <Shield className="w-3 h-3 text-black" />
              </div>
              <span className="text-white/50 font-bold tracking-widest">SHADOWNET</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>© 2026 ShadowNet. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="/docs"><span className="hover:text-white transition-colors cursor-pointer">Privacy</span></Link>
            <Link href="/docs"><span className="hover:text-white transition-colors cursor-pointer">Terms</span></Link>
            <Link href="/docs"><span className="hover:text-white transition-colors cursor-pointer">Security</span></Link>
            <a href="https://x.com/shadownetsol?s=21" target="_blank" rel="noopener noreferrer" aria-label="ShadowNet on X" className="hover:text-white transition-colors">
              <XLogo className="w-4 h-4" />
            </a>
            <a href="https://github.com/ShadowNetSOL/ShadowNet" target="_blank" rel="noopener noreferrer" aria-label="ShadowNet on GitHub" className="hover:text-white transition-colors">
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
