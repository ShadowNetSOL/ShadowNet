// GitHub anti-gaming + scam-pattern detection.
// All pure functions — fetch wrappers live in intelligence.ts.

export interface ScamPatterns {
  matchedPatterns: string[];
  obfuscationDetected: boolean;
  drainerSignatures: string[];
  highRiskKeywords: string[];
  riskScore: number; // 0-100, higher = scarier
}

const SEED_PHRASE_RX = /\b(seed[\s-]?phrase|mnemonic[\s-]?phrase|recovery[\s-]?phrase|12[\s-]?word|24[\s-]?word|enter\s+your\s+seed|paste\s+your\s+private\s+key|connect\s+your\s+wallet\s+to\s+claim)\b/i;
const KEY_THEFT_RX = /\b(secretKey|privateKey|wallet\.privateKey|process\.env\.PRIVATE_KEY|exportPrivateKey)\b/;
const DRAINER_RX = /\b(drainer|sweep[A-Z]?[\w]*\(|bulkTransfer|drainAllTokens|wallet\.signAndSendAllTransactions|atomic\s*sweep)\b/i;
const OBFUSCATION_RX = /(eval\s*\(\s*atob|String\.fromCharCode\(\s*0x|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}|_0x[a-f0-9]{4,}\s*\(|new\s+Function\s*\(\s*atob)/i;
const FAKE_GAINS_RX = /\b(guaranteed\s+(profit|returns|gains)|100x\s+overnight|risk[-\s]?free|never\s+loses|airdrop\s+of\s+\d+\s*ETH)\b/i;
const PHISH_DOMAIN_RX = /(metamask[-_]?(verify|connect|support)|phant[o0]m[-_]?(verify|support)|wallet[-_]?(connect|verify)[-_]?\.(io|com|app|xyz))/i;

const SUSPICIOUS_FILE_NAMES = [
  /^stealer/i, /drainer/i, /\.(exe|bat|scr|ps1|bin)$/i,
  /^webhook[\.\-_]token/i,
];

export function detectScamPatterns(args: {
  readme: string | null;
  rootFiles: string[];
}): ScamPatterns {
  const matched: string[] = [];
  const drainer: string[] = [];
  const keywords: string[] = [];
  let obfuscation = false;
  const text = args.readme ?? "";

  if (SEED_PHRASE_RX.test(text)) {
    matched.push("README requests seed phrase / mnemonic / private key");
    keywords.push("seed phrase / private key request");
  }
  if (KEY_THEFT_RX.test(text)) {
    matched.push("README references private-key extraction code");
    drainer.push("private-key access pattern in README");
  }
  if (DRAINER_RX.test(text)) {
    matched.push("README contains drainer/bulk-transfer terms");
    drainer.push("drainer keyword in README");
  }
  if (OBFUSCATION_RX.test(text)) {
    obfuscation = true;
    matched.push("Obfuscated JavaScript patterns in README");
  }
  if (FAKE_GAINS_RX.test(text)) {
    matched.push("Unrealistic guaranteed-gains claims in README");
    keywords.push("'guaranteed gains' marketing language");
  }
  if (PHISH_DOMAIN_RX.test(text)) {
    matched.push("Likely phishing domain referenced in README");
    keywords.push("phishing-style wallet domain");
  }

  for (const f of args.rootFiles) {
    for (const rx of SUSPICIOUS_FILE_NAMES) {
      if (rx.test(f)) {
        matched.push(`Suspicious filename: ${f}`);
        keywords.push(`file: ${f}`);
        break;
      }
    }
  }

  // Risk score
  let risk = 0;
  if (drainer.length) risk += 50;
  if (obfuscation) risk += 25;
  if (matched.some(m => m.includes("seed phrase"))) risk += 35;
  if (matched.some(m => m.includes("phishing"))) risk += 25;
  if (matched.some(m => m.includes("guaranteed-gains"))) risk += 15;
  risk = Math.min(100, risk);

  return {
    matchedPatterns: matched.slice(0, 8),
    obfuscationDetected: obfuscation,
    drainerSignatures: drainer.slice(0, 5),
    highRiskKeywords: keywords.slice(0, 8),
    riskScore: risk,
  };
}

// ── Anti-gaming: stars-spike, commit-frequency variance, owner age ───────────

export interface AntiGamingSignals {
  starsPerDay: number;
  starsSpike: boolean; // unusually high relative to repo age
  commitFrequencyConsistency: number; // 0..1, higher = more consistent
  burstyCommits: boolean; // many commits clustered close in time
  ownerAgeDays: number | null;
  ownerYoungAccount: boolean; // less than 60d
  flags: string[];
}

export function detectAntiGaming(args: {
  stars: number;
  ageDays: number;
  recentCommitTimestamps: number[]; // unix ms, newest first or any order
  ownerCreatedAt: string | null;
}): AntiGamingSignals {
  const flags: string[] = [];
  const starsPerDay = args.ageDays > 0 ? args.stars / args.ageDays : args.stars;
  const starsSpike = args.stars >= 50 && args.ageDays < 30 && starsPerDay > 5;
  if (starsSpike) flags.push(`Suspicious star velocity: ${starsPerDay.toFixed(1)} stars/day for a ${args.ageDays}d-old repo`);

  // Commit frequency: gaps between commits in days
  const sortedTs = [...args.recentCommitTimestamps].sort((a, b) => a - b);
  const gapsDays: number[] = [];
  for (let i = 1; i < sortedTs.length; i++) {
    gapsDays.push((sortedTs[i] - sortedTs[i - 1]) / 86_400_000);
  }
  let consistency = 0;
  let bursty = false;
  if (gapsDays.length >= 3) {
    const mean = gapsDays.reduce((s, x) => s + x, 0) / gapsDays.length;
    const variance = gapsDays.reduce((s, x) => s + (x - mean) ** 2, 0) / gapsDays.length;
    const stdDev = Math.sqrt(variance);
    // Lower coefficient of variation = more consistent
    const cv = mean > 0 ? stdDev / mean : 1;
    consistency = Math.max(0, Math.min(1, 1 - Math.min(cv, 2) / 2));
    const sub5min = gapsDays.filter(g => g < 5 / (60 * 24)).length;
    if (sub5min >= 5) {
      bursty = true;
      flags.push(`${sub5min} commits within 5min of each other — likely bulk push`);
    }
  }

  let ownerAgeDays: number | null = null;
  let ownerYoung = false;
  if (args.ownerCreatedAt) {
    ownerAgeDays = Math.max(0, Math.floor((Date.now() - new Date(args.ownerCreatedAt).getTime()) / 86_400_000));
    if (ownerAgeDays < 60) {
      ownerYoung = true;
      flags.push(`Owner account is only ${ownerAgeDays} days old`);
    }
  }

  return {
    starsPerDay: Number(starsPerDay.toFixed(2)),
    starsSpike,
    commitFrequencyConsistency: Number(consistency.toFixed(2)),
    burstyCommits: bursty,
    ownerAgeDays,
    ownerYoungAccount: ownerYoung,
    flags,
  };
}

// Adjust the trust score downward for scam/anti-gaming signals
export function applyTrustAdjustments(baseScore: number, scam: ScamPatterns, gaming: AntiGamingSignals): number {
  let s = baseScore;
  if (scam.drainerSignatures.length) s -= 50;
  if (scam.obfuscationDetected) s -= 20;
  if (scam.matchedPatterns.some(m => /seed phrase/i.test(m))) s -= 30;
  if (gaming.starsSpike) s -= 15;
  if (gaming.ownerYoungAccount) s -= 10;
  if (gaming.burstyCommits) s -= 8;
  return Math.max(0, Math.min(100, Math.round(s)));
}
