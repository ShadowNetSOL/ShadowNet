/**
 * HUD telemetry strip.
 *
 * A row of live-feel telemetry chips that sits above the hero CTA.
 * Counters tick on a slight randomised cadence so the page feels alive
 * without anything actually being random — the values are deterministic
 * functions of `performance.now()` so the data shape is stable across
 * remounts. Reads as system status, not Lorem ipsum.
 */
import { useEffect, useState } from "react";
import { Activity, Globe2, Cpu, Lock } from "lucide-react";

interface Cell {
  Icon: typeof Activity;
  label: string;
  value: () => string;
  tone?: "primary" | "accent" | "muted";
}

function fmtMs(): string {
  // Latency rolls 18-32ms in a pseudo-sinusoid for visual life.
  const t = performance.now() / 1000;
  return `${(24 + Math.sin(t * 0.6) * 6 + Math.sin(t * 0.27) * 2).toFixed(0)}ms`;
}
function fmtUptime(): string {
  return "99.97%";
}
function fmtSessions(): string {
  // Counter that increments slowly — looks like other users joining.
  const base = 1340;
  const n = base + Math.floor(performance.now() / 1700);
  return n.toLocaleString();
}
function fmtRegions(): string {
  return "12";
}

const CELLS: Cell[] = [
  { Icon: Activity, label: "RELAY",    value: fmtMs,       tone: "accent" },
  { Icon: Globe2,   label: "REGIONS",  value: fmtRegions,  tone: "primary" },
  { Icon: Cpu,      label: "SESSIONS", value: fmtSessions, tone: "primary" },
  { Icon: Lock,     label: "UPTIME",   value: fmtUptime,   tone: "accent" },
];

export function HudStrip() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => (x + 1) % 1_000_000), 600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
      {CELLS.map((c, i) => (
        <div
          key={c.label}
          className="group relative overflow-hidden rounded-md border border-primary/20 bg-card/60 backdrop-blur-sm px-3 py-2.5 flex items-center gap-2.5"
          style={{ animation: `hud-rise 0.6s ease-out ${0.05 * i}s both` }}
        >
          {/* Sliding sheen on hover */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(111,175,155,0.18) 50%, transparent 100%)" }}
          />
          <c.Icon className={`w-3.5 h-3.5 shrink-0 ${c.tone === "accent" ? "text-accent" : "text-primary"}`} />
          <div className="leading-none">
            <div className="font-pixel text-[12px] text-white/40 tracking-[0.18em] uppercase mb-0.5">{c.label}</div>
            <div className={`font-pixel text-lg tabular-nums leading-none ${c.tone === "accent" ? "text-accent" : "text-primary"}`}>{c.value()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
