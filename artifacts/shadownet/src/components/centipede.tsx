/**
 * Conway's Game of Life background.
 *
 * Yes, this used to be a centipede. The reference vibe (Conway_) is the
 * actual cellular automaton — gliders, blinkers, oscillators, the whole
 * "self-replicating system" motif that pairs with ShadowNet's
 * "self-rotating session" idea. Implementing the real thing instead of a
 * decorative imitation:
 *
 *   - Wrap-around toroidal grid (no dead edges).
 *   - Mix of random soup + seeded patterns (glider, LWSS, R-pentomino,
 *     Gosper glider gun fragment) so the field never collapses to dead.
 *   - Soup re-seed on stagnation: if the live count plateaus or dies,
 *     drop new noise — the field never goes blank during a session.
 *   - Click to plant a glider at the cursor (real interactivity, not a
 *     fake hover effect).
 *   - Pixel cells, image-smoothing off, jade-grain palette.
 *   - DPR-aware so it stays crisp on retina without bloating CPU.
 */
import { useEffect, useRef } from "react";

export interface GameOfLifeProps {
  className?: string;
  /** Cell size in CSS pixels. Smaller = denser field, more retro. */
  cell?: number;
  /** Tick interval in ms. */
  tickMs?: number;
  /** Initial random density 0..1. */
  density?: number;
  /** Optional cap on rendered rows (e.g. for a hero strip). */
  maxRows?: number;
  /** If true, the canvas absorbs pointer events (clicks plant gliders). */
  interactive?: boolean;
}

const DEAD_DOT  = "rgba(111,175,155,0.05)";  // faint jade dust
const LIVE_NEW  = "#6FAF9B";                  // freshly born — bright glow
const LIVE_OLD  = "#3E7C6A";                  // settled — jade grain
const LIVE_FADE = "#1E4D40";                  // long-lived — deep shadow

// Patterns expressed as (dx, dy) offsets from a top-left anchor.
const GLIDER:    [number, number][] = [[1,0],[2,1],[0,2],[1,2],[2,2]];
const LWSS:      [number, number][] = [[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]];
const R_PENT:    [number, number][] = [[1,0],[2,0],[0,1],[1,1],[1,2]];
const PULSAR:    [number, number][] = [[2,0],[3,0],[4,0],[8,0],[9,0],[10,0],[0,2],[5,2],[7,2],[12,2],[0,3],[5,3],[7,3],[12,3],[0,4],[5,4],[7,4],[12,4],[2,5],[3,5],[4,5],[8,5],[9,5],[10,5]];

function plant(grid: Uint8Array, cols: number, rows: number, ax: number, ay: number, pat: [number, number][]) {
  for (const [dx, dy] of pat) {
    const x = ((ax + dx) % cols + cols) % cols;
    const y = ((ay + dy) % rows + rows) % rows;
    grid[y * cols + x] = 1;
  }
}

export function Centipede({
  className = "",
  cell = 8,
  tickMs = 110,
  density = 0.18,
  maxRows,
  interactive = true,
}: GameOfLifeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let cols = 0;
    let rows = 0;
    let cur = new Uint8Array(0);
    let nxt = new Uint8Array(0);
    let age = new Uint16Array(0);  // how many ticks each cell has been alive
    let lastTick = 0;
    let stagnationCounter = 0;
    let lastLiveCount = 0;

    const seed = () => {
      cur = new Uint8Array(cols * rows);
      nxt = new Uint8Array(cols * rows);
      age = new Uint16Array(cols * rows);
      // Random soup at the requested density.
      for (let i = 0; i < cur.length; i++) {
        if (Math.random() < density) cur[i] = 1;
      }
      // Sprinkle named patterns so the field has structure, not just noise.
      const placements: Array<{ pat: [number, number][]; n: number }> = [
        { pat: GLIDER, n: Math.max(2, Math.floor(cols / 30)) },
        { pat: LWSS,   n: Math.max(1, Math.floor(cols / 60)) },
        { pat: R_PENT, n: 2 },
        { pat: PULSAR, n: 1 },
      ];
      for (const { pat, n } of placements) {
        for (let i = 0; i < n; i++) {
          plant(cur, cols, rows, Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), pat);
        }
      }
      stagnationCounter = 0;
      lastLiveCount = 0;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      cols = Math.max(16, Math.floor(w / cell));
      rows = Math.max(12, Math.floor(h / cell));
      if (maxRows) rows = Math.min(rows, maxRows);
      seed();
    };

    const onClick = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const cx = Math.floor((e.clientX - rect.left) / cell);
      const cy = Math.floor((e.clientY - rect.top) / cell);
      // Plant a glider headed down-right at the cursor.
      plant(cur, cols, rows, cx, cy, GLIDER);
    };

    const step = () => {
      // Toroidal Game of Life: each cell lives if it has 2-3 live neighbours
      // (when alive) or exactly 3 (when dead). Edges wrap so the field can
      // sustain travelling patterns indefinitely.
      let live = 0;
      for (let y = 0; y < rows; y++) {
        const yUp = (y - 1 + rows) % rows;
        const yDn = (y + 1) % rows;
        for (let x = 0; x < cols; x++) {
          const xL = (x - 1 + cols) % cols;
          const xR = (x + 1) % cols;
          const n =
            cur[yUp * cols + xL]! + cur[yUp * cols + x]! + cur[yUp * cols + xR]! +
            cur[y   * cols + xL]!                      + cur[y   * cols + xR]! +
            cur[yDn * cols + xL]! + cur[yDn * cols + x]! + cur[yDn * cols + xR]!;
          const i = y * cols + x;
          const alive = cur[i] === 1;
          const next = alive ? (n === 2 || n === 3) ? 1 : 0 : (n === 3 ? 1 : 0);
          nxt[i] = next;
          if (next) {
            live++;
            age[i] = alive ? Math.min(255, age[i]! + 1) : 1;
          } else {
            age[i] = 0;
          }
        }
      }
      // Detect stagnation (still life or extinction) and re-seed gently.
      if (Math.abs(live - lastLiveCount) < 3) {
        stagnationCounter++;
      } else {
        stagnationCounter = 0;
      }
      lastLiveCount = live;
      if (live < cols * rows * 0.02 || stagnationCounter > 40) {
        // Inject fresh entropy without a full reset — keeps motion organic.
        for (let i = 0; i < 24; i++) {
          plant(nxt, cols, rows, Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), GLIDER);
        }
        plant(nxt, cols, rows, Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), R_PENT);
        stagnationCounter = 0;
      }
      const tmp = cur; cur = nxt; nxt = tmp;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastTick > tickMs) {
        step();
        lastTick = now;
      }
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Dead-cell dust (sparse, so the grid has texture even when empty).
      ctx.fillStyle = DEAD_DOT;
      const dotEvery = 3;
      for (let y = 0; y < rows; y += dotEvery) {
        for (let x = 0; x < cols; x += dotEvery) {
          if (cur[y * cols + x]) continue;
          ctx.fillRect(x * cell + cell / 2 - 0.5, y * cell + cell / 2 - 0.5, 1, 1);
        }
      }

      // Live cells, coloured by age — fresh births glow brighter.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (!cur[i]) continue;
          const a = age[i]!;
          ctx.fillStyle = a < 2 ? LIVE_NEW : a < 12 ? LIVE_OLD : LIVE_FADE;
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);
    if (interactive) canvas.addEventListener("click", onClick);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", onClick);
    };
  }, [cell, tickMs, density, maxRows, interactive]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={interactive ? undefined : { pointerEvents: "none" }}
    />
  );
}
