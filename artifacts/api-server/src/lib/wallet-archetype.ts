// Derive a wallet "archetype" + PnL/win-rate from on-chain activity.
// Pure functions — no I/O. Inputs come from already-parsed transaction data.

export type Archetype =
  | "SNIPER"
  | "AIRDROP_FARMER"
  | "LIQUIDITY_PROVIDER"
  | "SMART_MONEY"
  | "BAG_HOLDER"
  | "ACTIVE_TRADER"
  | "DORMANT"
  | "NORMAL";

export interface ArchetypeResult {
  archetype: Archetype;
  label: string;
  description: string;
  confidence: number; // 0-100
  signals: string[];
}

interface ActivityForArchetype {
  type: "BUY" | "SELL" | "RECEIVE" | "SEND" | "OTHER";
  tokenMint: string | null;
  tokenAmount: number | null;
  valueUsd: number | null;
  timestamp: string;
}

interface ArchetypeInput {
  activity: ActivityForArchetype[];
  totalUsd: number;
  solBalance: number;
  tokenCount: number;
  txCount: number;
  scannedTxCount: number;
  ageDays: number;
  inactiveDays: number | null;
  // Per-mint trade stats already computed by PnL pass
  perMintStats: Map<string, {
    buys: number;
    sells: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
    currentHeldValueUsd: number;
    realizedPnlUsd: number;
  }>;
}

export function classifyArchetype(input: ArchetypeInput): ArchetypeResult {
  const { activity, totalUsd, solBalance, tokenCount, txCount, scannedTxCount, ageDays, inactiveDays, perMintStats } = input;
  const signals: string[] = [];

  if (txCount === 0 || (inactiveDays !== null && inactiveDays > 90 && txCount < 5)) {
    return {
      archetype: "DORMANT",
      label: "Dormant Wallet",
      description: "No recent on-chain activity. Cold storage or abandoned address.",
      confidence: 90,
      signals: ["No transactions in scan window"],
    };
  }

  // Counts
  const buys = activity.filter(a => a.type === "BUY").length;
  const sells = activity.filter(a => a.type === "SELL").length;
  const receives = activity.filter(a => a.type === "RECEIVE").length;
  const swaps = buys + sells;
  const tradedMints = new Set(activity.filter(a => a.tokenMint).map(a => a.tokenMint as string));
  const distinctTokensTraded = tradedMints.size;

  // ── SNIPER: rapid buys of newly-launched tokens, often holds briefly then dumps ──
  // Heuristic: high buy/sell ratio of distinct fresh mints in a short window.
  // We approximate "rapid" by checking buys cluster within seconds of each other.
  let rapidBuys = 0;
  const buyTimes = activity.filter(a => a.type === "BUY").map(a => Date.parse(a.timestamp)).sort((a, b) => a - b);
  for (let i = 1; i < buyTimes.length; i++) {
    if (buyTimes[i] - buyTimes[i - 1] < 30_000) rapidBuys++;
  }
  if (rapidBuys >= 3 && buys >= 5 && distinctTokensTraded >= 3) {
    signals.push(`${rapidBuys} buys within 30s of each other`);
    signals.push(`${distinctTokensTraded} distinct tokens traded`);
    return {
      archetype: "SNIPER",
      label: "Sniper Wallet",
      description: "Snipes new token launches with rapid-fire buys. High risk, high turnover.",
      confidence: Math.min(95, 50 + rapidBuys * 8),
      signals,
    };
  }

  // ── AIRDROP FARMER: many RECEIVE events, few BUY/SELL, low SOL balance ──
  if (receives >= 5 && receives > swaps && solBalance < 1 && totalUsd < 200) {
    signals.push(`${receives} airdrop-like receives`);
    signals.push(`Low SOL balance (${solBalance.toFixed(2)})`);
    if (tokenCount > 8) signals.push(`Holds ${tokenCount} small-value tokens`);
    return {
      archetype: "AIRDROP_FARMER",
      label: "Airdrop Farmer",
      description: "Many tokens received with little trading. Likely a farming alt or claim wallet.",
      confidence: Math.min(90, 40 + receives * 5),
      signals,
    };
  }

  // ── SMART MONEY: high realized PnL, decent win-rate, sizeable portfolio ──
  let totalRealized = 0;
  let winningMints = 0;
  let losingMints = 0;
  let closedPositions = 0;
  for (const stats of perMintStats.values()) {
    if (stats.sells > 0) {
      closedPositions++;
      totalRealized += stats.realizedPnlUsd;
      if (stats.realizedPnlUsd > 0) winningMints++;
      else if (stats.realizedPnlUsd < 0) losingMints++;
    }
  }
  const winRate = closedPositions > 0 ? winningMints / closedPositions : 0;
  if (totalRealized > 1000 && winRate >= 0.6 && closedPositions >= 5) {
    signals.push(`Realized PnL ~$${totalRealized.toFixed(0)} across ${closedPositions} positions`);
    signals.push(`Win rate ${(winRate * 100).toFixed(0)}%`);
    return {
      archetype: "SMART_MONEY",
      label: "Smart Money",
      description: "Strong realized profits with consistent winning trades. Worth tracking.",
      confidence: Math.min(95, 50 + winRate * 50),
      signals,
    };
  }

  // ── BAG HOLDER: bought tokens, never sold, current value far below cost ──
  let underwaterValue = 0;
  let underwaterCount = 0;
  for (const stats of perMintStats.values()) {
    if (stats.sells === 0 && stats.totalBoughtUsd > 50 && stats.currentHeldValueUsd < stats.totalBoughtUsd * 0.5) {
      underwaterCount++;
      underwaterValue += stats.totalBoughtUsd - stats.currentHeldValueUsd;
    }
  }
  if (underwaterCount >= 3 && underwaterValue > 500) {
    signals.push(`${underwaterCount} positions down >50%`);
    signals.push(`Unrealized losses ~$${underwaterValue.toFixed(0)}`);
    return {
      archetype: "BAG_HOLDER",
      label: "Bag Holder",
      description: "Multiple unsold positions deeply underwater. Holding through losses.",
      confidence: Math.min(85, 40 + underwaterCount * 8),
      signals,
    };
  }

  // ── LIQUIDITY PROVIDER: Could detect via specific program IDs (Orca, Raydium LP)
  // Skipping a noisy heuristic here; revisit when we add program-aware parsing.

  // ── ACTIVE TRADER: high swap count, balanced buy/sell ──
  if (swaps >= 15 && distinctTokensTraded >= 5) {
    signals.push(`${swaps} swaps across ${distinctTokensTraded} tokens`);
    if (closedPositions > 0) signals.push(`${(winRate * 100).toFixed(0)}% win rate on closed positions`);
    return {
      archetype: "ACTIVE_TRADER",
      label: "Active Trader",
      description: `Frequent swap activity across multiple tokens. ${closedPositions ? `${(winRate * 100).toFixed(0)}% win rate.` : "Mostly open positions."}`,
      confidence: Math.min(85, 40 + swaps * 2),
      signals,
    };
  }

  // ── Fallback ──
  signals.push(`${txCount} txs scanned, ${swaps} swaps, $${totalUsd.toFixed(0)} portfolio`);
  return {
    archetype: "NORMAL",
    label: "Standard Wallet",
    description: `Typical user wallet — ${tokenCount} tokens, modest activity${ageDays > 30 ? `, first seen ~${ageDays}d ago` : ""}.`,
    confidence: 60,
    signals,
  };
}

// ── PnL aggregation ──────────────────────────────────────────────────────────
// Walks activity, accumulating per-mint flow. Realized PnL is computed
// FIFO-style: each SELL closes against the average cost basis of accumulated BUYs.

interface ActivityForPnl {
  type: "BUY" | "SELL" | "RECEIVE" | "SEND" | "OTHER";
  tokenMint: string | null;
  tokenAmount: number | null; // signed: positive on BUY/RECEIVE, negative on SELL/SEND
  valueUsd: number | null;
  timestamp: string;
}

export interface PerMintStats {
  buys: number;
  sells: number;
  totalBoughtUsd: number;
  totalSoldUsd: number;
  currentHeldUnits: number; // can be negative if scan window misses earlier txs
  costBasisPerUnit: number;
  currentHeldValueUsd: number; // filled in by caller after price lookup
  realizedPnlUsd: number;
}

export function buildPerMintStats(
  activity: ActivityForPnl[],
  currentPriceByMint: Record<string, number>,
): Map<string, PerMintStats> {
  // Replay in chronological order so cost basis updates correctly
  const sorted = [...activity].sort((a, b) =>
    Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const stats = new Map<string, PerMintStats>();

  for (const evt of sorted) {
    if (!evt.tokenMint || !evt.tokenAmount) continue;
    const mint = evt.tokenMint;
    const amt = Math.abs(evt.tokenAmount);
    const usd = evt.valueUsd ?? 0;
    const s = stats.get(mint) ?? {
      buys: 0, sells: 0,
      totalBoughtUsd: 0, totalSoldUsd: 0,
      currentHeldUnits: 0, costBasisPerUnit: 0,
      currentHeldValueUsd: 0, realizedPnlUsd: 0,
    };
    if (evt.type === "BUY" || evt.type === "RECEIVE") {
      s.buys += evt.type === "BUY" ? 1 : 0;
      s.totalBoughtUsd += usd;
      // Update weighted-average cost basis
      const newUnits = s.currentHeldUnits + amt;
      if (newUnits > 0) {
        s.costBasisPerUnit = (s.costBasisPerUnit * s.currentHeldUnits + usd) / newUnits;
      }
      s.currentHeldUnits = newUnits;
    } else if (evt.type === "SELL" || evt.type === "SEND") {
      s.sells += evt.type === "SELL" ? 1 : 0;
      s.totalSoldUsd += usd;
      const closedUnits = Math.min(amt, s.currentHeldUnits);
      const realized = usd - closedUnits * s.costBasisPerUnit;
      if (s.costBasisPerUnit > 0) s.realizedPnlUsd += realized;
      s.currentHeldUnits = Math.max(0, s.currentHeldUnits - amt);
    }
    stats.set(mint, s);
  }

  // Mark-to-market the still-held units
  for (const [mint, s] of stats) {
    const px = currentPriceByMint[mint] ?? 0;
    s.currentHeldValueUsd = Math.max(0, s.currentHeldUnits) * px;
  }

  return stats;
}

export interface PnlSummary {
  realizedUsd: number;
  unrealizedUsd: number;
  totalBoughtUsd: number;
  totalSoldUsd: number;
  closedPositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number; // 0..1
  bestMint: { mint: string; realizedUsd: number } | null;
  worstMint: { mint: string; realizedUsd: number } | null;
}

export function summarisePnl(stats: Map<string, PerMintStats>): PnlSummary {
  let realized = 0, unrealized = 0, bought = 0, sold = 0;
  let closed = 0, won = 0, lost = 0;
  let best: { mint: string; realizedUsd: number } | null = null;
  let worst: { mint: string; realizedUsd: number } | null = null;
  for (const [mint, s] of stats) {
    realized += s.realizedPnlUsd;
    unrealized += s.currentHeldValueUsd - Math.max(0, s.currentHeldUnits) * s.costBasisPerUnit;
    bought += s.totalBoughtUsd;
    sold += s.totalSoldUsd;
    if (s.sells > 0) {
      closed++;
      if (s.realizedPnlUsd > 0) won++;
      else if (s.realizedPnlUsd < 0) lost++;
      if (!best || s.realizedPnlUsd > best.realizedUsd) best = { mint, realizedUsd: s.realizedPnlUsd };
      if (!worst || s.realizedPnlUsd < worst.realizedUsd) worst = { mint, realizedUsd: s.realizedPnlUsd };
    }
  }
  return {
    realizedUsd: realized,
    unrealizedUsd: unrealized,
    totalBoughtUsd: bought,
    totalSoldUsd: sold,
    closedPositions: closed,
    winningPositions: won,
    losingPositions: lost,
    winRate: closed > 0 ? won / closed : 0,
    bestMint: best,
    worstMint: worst,
  };
}
