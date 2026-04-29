// GitHub anti-gaming + scam-pattern detection.
// All pure functions — fetch wrappers live in intelligence.ts.

// ── Severity-tiered scam pattern detector ────────────────────────────────────
//
// Each pattern carries a SEVERITY tier so the verdict isn't just "matched/not".
//   HIGH   → unambiguous theft signal (private-key request, drainer code)
//   MEDIUM → strongly suspicious (obfuscation, phishing domain)
//   LOW    → marketing red flag, weak alone but corroborates higher-tier hits
//
// Final verdict is weight-based:
//   ≥1 HIGH or ≥2 MEDIUM            → LIKELY_MALICIOUS
//   ≥1 MEDIUM or ≥2 LOW             → SUSPICIOUS
//   1 LOW                           → LOW_CONCERN
//   none                            → CLEAN

export type ScamSeverity = "HIGH" | "MEDIUM" | "LOW";
export type ScamVerdict = "LIKELY_MALICIOUS" | "SUSPICIOUS" | "LOW_CONCERN" | "CLEAN";

export interface ScamPatternHit {
  id: string;
  label: string;
  severity: ScamSeverity;
  evidence: string;
}

export interface ScamPatterns {
  hits: ScamPatternHit[];
  verdict: ScamVerdict;
  confidence: number;        // 0..1, how confident we are in the verdict
  riskScore: number;         // 0..100, kept for backwards compat
  // Backwards-compat fields the existing UI/route still reads:
  matchedPatterns: string[];
  obfuscationDetected: boolean;
  drainerSignatures: string[];
  highRiskKeywords: string[];
}

// HIGH: imperative asks that disclose secrets — actual phishing language.
// "enter your seed phrase", "paste your private key", "send us your mnemonic", "DM your seed", etc.
// The noun (phrase|key|words) is REQUIRED — otherwise "share your secret recipe"
// or "submit your private feedback" would over-match.
const SECRET_REQUEST_RX = /\b(enter|paste|input|submit|type|share|send\s+(us|me)|dm\s+(us|me)|provide|give\s+(us|me)|reveal|disclose)\s+(your\s+)?(seed|mnemonic|recovery|private|secret)\s+(phrase|key|words?)\b|\bconnect\s+your\s+wallet\s+to\s+claim\b|\bverify\s+your\s+wallet\s+by\s+(entering|pasting|providing|submitting)\b/i;

// LOWER-TIER (suppressed if defensive context): bare mentions of seed phrase / private key.
// These appear constantly in legitimate security docs ("never share your seed phrase").
const SECRET_MENTION_RX = /\b(seed[\s-]?phrase|mnemonic[\s-]?phrase|recovery[\s-]?phrase|12[\s-]?word|24[\s-]?word|private[\s-]?key)\b/i;

// Defensive / educational context — if the README contains ANY of these, bare
// secret mentions are almost certainly warnings, not phishing asks. Each
// pattern here is multi-word / context-rich on purpose: a single word like
// "warning" is too easy for an attacker to drop into a malicious README to
// bypass detection. Patterns must signal *protective intent* clearly.
const DEFENSIVE_CONTEXT_RX = /\b(never\s+(share|enter|give|paste|send|disclose|reveal|type|store|upload|commit)|do\s+not\s+share|don'?t\s+share|don'?t\s+enter|store\s+(offline|securely|encrypted)|keep\s+(safe|secure|offline|private)|threat[\s-]?model|security\s+(notice|advisory|guide|considerations|model|policy|warning|disclosure)|treat\s+(\w+\s+){0,5}?(as|like)\s+(a\s+|your\s+)?password|guard\s+your\s+(seed|mnemonic|private|secret|key)|protect\s+your\s+(seed|mnemonic|private|secret|key|wallet)|self[\s-]?custodial|non[\s-]?custodial|client[\s-]?side\s+only|stored\s+(only\s+)?(in|on)\s+(localstorage|your\s+browser)|encrypt(ed|ion)?\s+(at\s+rest|locally|in\s+browser))\b/i;

const KEY_THEFT_RX = /\b(secretKey|privateKey|wallet\.privateKey|process\.env\.PRIVATE_KEY|exportPrivateKey)\b/;
// HIGH-confidence drainer code patterns (actual function calls, not the bare word "drainer").
const DRAINER_CODE_RX = /(sweep[A-Z]\w*\s*\(|bulkTransfer\s*\(|drainAllTokens\s*\(|wallet\.signAndSendAllTransactions|atomic\s*sweep)/i;
// Bare mention of "drainer" — frequently appears in defensive security docs.
const DRAINER_MENTION_RX = /\bdrainer\b/i;
const OBFUSCATION_RX = /(eval\s*\(\s*atob|String\.fromCharCode\(\s*0x|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}|_0x[a-f0-9]{4,}\s*\(|new\s+Function\s*\(\s*atob)/i;
const FAKE_GAINS_RX = /\b(guaranteed\s+(profit|returns|gains)|100x\s+overnight|risk[-\s]?free|never\s+loses|airdrop\s+of\s+\d+\s*ETH)\b/i;
const PHISH_DOMAIN_RX = /(metamask[-_]?(verify|connect|support)|phant[o0]m[-_]?(verify|support)|wallet[-_]?(connect|verify)[-_]?\.(io|com|app|xyz))/i;
const URGENCY_RX = /\b(act\s+now|limited\s+time|only\s+\d+\s+spots|first\s+\d+\s+(users|wallets)|hurry|don'?t\s+miss)\b/i;

const SUSPICIOUS_FILE_NAMES = [
  /^stealer/i, /drainer/i, /\.(exe|bat|scr|ps1|bin)$/i,
  /^webhook[\.\-_]token/i,
];

function snippet(text: string, rx: RegExp, max = 120): string {
  const m = text.match(rx);
  if (!m || m.index === undefined) return "";
  const start = Math.max(0, m.index - 30);
  const end = Math.min(text.length, m.index + m[0].length + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, max);
}

export function detectScamPatterns(args: {
  readme: string | null;
  rootFiles: string[];
}): ScamPatterns {
  const text = args.readme ?? "";
  const hits: ScamPatternHit[] = [];

  // Whole-document defensive context — if the README is clearly educational
  // (talks about NEVER sharing keys, threat models, self-custody, etc.), we
  // suppress bare keyword mentions so security guides don't get flagged as
  // phishing. Imperative asks ("enter your seed phrase here") still trigger.
  const hasDefensiveContext = DEFENSIVE_CONTEXT_RX.test(text);

  // HIGH: actual phishing language — imperative ask for secrets.
  if (SECRET_REQUEST_RX.test(text)) {
    hits.push({ id: "seed-request", label: "Imperative ask for seed phrase / private key", severity: "HIGH", evidence: snippet(text, SECRET_REQUEST_RX) });
  } else if (SECRET_MENTION_RX.test(text) && !hasDefensiveContext) {
    // MEDIUM: bare mention with NO defensive framing — still suspicious but not certain.
    hits.push({ id: "secret-mention", label: "Mentions seed phrase / private key without security context", severity: "MEDIUM", evidence: snippet(text, SECRET_MENTION_RX) });
  }

  if (KEY_THEFT_RX.test(text)) {
    hits.push({ id: "key-theft-code", label: "Private-key extraction code referenced", severity: "HIGH", evidence: snippet(text, KEY_THEFT_RX) });
  }
  // HIGH: actual drainer code patterns (function calls, atomic-sweep code).
  if (DRAINER_CODE_RX.test(text)) {
    hits.push({ id: "drainer-code", label: "Drainer / bulk-transfer code pattern", severity: "HIGH", evidence: snippet(text, DRAINER_CODE_RX) });
  } else if (DRAINER_MENTION_RX.test(text) && !hasDefensiveContext) {
    // MEDIUM: bare word "drainer" with no defensive framing.
    hits.push({ id: "drainer-mention", label: "References drainer concepts without security context", severity: "MEDIUM", evidence: snippet(text, DRAINER_MENTION_RX) });
  }
  if (OBFUSCATION_RX.test(text)) {
    hits.push({ id: "obfuscation", label: "Obfuscated JavaScript in README", severity: "MEDIUM", evidence: snippet(text, OBFUSCATION_RX) });
  }
  if (PHISH_DOMAIN_RX.test(text)) {
    hits.push({ id: "phishing-domain", label: "Phishing-style wallet domain", severity: "MEDIUM", evidence: snippet(text, PHISH_DOMAIN_RX) });
  }
  if (FAKE_GAINS_RX.test(text)) {
    hits.push({ id: "fake-gains", label: "Unrealistic guaranteed-gains claims", severity: "LOW", evidence: snippet(text, FAKE_GAINS_RX) });
  }
  if (URGENCY_RX.test(text)) {
    hits.push({ id: "urgency", label: "High-pressure urgency language", severity: "LOW", evidence: snippet(text, URGENCY_RX) });
  }
  for (const f of args.rootFiles) {
    for (const rx of SUSPICIOUS_FILE_NAMES) {
      if (rx.test(f)) {
        const sev: ScamSeverity = /\.(exe|bat|scr|ps1|bin)$/i.test(f) ? "HIGH" : "MEDIUM";
        hits.push({ id: `file:${f}`, label: `Suspicious filename: ${f}`, severity: sev, evidence: f });
        break;
      }
    }
  }

  const high = hits.filter(h => h.severity === "HIGH").length;
  const med = hits.filter(h => h.severity === "MEDIUM").length;
  const low = hits.filter(h => h.severity === "LOW").length;

  let verdict: ScamVerdict = "CLEAN";
  let confidence = 0;
  if (high >= 1 || med >= 2) {
    verdict = "LIKELY_MALICIOUS";
    confidence = Math.min(1, 0.6 + 0.2 * high + 0.1 * med);
  } else if (med >= 1 || low >= 2) {
    verdict = "SUSPICIOUS";
    confidence = Math.min(1, 0.4 + 0.15 * med + 0.1 * low);
  } else if (low >= 1) {
    verdict = "LOW_CONCERN";
    confidence = 0.3;
  }

  // Risk score (0-100) for the legacy badge
  const risk = Math.min(100, high * 40 + med * 20 + low * 8);

  // Backwards-compat fields
  const matchedPatterns = hits.map(h => h.label);
  const drainerSignatures = hits.filter(h => h.id === "drainer" || h.id === "key-theft-code").map(h => h.label);
  const obfuscationDetected = hits.some(h => h.id === "obfuscation");
  const highRiskKeywords = hits.filter(h => h.severity !== "LOW").map(h => h.label);

  return {
    hits,
    verdict,
    confidence: Number(confidence.toFixed(2)),
    riskScore: risk,
    matchedPatterns,
    obfuscationDetected,
    drainerSignatures,
    highRiskKeywords,
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

// ── Structural risk: contributor overlap, commit entropy, fork similarity ────
//
// These are HARDER to game than star counts or commit cadence:
//   - solo-dev dominance: one author writes ≥80% of commits → fake "team"
//   - young-contributor cohort: every contributor is <60d old → brand-new sock-puppets
//   - low commit-message entropy: bot-generated "Update", "fix", "wip" loops
//   - fork-of-known: unusually small repo that's actually a fork (template scam)

export interface StructuralRiskSignals {
  topContributorShare: number;       // 0..1, share of commits by the most-active author
  soloDevDominance: boolean;         // top contributor > 80%
  contributorCount: number;
  youngContributorCohort: boolean;   // ≥3 contributors, ALL accounts < 60 days old
  commitMessageEntropy: number;      // 0..1 normalized Shannon entropy
  lowEntropyMessages: boolean;       // entropy < 0.45 with ≥10 messages
  isFork: boolean;
  parentFullName: string | null;     // owner/repo of upstream if fork
  forkOfTemplate: boolean;           // fork with low original delta (zero/near-zero stars)
  flags: string[];
}

interface ContributorBrief {
  login: string;
  contributions: number;
  accountAgeDays: number | null;     // null if unknown
}

function shannonEntropy(messages: string[]): number {
  if (messages.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const m of messages) {
    // Normalize: lowercase, collapse whitespace, strip merge/PR boilerplate
    const k = m.toLowerCase()
      .replace(/^merge (pull request|branch).*$/i, "merge")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = messages.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / total;
    h -= p * Math.log2(p);
  }
  // Normalize against the maximum possible entropy log2(N)
  const maxH = Math.log2(Math.max(2, total));
  return Math.max(0, Math.min(1, h / maxH));
}

export function detectStructuralRisk(args: {
  contributors: ContributorBrief[];
  commitMessages: string[];
  fork: boolean;
  parentFullName: string | null;
  parentStars: number | null;
  stars: number;
}): StructuralRiskSignals {
  const flags: string[] = [];
  const totalCommits = args.contributors.reduce((s, c) => s + c.contributions, 0);
  const top = args.contributors[0]?.contributions ?? 0;
  const topShare = totalCommits > 0 ? top / totalCommits : 0;
  const soloDev = totalCommits >= 10 && topShare > 0.8 && args.contributors.length <= 2;
  if (soloDev) {
    flags.push(`Single contributor wrote ${(topShare * 100).toFixed(0)}% of commits — pseudo-team risk`);
  }

  // Young-cohort check: at least 3 contributors with KNOWN ages, ALL <60 days
  const known = args.contributors.filter(c => c.accountAgeDays !== null);
  const youngCohort = known.length >= 3 && known.every(c => (c.accountAgeDays ?? 999) < 60);
  if (youngCohort) {
    flags.push(`All ${known.length} contributors are <60 days old — likely sock-puppet network`);
  }

  const entropy = shannonEntropy(args.commitMessages);
  const lowEntropy = args.commitMessages.length >= 10 && entropy < 0.45;
  if (lowEntropy) {
    flags.push(`Commit messages have low entropy (${entropy.toFixed(2)}) — copy/paste or bot-driven activity`);
  }

  const forkOfTemplate = args.fork && args.stars < 5 && (args.parentStars ?? 0) === 0;
  if (forkOfTemplate) {
    flags.push(`Fork of an obscure repo with no upstream stars — possible template-scam clone`);
  } else if (args.fork && args.parentFullName) {
    flags.push(`Fork of ${args.parentFullName} — verify upstream is the source of truth`);
  }

  return {
    topContributorShare: Number(topShare.toFixed(2)),
    soloDevDominance: soloDev,
    contributorCount: args.contributors.length,
    youngContributorCohort: youngCohort,
    commitMessageEntropy: Number(entropy.toFixed(2)),
    lowEntropyMessages: lowEntropy,
    isFork: args.fork,
    parentFullName: args.parentFullName,
    forkOfTemplate,
    flags,
  };
}

// Adjust the trust score downward for scam/anti-gaming/structural signals.
// Severity-aware: HIGH scam hits dominate, MEDIUM accumulate, LOW corroborate.
//
// Important calibration note: a brand-new legitimate project will, by
// construction, trip several "newness" signals (young owner, solo dev,
// bursty commits, low contributor count). When the scam verdict is CLEAN we
// cap the cumulative damage from these so a healthy new project doesn't
// land at 2/100 — those signals indicate "unproven", not "malicious".
export function applyTrustAdjustments(
  baseScore: number,
  scam: ScamPatterns,
  gaming: AntiGamingSignals,
  structural?: StructuralRiskSignals,
): number {
  let s = baseScore;

  // Severity-tiered scam penalties
  for (const hit of scam.hits) {
    if (hit.severity === "HIGH") s -= 30;
    else if (hit.severity === "MEDIUM") s -= 12;
    else s -= 4;
  }
  // Verdict floor: if we're highly confident this is malicious, cap the score
  if (scam.verdict === "LIKELY_MALICIOUS") s = Math.min(s, 25);
  else if (scam.verdict === "SUSPICIOUS") s = Math.min(s, 55);

  // Split structural/gaming signals into two buckets:
  //   - "newness" signals (young owner, solo dev, bursty commits) co-occur
  //     for any honest brand-new project, so we cap their stacked damage
  //     when the scam verdict is CLEAN to avoid double-penalizing newness.
  //   - "coordinated-fakery" signals (sock-puppet cohort, low-entropy bot
  //     commits, fork-of-template, organic star spikes) are strong
  //     intentional-gaming markers that should ALWAYS apply in full, even
  //     when the regex-based scam detector returned CLEAN — those are the
  //     signals that catch attackers who hand-tuned their README to evade
  //     keyword matching.
  let newnessPenalty = 0;
  if (gaming.ownerYoungAccount) newnessPenalty += 8;
  if (gaming.burstyCommits) newnessPenalty += 5;
  if (structural?.soloDevDominance) newnessPenalty += 5;

  let fakeryPenalty = 0;
  if (gaming.starsSpike) fakeryPenalty += 15;
  if (structural?.youngContributorCohort) fakeryPenalty += 18;
  if (structural?.lowEntropyMessages) fakeryPenalty += 10;
  if (structural?.forkOfTemplate) fakeryPenalty += 12;

  // Cap newness damage at -15 when scam=CLEAN — a new honest project should
  // land as "unproven", not "malicious". Once scam patterns hit, the cap is
  // removed so the signals stack normally.
  if (scam.verdict === "CLEAN") {
    newnessPenalty = Math.min(newnessPenalty, 15);
  }
  s -= (newnessPenalty + fakeryPenalty);

  return Math.max(0, Math.min(100, Math.round(s)));
}
