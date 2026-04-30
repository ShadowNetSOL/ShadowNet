/**
 * Weighted routing score — used for the fuzzy middle ground only.
 *
 * The orchestrator's hard rules (forced_remote, sticky_upgrade, very-
 * high-confidence precheck, host_history failure-rate ≥ 0.4) short-
 * circuit before this runs. They stay deterministic + auditable.
 *
 * For everything in between (precheck confidence 0.4–0.75, host
 * failure rate 0.2–0.4, mild stall history), we compute a single
 * 0..1 score and compare it against ROUTE_ESCALATE_THRESHOLD. The
 * weights are env-tunable so an operator can shift the routing without
 * a redeploy.
 *
 * Architect framing: "weights ≠ rules". This is a hybrid — rules where
 * we're certain, weights where we're not. The reason string in the
 * verdict still names the dominant factor so logs stay auditable.
 *
 * Defaults are deliberately bias-toward-escalate: misroutes hurt users
 * (they see white screens and churn); over-escalations only hurt cost.
 */
import type { ChallengeType } from "./classify";

interface Inputs {
  precheckChallenge: ChallengeType;
  precheckConfidence: number;       // 0..1
  hostFailureRate: number;           // 0..1, only meaningful with ≥3 samples
  hostSamples: number;
  /** Number of stall reports for this host within the TTL window. */
  hostStallCount?: number;
}

interface Weights {
  precheck: number;
  hostFailureRate: number;
  hostStalls: number;
  challengeBonus: number;
  threshold: number;
}

function num(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readWeights(): Weights {
  return {
    precheck:        num("ROUTE_WEIGHT_PRECHECK",          0.55),
    hostFailureRate: num("ROUTE_WEIGHT_HOST_FAILURE_RATE", 0.30),
    hostStalls:      num("ROUTE_WEIGHT_HOST_STALLS",       0.15),
    challengeBonus:  num("ROUTE_WEIGHT_CHALLENGE_BONUS",   0.10),
    threshold:       num("ROUTE_ESCALATE_THRESHOLD",       0.55),
  };
}

// Some challenge types are inherently more remote-friendly than others.
// Cloudflare-backed gates almost always pass through a real browser;
// generic soft_block is more recoverable on the proxy. We bonus-up the
// score when the challenge maps to "remote tier was literally built for
// this".
const CHALLENGE_LIFT: Record<NonNullable<ChallengeType>, number> = {
  cloudflare:   0.35,
  turnstile:    0.45,
  hcaptcha:     0.30,
  recaptcha:    0.25,
  datadome:     0.40,
  perimeterx:   0.40,
  akamai:       0.20,
  geoblock:     0.15,
  soft_block:   0.10,
  blank_render: 0.20,
  ws_blocked:   0.30,
};

export interface ScoreResult {
  score: number;
  threshold: number;
  escalate: boolean;
  /** Dominant factor in plain language — kept for log auditability so
   *  operators can grep escalations by cause even after we moved to a
   *  weighted score. */
  dominant: string;
}

/**
 * Compute a 0..1 escalation score for the gray-zone inputs.
 * Hard rules are the orchestrator's job — call this only after they've
 * fallen through.
 */
export function score(input: Inputs): ScoreResult {
  const w = readWeights();

  // Linear blend, normalised to roughly 0..1.
  const precheckTerm        = clamp01(input.precheckConfidence) * w.precheck;
  const hostFailureRateTerm = (input.hostSamples >= 3 ? clamp01(input.hostFailureRate) : 0) * w.hostFailureRate;
  const stallTerm           = stallSignal(input.hostStallCount ?? 0) * w.hostStalls;
  const lift = input.precheckChallenge ? (CHALLENGE_LIFT[input.precheckChallenge] ?? 0) * w.challengeBonus : 0;

  const score = clamp01(precheckTerm + hostFailureRateTerm + stallTerm + lift);

  // Identify the dominant signal for the log — biggest contribution.
  const contribs: Array<[string, number]> = [
    ["precheck",     precheckTerm],
    ["host_failure", hostFailureRateTerm],
    ["host_stalls",  stallTerm],
    ["challenge_lift", lift],
  ];
  contribs.sort((a, b) => b[1] - a[1]);
  const dominant = (contribs[0]?.[1] ?? 0) > 0 ? contribs[0]![0] : "none";

  return { score, threshold: w.threshold, escalate: score >= w.threshold, dominant };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Stalls: 0 → 0; 1 → 0.4; 2 → 0.7; 3+ → 1.
// Diminishing returns so a single bad load doesn't escalate forever.
function stallSignal(stalls: number): number {
  if (stalls <= 0) return 0;
  if (stalls === 1) return 0.4;
  if (stalls === 2) return 0.7;
  return 1;
}
