/**
 * Lightweight in-memory metrics.
 *
 * Tracks the trio the architect flagged as the post-launch tuning
 * dashboard:
 *
 *   escalations_total / sessions_total      = % escalated
 *   escalations_succeeded / escalations_total = % escalations that succeed
 *   stall_retried_recovered / stall_retried_total = % users who retry
 *                                                   before escalating
 *
 * Plus warm-pool hit-rate so we know when to bump the pool size.
 *
 * Counters are process-local. /api/admin/metrics surfaces them behind
 * an ADMIN_TOKEN bearer; an operator scrapes it on whatever cadence
 * they want. No IPs, no PII, no per-user data — just totals.
 */

interface Counters {
  sessions_total: number;
  proxy_sessions_total: number;
  remote_sessions_total: number;

  escalations_total: number;       // remote routing decisions
  escalations_succeeded: number;   // returned an available remote session
  escalations_no_capacity: number; // pool said no
  escalations_no_entitlement: number; // user wasn't a holder

  stall_reports_total: number;
  stall_retried_total: number;     // came back with retried=true
  stall_retried_recovered: number; // verdict=ok after retry

  warm_pool_hits: number;
  warm_pool_misses: number;        // pool created a session that took >2s

  rotate_requests: number;
  holder_claims_issued: number;
}

const counters: Counters = {
  sessions_total: 0, proxy_sessions_total: 0, remote_sessions_total: 0,
  escalations_total: 0, escalations_succeeded: 0, escalations_no_capacity: 0, escalations_no_entitlement: 0,
  stall_reports_total: 0, stall_retried_total: 0, stall_retried_recovered: 0,
  warm_pool_hits: 0, warm_pool_misses: 0,
  rotate_requests: 0, holder_claims_issued: 0,
};

const startedAt = Date.now();

export function bump(key: keyof Counters, by = 1): void { counters[key] += by; }

export function snapshot(): Record<string, number | string> {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  const denom = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100);
  return {
    uptime_sec: uptimeSec,
    ...counters,
    pct_escalated:           denom(counters.escalations_total,        counters.sessions_total),
    pct_escalation_success:  denom(counters.escalations_succeeded,    counters.escalations_total),
    pct_stall_recovered:     denom(counters.stall_retried_recovered,  counters.stall_retried_total),
    pct_warm_pool_hit:       denom(counters.warm_pool_hits,           counters.warm_pool_hits + counters.warm_pool_misses),
  };
}

/** Reset — operator-controlled, never auto. */
export function reset(): void {
  for (const k of Object.keys(counters) as Array<keyof Counters>) counters[k] = 0;
}
