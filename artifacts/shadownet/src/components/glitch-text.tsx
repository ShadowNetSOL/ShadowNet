/**
 * Glitch decode text.
 *
 * On mount (and on `key` change), each character independently scrambles
 * through random ASCII glyphs before settling on the target letter. The
 * effect reads like a terminal decoding ciphertext — Mr Robot vibe, not
 * generic "matrix rain". Per-char stagger + variable scramble length so
 * it never looks mechanical.
 *
 * Performance: pure React state, one rAF-coupled interval, capped at the
 * length of the input. Idle once the decode finishes (no idle CPU).
 */
import { useEffect, useMemo, useState, type ElementType } from "react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_\\/[]{}—=+*^?#";

interface Props {
  text: string;
  /** Per-character scramble duration in ms (avg). */
  charMs?: number;
  /** Delay before the first character starts settling. */
  staggerMs?: number;
  /** Animation kicker — pass a changing key to retrigger. */
  trigger?: number | string;
  /** Tag — h1/h2/span/etc. */
  as?: ElementType;
  className?: string;
}

interface CharState {
  target: string;
  current: string;
  remaining: number; // scramble ticks left before locking
}

export function GlitchText({ text, charMs = 50, staggerMs = 35, trigger, as = "span", className = "" }: Props) {
  const [chars, setChars] = useState<CharState[]>(() =>
    text.split("").map((c) => ({ target: c, current: c === " " ? " " : pickGlyph(), remaining: 0 })),
  );

  // Re-seed the animation whenever text or trigger changes.
  const seed = useMemo(() => `${text}::${trigger}`, [text, trigger]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const startedAt = performance.now();

    // Each character: starts after its stagger offset, scrambles for a
    // randomised number of ticks (1..N where N grows with index for a
    // left-to-right "decode wave"), then locks.
    const plan = text.split("").map((c, i) => {
      const start = i * staggerMs + Math.random() * staggerMs;
      const scrambleFor = charMs * (3 + Math.floor(Math.random() * (4 + i / 4)));
      return { c, start, end: start + scrambleFor };
    });

    const tick = () => {
      if (!alive) return;
      const t = performance.now() - startedAt;
      const next: CharState[] = plan.map(({ c, start, end }) => {
        if (c === " ") return { target: " ", current: " ", remaining: 0 };
        if (t < start) return { target: c, current: pickGlyph(), remaining: 1 };
        if (t < end)  return { target: c, current: pickGlyph(), remaining: 1 };
        return { target: c, current: c, remaining: 0 };
      });
      setChars(next);
      const allLocked = next.every((s) => s.remaining === 0);
      if (!allLocked) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [seed, text, charMs, staggerMs]);

  const Tag = as;
  return (
    <Tag className={className} aria-label={text}>
      {chars.map((s, i) => (
        <span key={i} aria-hidden="true" className={s.remaining ? "text-accent" : ""}>
          {s.current}
        </span>
      ))}
    </Tag>
  );
}

function pickGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "·";
}
