/**
 * Admin / operator endpoints.
 *
 *   GET /admin/metrics   → counters snapshot (escalation %, warm-pool hit, stall recovery)
 *   POST /admin/reset    → zero the counters (after a deploy or experiment)
 *
 * Bearer auth via ADMIN_TOKEN env. Without the env, every call returns
 * 503 — the dashboard is opt-in, not exposed by accident.
 */
import { Router, type IRouter } from "express";
import { snapshot, reset } from "../lib/metrics";

const router: IRouter = Router();

function authorised(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) return false;
  const hdr = req.headers["authorization"];
  const got = Array.isArray(hdr) ? hdr[0] : hdr;
  if (!got || !got.toLowerCase().startsWith("bearer ")) return false;
  return got.slice(7).trim() === expected;
}

router.get("/admin/metrics", (req, res) => {
  if (!process.env["ADMIN_TOKEN"]) { res.status(503).json({ error: "admin_disabled" }); return; }
  if (!authorised(req)) { res.status(401).json({ error: "unauthorized" }); return; }
  res.json(snapshot());
});

router.post("/admin/reset", (req, res) => {
  if (!process.env["ADMIN_TOKEN"]) { res.status(503).json({ error: "admin_disabled" }); return; }
  if (!authorised(req)) { res.status(401).json({ error: "unauthorized" }); return; }
  reset();
  res.status(204).end();
});

export default router;
