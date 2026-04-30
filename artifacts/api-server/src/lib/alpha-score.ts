// Alpha-score: 10-layer weighted token scorer ported from alice's
// `alphaScore` function in alice_5.01/server.js. Pure, deterministic,
// no I/O. Inputs are normalised market + on-chain + audit fields; the
// caller is responsible for fetching them upstream (DexScreener for
// price/volume/txns, Jupiter token API for audit + organicScore,
// Helius DAS for holders, pre-computed TA score).
//
// Layer weights (sum = 100%):
//   FDV 13 · Age 8 · Momentum 13 · Liquidity 12 · Volume 10 ·
//   Holders 8 · Pressure 10 · Risk 10 · Legitimacy 4 · TA 12

export type AlphaSignal = "PUMPING" | "BUY" | "WATCH" | "AVOID";
export type AlphaTier = "micro" | "small" | "mid" | "large";

export interface AlphaInput {
  fdv: number;
  liquidity: number;
  volume24h: number;
  ageMin: number;
  holders: number;
  priceChange: { m5?: number; h1?: number; h24?: number };
  txns: { m5?: { buys: number; sells: number }; h1?: { buys: number; sells: number }; h24?: { buys: number; sells: number } };
  jupiter?: {
    organicScore?: number | null;
    isVerified?: boolean;
    mintDisabled?: boolean;
    freezeDisabled?: boolean;
    topHoldersPercentage?: number | null;
    cexCount?: number;
  };
  socials?: { x?: boolean; tg?: boolean; web?: boolean };
  technicalAnalysisScore?: number; // 0-100, pre-computed by upstream TA engine
  bondingCurveProgress?: number;   // 0-1, only set for pre-graduation pump.fun tokens
  tier?: AlphaTier;
}

export interface AlphaLayer { name: string; score: number; weight: number; }

export interface AlphaOutput {
  score: number;            // 0-100, post-adjustments
  baseScore: number;        // 0-100, pre-adjustments
  signal: AlphaSignal;
  recommendation: string;   // human-readable
  layers: AlphaLayer[];
}

// ── Layer 1: FDV bands (tier-aware) ──────────────────────────────────────
function scoreFdv(fdv: number, tier?: AlphaTier): number {
  if (tier === "micro" || (!tier && fdv < 500_000)) {
    if (fdv < 5_000)   return 95;
    if (fdv < 15_000)  return 85;
    if (fdv < 30_000)  return 75;
    if (fdv < 50_000)  return 65;
    if (fdv < 100_000) return 55;
    if (fdv < 250_000) return 45;
    if (fdv < 500_000) return 35;
    return 25;
  }
  // small/mid/large: prefer mid-cap discovery
  if (fdv < 1_500_000) return 80;
  if (fdv < 10_000_000) return 60;
  if (fdv < 100_000_000) return 40;
  return 25;
}

// ── Layer 2: Age — sweet spot is the 5min-24h window ─────────────────────
function scoreAge(ageMin: number): number {
  if (ageMin <= 5)        return 90;
  if (ageMin <= 15)       return 80;
  if (ageMin <= 30)       return 70;
  if (ageMin <= 60)       return 60;
  if (ageMin <= 180)      return 50;
  if (ageMin <= 360)      return 40;
  if (ageMin <= 1440)     return 30;
  if (ageMin <= 10_080)   return 20;
  return 10;
}

// ── Layer 3: Momentum (weighted price change m5/h1/h24) ──────────────────
function scoreMomentum(pcM5: number, pcH1: number, pcH24: number): number {
  const shortMom = (pcM5 * 2 + pcH1) / 3;
  let s: number;
  if (shortMom > 30)      s = 90;
  else if (shortMom > 15) s = 75;
  else if (shortMom > 5)  s = 60;
  else if (shortMom > 0)  s = 50;
  else if (shortMom > -5) s = 40;
  else if (shortMom > -15) s = 30;
  else                    s = 15;

  // ±10 from h24 trend — full agreement amplifies, divergence dampens
  if (pcH24 > 50)       s += 10;
  else if (pcH24 > 20)  s += 5;
  else if (pcH24 < -20) s -= 10;
  else if (pcH24 < -5)  s -= 5;

  return Math.max(0, Math.min(100, s));
}

// ── Layer 4: Liquidity (tier-aware floors) ───────────────────────────────
function scoreLiquidity(liq: number, tier?: AlphaTier): number {
  if (tier === "micro" || !tier) {
    if (liq >= 50_000) return 85;
    if (liq >= 25_000) return 70;
    if (liq >= 15_000) return 55;
    if (liq >= 8_000)  return 40;
    if (liq >= 3_000)  return 30;
    return 15;
  }
  if (liq >= 500_000) return 80;
  if (liq >= 100_000) return 65;
  if (liq >= 50_000)  return 50;
  return 30;
}

// ── Layer 5: Volume vs FDV (turnover) ────────────────────────────────────
function scoreVolume(vol: number, fdv: number): number {
  if (fdv <= 0) return 0;
  const ratioPct = (vol / fdv) * 100;
  if (ratioPct > 100) return 90;
  if (ratioPct > 50)  return 75;
  if (ratioPct > 25)  return 65;
  if (ratioPct > 10)  return 55;
  if (ratioPct > 5)   return 45;
  if (ratioPct > 1)   return 35;
  return 20;
}

// ── Layer 6: Holders ─────────────────────────────────────────────────────
function scoreHolders(holders: number): number {
  if (holders >= 1_000) return 85;
  if (holders >= 500)   return 70;
  if (holders >= 200)   return 55;
  if (holders >= 100)   return 45;
  if (holders >= 50)    return 35;
  return 25;
}

// ── Layer 7: Pressure (buy/sell skew, weighted by recency) ──────────────
function avgPressure(input: AlphaInput): number {
  const ratio = (b: number, s: number) => (b + s > 0 ? b / (b + s) : 0.5);
  const m5 = ratio(input.txns.m5?.buys ?? 0, input.txns.m5?.sells ?? 0);
  const h1 = ratio(input.txns.h1?.buys ?? 0, input.txns.h1?.sells ?? 0);
  const h24 = ratio(input.txns.h24?.buys ?? 0, input.txns.h24?.sells ?? 0);
  return m5 * 0.5 + h1 * 0.3 + h24 * 0.2;
}

function scorePressure(input: AlphaInput): number {
  const p = avgPressure(input);
  let s: number;
  if (p >= 0.7)       s = 90;
  else if (p >= 0.6)  s = 75;
  else if (p >= 0.55) s = 60;
  else if (p >= 0.45) s = 50;
  else if (p >= 0.4)  s = 35;
  else if (p >= 0.3)  s = 25;
  else                s = 15;

  // ±5 activity bonus when total tx in 24h is meaningful
  const total24 = (input.txns.h24?.buys ?? 0) + (input.txns.h24?.sells ?? 0);
  if (total24 > 200)   s += 5;
  else if (total24 < 20) s -= 5;
  return Math.max(0, Math.min(100, s));
}

// ── Layer 8: Risk (Jupiter audit) ────────────────────────────────────────
function scoreRisk(input: AlphaInput): number {
  let s = 50;
  const liqRatio = input.fdv > 0 ? input.liquidity / input.fdv : 0;
  if (liqRatio > 0.10)      s += 15;
  else if (liqRatio > 0.05) s += 8;
  else if (liqRatio < 0.01) s -= 15;

  if (input.jupiter?.mintDisabled)   s += 15;
  if (input.jupiter?.freezeDisabled) s += 10;

  const top = input.jupiter?.topHoldersPercentage ?? null;
  if (top !== null) {
    if (top > 70)      s -= 15;
    else if (top > 50) s -= 8;
    else if (top < 25) s += 5;
  }

  const p = avgPressure(input);
  if (p < 0.4) s -= 15;

  return Math.max(0, Math.min(100, s));
}

// ── Layer 9: Legitimacy (socials + Jupiter verified + CEXes) ────────────
function scoreLegit(input: AlphaInput): number {
  let s = 0;
  const socials = input.socials ?? {};
  if (socials.x)   s += 15;
  if (socials.tg)  s += 10;
  if (socials.web) s += 10;
  if (input.jupiter?.isVerified) s += 25;
  s += Math.min(15, (input.jupiter?.cexCount ?? 0) * 5);
  return Math.max(0, Math.min(100, s));
}

// ── Layer 10: Technical analysis (precomputed) ──────────────────────────
function scoreTA(input: AlphaInput): number {
  const ta = input.technicalAnalysisScore;
  if (typeof ta !== "number") return 50; // neutral when no TA data
  return Math.max(0, Math.min(100, ta));
}

// ── Post-base adjustments ────────────────────────────────────────────────
function postAdjustments(base: number, input: AlphaInput): number {
  let s = base;
  const pc5 = input.priceChange.m5 ?? 0;
  const pc1 = input.priceChange.h1 ?? 0;

  // Jupiter organicScore tilt
  const org = input.jupiter?.organicScore;
  if (typeof org === "number") s += (org - 50) / 10;

  // Mint+freeze authority combo
  if (input.jupiter?.mintDisabled && input.jupiter?.freezeDisabled) s += 12;
  else if (input.jupiter?.mintDisabled) s += 6;
  else if (input.jupiter?.freezeDisabled) s += 3;

  // Top-holder concentration (additional layer beyond risk score)
  const top = input.jupiter?.topHoldersPercentage ?? null;
  if (top !== null) {
    if (top > 70)      s -= 15;
    else if (top > 50) s -= 8;
    else if (top < 25) s += 5;
  }

  // Bonding-curve bonus (pump.fun pre-graduation)
  const bc = input.bondingCurveProgress;
  if (typeof bc === "number") {
    if (bc >= 0.30 && bc <= 0.50)      s += 15; // PRIME PRE-BOND
    else if (bc >= 0.20 && bc <= 0.70) s += 10;
    else if (bc > 0.70 && bc <= 0.90)  s += 5;
    else if (bc > 0.90)                s += 3;
    else if (bc < 0.20)                s -= 5;
  }

  // Combo bonuses
  const pressure = avgPressure(input) * 100;
  if (input.ageMin <= 60 && pc5 > 5) s += 5;
  if ((input.jupiter?.mintDisabled && input.jupiter?.freezeDisabled) && pressure >= 60) s += 5;
  if (pc5 >= 5 && pc5 <= 25 && pc1 >= -5 && pc1 <= 30 && pressure >= 60) s += 10;
  if (input.ageMin <= 30 && pc5 > 3 && pressure >= 55) s += 8;

  // Penalties — parabolic / dump signals
  if (pc1 > 100)             s -= 15;
  else if (pc1 > 50)         s -= 8;
  if (pc5 > 30)              s -= 10;
  if (pc1 > 30 && pc5 < -5)  s -= 12; // reversal
  if (pc5 < -10)             s -= 8;
  if (input.ageMin > 1440 && (input.priceChange.h24 ?? 0) < -30) s -= 10;

  return Math.max(0, Math.min(100, Math.round(s)));
}

function recommend(score: number): string {
  if (score >= 80) return "🔥 HIGH SIGNAL";
  if (score >= 65) return "⚡ ELEVATED";
  if (score >= 50) return "👀 MONITOR";
  if (score >= 35) return "📉 WEAK";
  return "⚠️ CAUTION";
}

function signalFor(score: number, pcH24: number): AlphaSignal {
  if (score >= 88 && pcH24 > 100) return "PUMPING";
  if (score >= 70) return "BUY";
  if (score >= 45) return "WATCH";
  return "AVOID";
}

export function alphaScore(input: AlphaInput): AlphaOutput {
  const sFdv      = scoreFdv(input.fdv, input.tier);
  const sAge      = scoreAge(input.ageMin);
  const sMom      = scoreMomentum(input.priceChange.m5 ?? 0, input.priceChange.h1 ?? 0, input.priceChange.h24 ?? 0);
  const sLiq      = scoreLiquidity(input.liquidity, input.tier);
  const sVol      = scoreVolume(input.volume24h, input.fdv);
  const sHolders  = scoreHolders(input.holders);
  const sPressure = scorePressure(input);
  const sRisk     = scoreRisk(input);
  const sLegit    = scoreLegit(input);
  const sTA       = scoreTA(input);

  const baseScore = Math.round(
    sFdv * 0.13 +
    sAge * 0.08 +
    sMom * 0.13 +
    sLiq * 0.12 +
    sVol * 0.10 +
    sHolders * 0.08 +
    sPressure * 0.10 +
    sRisk * 0.10 +
    sLegit * 0.04 +
    sTA * 0.12
  );

  const score = postAdjustments(baseScore, input);

  const layers: AlphaLayer[] = [
    { name: "FDV",        score: sFdv,      weight: 0.13 },
    { name: "Age",        score: sAge,      weight: 0.08 },
    { name: "Momentum",   score: sMom,      weight: 0.13 },
    { name: "Liquidity",  score: sLiq,      weight: 0.12 },
    { name: "Volume",     score: sVol,      weight: 0.10 },
    { name: "Holders",    score: sHolders,  weight: 0.08 },
    { name: "Pressure",   score: sPressure, weight: 0.10 },
    { name: "Risk",       score: sRisk,     weight: 0.10 },
    { name: "Legitimacy", score: sLegit,    weight: 0.04 },
    { name: "Technical",  score: sTA,       weight: 0.12 },
  ];

  return {
    score,
    baseScore,
    signal: signalFor(score, input.priceChange.h24 ?? 0),
    recommendation: recommend(score),
    layers,
  };
}
