/**
 * Stall report endpoint.
 *
 * The UV inject hook posts a verdict to the shell after page load; the
 * shell forwards it here so the orchestrator's per-host failure history
 * picks up soft-blocks and JS-loop traps the response-side classifier
 * can't see (those signals only exist client-side).
 *
 * No bodies, no headers, no IPs — just hostname + verdict label. Any
 * caller can post; rate-limited at the app level.
 */
import { Router, type IRouter } from "express";
import { recordHostFailure, recordHostSuccess } from "../lib/hostHistory";
import type { Verdict } from "../lib/classify";
import { bump } from "../lib/metrics";

const router: IRouter = Router();

const VALID = new Set(["ok", "hard_stall", "soft_block", "js_loop_block"]);

router.post("/session/stall-report", (req, res) => {
  const body = (req.body ?? {}) as { host?: string; verdict?: string; longTaskMs?: number; retried?: boolean };
  const host = typeof body.host === "string" ? body.host.toLowerCase().slice(0, 253) : "";
  const verdict = body.verdict;
  if (!host || !verdict || !VALID.has(verdict)) {
    res.status(400).json({ error: "bad_report" });
    return;
  }

  bump("stall_reports_total");
  if (body.retried) bump("stall_retried_total");
  if (body.retried && verdict === "ok") bump("stall_retried_recovered");

  if (verdict === "ok") {
    recordHostSuccess(host);
  } else {
    // Map client verdicts onto the orchestrator's challenge taxonomy.
    const v: Verdict = {
      challenge: verdict === "js_loop_block" ? "soft_block" : "blank_render",
      reason: verdict === "js_loop_block" ? "no_html_no_redirect" : "no_html_no_redirect",
      // Long-task verdicts are noisier; keep confidence below the
      // escalation threshold so a single bad load doesn't flip the host.
      // Repeat reports compound naturally via failureRate().
      confidence: verdict === "hard_stall" ? 0.7 : 0.55,
      recommendation: "warn",
    };
    recordHostFailure(host, v);
  }

  res.status(204).end();
});

export default router;
