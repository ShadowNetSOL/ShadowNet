/**
 * Stack visualizer.
 *
 * A live diagram of the ShadowNet request path. Concentric rings each
 * represent a layer:
 *
 *   core → SESSION → FINGERPRINT → RELAY → DESTINATION
 *
 * Animated "packets" travel outward (request) and back (response) along
 * paths between layer nodes. Each ring rotates at a different speed,
 * its tick marks act as connection points where packets latch.
 *
 * Hover any ring to highlight that layer + surface its description.
 * Below the diagram, a rolling trace log mimics a network sniffer —
 * deterministic pseudo-data, no real I/O.
 *
 * SVG + framer-motion. No canvas, scales cleanly.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type LayerId = "session" | "fingerprint" | "relay" | "destination";

interface Layer {
  id: LayerId;
  label: string;
  shortLabel: string;
  body: string;
  /** Radius (relative to diagram size). */
  r: number;
  /** Tick count on this ring. */
  ticks: number;
  /** Rotation speed in seconds; positive = clockwise. */
  speed: number;
  tone: "primary" | "accent" | "shadow";
}

const LAYERS: Layer[] = [
  { id: "session",     label: "Session Layer",     shortLabel: "SESSION",     r: 0.20, ticks: 5,  speed: 28, tone: "accent",
    body: "Atomic fingerprint preset locked at session start. UA, platform, WebGL, fonts, locale all internally consistent." },
  { id: "fingerprint", label: "Fingerprint Layer", shortLabel: "FINGERPRINT", r: 0.32, ticks: 8,  speed: -36, tone: "primary",
    body: "Canvas + WebGL + audio noise seeded from session id. Stable identity per session, unique across sessions." },
  { id: "relay",       label: "Relay Layer",       shortLabel: "RELAY",       r: 0.43, ticks: 12, speed: 50, tone: "primary",
    body: "Region-coherent egress. IP, timezone, locale, sec-ch-ua-platform header all align with the chosen geo." },
  { id: "destination", label: "Destination",       shortLabel: "DESTINATION", r: 0.54, ticks: 16, speed: -78, tone: "shadow",
    body: "Anti-bot classifier scores the response: cf_challenge, turnstile, soft_block, js_stall — escalates if confidence > 0.75." },
];

const TONE_HEX = {
  primary: "#3E7C6A",
  accent:  "#6FAF9B",
  shadow:  "#1E4D40",
} as const;

// Trace lines that scroll under the diagram. Stable values so the page
// doesn't churn re-renders, but they cycle on a slow timer so it reads
// as live telemetry.
const TRACES = [
  "› session.start  preset=US_DESKTOP_CHROME_NV  region=us-east  tz=America/New_York",
  "› fingerprint.lock  canvas=#a3f9c1  webgl=NVIDIA RTX 3060  fonts=7",
  "› relay.dial  egress=US-East  rtt=22ms  rotation=session",
  "› proxy.fetch  /service/aHR0cHM6Ly9wdW1wLmZ1bg==  ws=true",
  "› classify.ok  challenge=null  confidence=0.00  recommend=passthrough",
  "› wallet.shim  injected=true  surface=phantom-v2  bridge=wc-pending",
  "› session.tick  age=00:04:21  cookies=1.2KB  storage=ok",
  "› orchestrator.decide  type=proxy  reason=passthrough  region=us-east",
  "› heartbeat.ok  dom_mut=12  net=active  loop=alive",
  "› relay.rotate  next=eu-west  reason=manual",
];

interface Props {
  className?: string;
  size?: number;
}

export function StackVisualizer({ className = "", size = 460 }: Props) {
  const [hover, setHover] = useState<LayerId | null>(null);
  const cx = size / 2;
  const cy = size / 2;

  // Pre-compute layer geometry.
  const layers = useMemo(
    () => LAYERS.map((l) => {
      const radius = l.r * size;
      const tickAngles = Array.from({ length: l.ticks }, (_, i) => (360 / l.ticks) * i);
      const tickPositions = tickAngles.map((a) => {
        const rad = (a * Math.PI) / 180;
        return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius, angle: a };
      });
      return { ...l, radius, tickPositions };
    }),
    [size, cx, cy],
  );

  // Pre-build packet animation paths: a packet hops outward along the
  // four layers (one tick per layer), then echoes back.
  const packetPaths = useMemo(() => buildPacketPaths(layers, cx, cy), [layers, cx, cy]);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" className="block" aria-label="ShadowNet stack">
        <defs>
          <radialGradient id="stack-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#6FAF9B" stopOpacity="1" />
            <stop offset="50%" stopColor="#3E7C6A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1E4D40" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="stack-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6FAF9B" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#6FAF9B" stopOpacity="0" />
          </radialGradient>
          {/* Soft inner shadow for rings */}
          <filter id="stack-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* Layer rings */}
        {layers.map((l) => {
          const isHover = hover === l.id;
          const stroke = TONE_HEX[l.tone];
          return (
            <g key={l.id}
               onMouseEnter={() => setHover(l.id)}
               onMouseLeave={() => setHover(null)}
               style={{ cursor: "pointer" }}>
              {/* Hit area */}
              <circle cx={cx} cy={cy} r={l.radius} fill="none" stroke="transparent" strokeWidth="14" pointerEvents="stroke" />
              {/* Visible ring (rotates) */}
              <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: `stack-rot ${Math.abs(l.speed)}s linear ${l.speed < 0 ? "reverse" : "normal"} infinite` }}>
                <circle cx={cx} cy={cy} r={l.radius} fill="none"
                  stroke={stroke}
                  strokeWidth={isHover ? 1.4 : 0.7}
                  strokeOpacity={isHover ? 0.95 : 0.55}
                  strokeDasharray="2 6" />
                {l.tickPositions.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={isHover ? 2.4 : 1.6}
                    fill={stroke} fillOpacity={isHover ? 1 : 0.75} />
                ))}
              </g>
              {/* Ring label — rendered un-rotated */}
              <text
                x={cx + l.radius * 0.71}
                y={cy - l.radius * 0.71 - 4}
                fill={stroke}
                fillOpacity={isHover ? 1 : 0.6}
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="0.18em"
              >
                {l.shortLabel}
              </text>
            </g>
          );
        })}

        {/* Packet flow paths (request → outward, response → inward). */}
        {packetPaths.map((path, i) => (
          <g key={i}>
            <path d={path.d} fill="none" stroke="#6FAF9B" strokeOpacity="0.18" strokeWidth="0.6" />
            <circle r="2.4" fill="#6FAF9B">
              <animateMotion dur={`${4 + (i % 3) * 1.1}s`} repeatCount="indefinite" path={path.d} begin={`${i * 0.6}s`} />
              <animate attributeName="opacity" values="0;1;1;0" dur={`${4 + (i % 3) * 1.1}s`} repeatCount="indefinite" begin={`${i * 0.6}s`} />
            </circle>
          </g>
        ))}

        {/* Center core */}
        <circle cx={cx} cy={cy} r={size * 0.15} fill="url(#stack-glow)" />
        <circle cx={cx} cy={cy} r={size * 0.085} fill="url(#stack-core)" stroke="#6FAF9B" strokeOpacity="0.7" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={size * 0.04} fill="#0a1614">
          <animate attributeName="r" values={`${size * 0.038};${size * 0.046};${size * 0.038}`} dur="2.6s" repeatCount="indefinite" />
        </circle>
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#6FAF9B" fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="0.3em" opacity="0.9">CORE</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="#6FAF9B" fontFamily="JetBrains Mono, monospace" fontSize={7} letterSpacing="0.2em" opacity="0.6">v0.4</text>

        {/* Outer ticks: cardinal compass marks */}
        {[0, 90, 180, 270].map((a) => {
          const rad = (a * Math.PI) / 180;
          const r1 = size * 0.58;
          const r2 = size * 0.61;
          return (
            <line key={a} x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2}
              stroke="#6FAF9B" strokeOpacity="0.5" strokeWidth="1" />
          );
        })}
      </svg>

      {/* Layer info card — appears on hover */}
      <AnimatePresence>
        {hover && (() => {
          const l = layers.find((x) => x.id === hover)!;
          return (
            <motion.div
              key={hover}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="absolute left-2 right-2 sm:left-auto sm:right-2 sm:max-w-xs bottom-2 rounded-lg border border-primary/30 bg-card/95 backdrop-blur p-3 pointer-events-none"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE_HEX[l.tone] }} />
                <span className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">{l.shortLabel}</span>
              </div>
              <p className="text-[11px] font-mono text-white/70 leading-relaxed">{l.body}</p>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Live trace readout */}
      <TraceReel />
    </div>
  );
}

function buildPacketPaths(layers: Array<Layer & { radius: number; tickPositions: Array<{ x: number; y: number; angle: number }> }>, cx: number, cy: number): Array<{ d: string }> {
  // For each tick of the outermost layer, build a path that walks
  // inward from a tick on each layer down to the core, then back out.
  const out: Array<{ d: string }> = [];
  const outer = layers[layers.length - 1]!;
  const sample = Math.min(8, outer.tickPositions.length);
  for (let i = 0; i < sample; i++) {
    const idx = Math.floor((outer.tickPositions.length / sample) * i);
    const target = outer.tickPositions[idx]!;
    const points: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
    // Pick a tick on each ring along the radial trajectory toward the target.
    for (const l of layers) {
      const ang = Math.atan2(target.y - cy, target.x - cx);
      points.push({ x: cx + Math.cos(ang) * l.radius, y: cy + Math.sin(ang) * l.radius });
    }
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    out.push({ d });
  }
  return out;
}

function TraceReel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((x) => (x + 1) % TRACES.length), 1800);
    return () => window.clearInterval(id);
  }, []);
  // Show 4 lines, with the newest at the bottom and older lines fading up.
  const window4 = Array.from({ length: 4 }, (_, i) => TRACES[(idx + i) % TRACES.length]!);
  return (
    <div className="absolute left-2 top-2 sm:max-w-xs space-y-0.5 pointer-events-none">
      {window4.map((line, i) => (
        <div key={`${idx}-${i}`} className="text-[9px] font-mono text-accent/70 truncate"
          style={{ opacity: 0.25 + i * 0.18 }}>
          {line}
        </div>
      ))}
    </div>
  );
}
