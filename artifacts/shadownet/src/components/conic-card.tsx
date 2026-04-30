/**
 * ConicCard — animated conic-gradient border card.
 *
 * The border is a rotating conic gradient masked into a 1px ring around
 * the card. On hover, the rotation accelerates, the body lifts, and a
 * soft glow blooms from the cursor position (magnetic spotlight).
 *
 * Pure CSS for the rotation; one mousemove handler for the spotlight.
 * Cheap on the GPU.
 */
import { type ReactNode, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  className?: string;
  tone?: "primary" | "accent";
}

export function ConicCard({ children, className = "", tone = "primary" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50, active: false });

  const ring = tone === "accent"
    ? "conic-gradient(from var(--ang), rgba(111,175,155,0) 0deg, rgba(111,175,155,0.9) 30deg, rgba(47,111,94,0.4) 90deg, transparent 180deg, rgba(111,175,155,0.5) 270deg, transparent 320deg)"
    : "conic-gradient(from var(--ang), rgba(62,124,106,0) 0deg, rgba(111,175,155,0.7) 30deg, rgba(62,124,106,0.4) 110deg, transparent 200deg, rgba(62,124,106,0.6) 290deg, transparent 340deg)";

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, active: true });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setPos((p) => ({ ...p, active: true }))}
      onMouseLeave={() => setPos((p) => ({ ...p, active: false }))}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className={`group relative isolate rounded-2xl ${className}`}
      style={{
        // Custom property used by the conic gradient + animated by CSS.
        // @ts-expect-error — CSS custom property
        "--ang": "0deg",
      }}
    >
      {/* Animated conic ring */}
      <div
        aria-hidden="true"
        className="conic-ring absolute -inset-px rounded-2xl pointer-events-none"
        style={{ background: ring, opacity: 0.55 }}
      />
      {/* Inner panel (masks the ring to a 1px hairline) */}
      <div className="relative rounded-2xl bg-card/95 backdrop-blur-sm overflow-hidden">
        {/* Magnetic spotlight on hover */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: pos.active ? 0.9 : 0,
            background: `radial-gradient(220px circle at ${pos.x}% ${pos.y}%, rgba(111,175,155,0.18), transparent 60%)`,
          }}
        />
        {/* Soft inner top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {children}
      </div>
    </motion.div>
  );
}
