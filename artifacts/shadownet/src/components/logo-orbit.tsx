/**
 * Holographic logo plate.
 *
 * Renders the brand mark inside a stack of orbital rings with rotating
 * tick marks, a soft jade halo, and a corner-bracket frame — the visual
 * vocabulary of HUD plates, not generic glow boxes. Three rings rotate
 * at different speeds in opposite directions; ticks sit on the rings at
 * irregular angles so the rotation reads as motion, not a uniform spin.
 *
 * Pure SVG + CSS keyframes; one image. No canvas, no rAF — composites
 * cheaply on top of heavier backgrounds.
 */
import { useId } from "react";

interface Props {
  src?: string;
  size?: number;
  className?: string;
}

export function LogoOrbit({ src = "/logo.jpg", size = 180, className = "" }: Props) {
  const id = useId();
  const r1 = size * 0.46;
  const r2 = size * 0.54;
  const r3 = size * 0.62;
  const center = size / 2;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(111,175,155,0.35) 0%, rgba(111,175,155,0.08) 50%, transparent 75%)",
          filter: "blur(20px)",
        }}
      />

      {/* Orbital rings */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="absolute inset-0"
      >
        <defs>
          <radialGradient id={`ring-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6FAF9B" stopOpacity="0.0" />
            <stop offset="80%" stopColor="#6FAF9B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3E7C6A" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Ring 1 — fast, clockwise */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: "logo-orbit-cw 22s linear infinite" }}>
          <circle cx={center} cy={center} r={r1} fill="none" stroke="url(#ring-${id})" strokeWidth="1" strokeDasharray="2 6" opacity="0.6" />
          {[0, 72, 144, 216, 288].map((a) => (
            <Tick key={`a-${a}`} cx={center} cy={center} r={r1} angle={a} length={6} />
          ))}
        </g>

        {/* Ring 2 — medium, counter-clockwise */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: "logo-orbit-ccw 38s linear infinite" }}>
          <circle cx={center} cy={center} r={r2} fill="none" stroke="#3E7C6A" strokeWidth="0.6" strokeOpacity="0.5" />
          {[40, 130, 200, 310].map((a) => (
            <Tick key={`b-${a}`} cx={center} cy={center} r={r2} angle={a} length={4} />
          ))}
        </g>

        {/* Ring 3 — slow, clockwise, brighter */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: "logo-orbit-cw 60s linear infinite" }}>
          <circle cx={center} cy={center} r={r3} fill="none" stroke="#6FAF9B" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="1 14" />
          {[15, 95, 175, 255, 335].map((a) => (
            <Tick key={`c-${a}`} cx={center} cy={center} r={r3} angle={a} length={3} bright />
          ))}
        </g>

        {/* Cardinal pulse beacons */}
        {[0, 90, 180, 270].map((a, i) => {
          const x = center + Math.cos((a * Math.PI) / 180) * r3;
          const y = center + Math.sin((a * Math.PI) / 180) * r3;
          return (
            <circle
              key={a}
              cx={x}
              cy={y}
              r="2"
              fill="#6FAF9B"
              style={{ animation: `logo-pulse 2.4s ease-in-out ${i * 0.3}s infinite` }}
            />
          );
        })}
      </svg>

      {/* Corner brackets */}
      <Bracket position="tl" />
      <Bracket position="tr" />
      <Bracket position="bl" />
      <Bracket position="br" />

      {/* The mark itself */}
      <div
        className="absolute rounded-2xl overflow-hidden ring-1 ring-primary/40"
        style={{
          left: size * 0.22,
          top: size * 0.22,
          width: size * 0.56,
          height: size * 0.56,
          boxShadow: "0 0 40px rgba(111,175,155,0.45), inset 0 0 30px rgba(30,77,64,0.6)",
        }}
      >
        <img src={src} alt="ShadowNet" className="w-full h-full object-cover" />
        {/* Holographic scanline */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40"
          style={{
            background:
              "repeating-linear-gradient(180deg, rgba(111,175,155,0) 0, rgba(111,175,155,0) 2px, rgba(111,175,155,0.18) 2px, rgba(111,175,155,0.18) 3px)",
            animation: "logo-scan 6s linear infinite",
          }}
        />
      </div>
    </div>
  );
}

function Tick({ cx, cy, r, angle, length, bright }: { cx: number; cy: number; r: number; angle: number; length: number; bright?: boolean }) {
  const rad = (angle * Math.PI) / 180;
  const x1 = cx + Math.cos(rad) * (r - length);
  const y1 = cy + Math.sin(rad) * (r - length);
  const x2 = cx + Math.cos(rad) * r;
  const y2 = cy + Math.sin(rad) * r;
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={bright ? "#6FAF9B" : "#3E7C6A"}
      strokeWidth={bright ? 1.5 : 1}
      strokeOpacity={bright ? 0.9 : 0.7}
    />
  );
}

function Bracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base: React.CSSProperties = { position: "absolute", width: 16, height: 16, borderColor: "rgba(111,175,155,0.75)" };
  const map: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: "1.5px solid", borderLeft: "1.5px solid" },
    tr: { top: 0, right: 0, borderTop: "1.5px solid", borderRight: "1.5px solid" },
    bl: { bottom: 0, left: 0, borderBottom: "1.5px solid", borderLeft: "1.5px solid" },
    br: { bottom: 0, right: 0, borderBottom: "1.5px solid", borderRight: "1.5px solid" },
  };
  return <div style={{ ...base, ...map[position] }} />;
}
