/**
 * Relay region listing + connect.
 *
 * No more mock node list. The catalog comes from env (see lib/regions.ts).
 * The response shape stays compatible with the existing zod schema
 * (GetRelayNodesResponse) so the frontend doesn't need a coordinated
 * deploy. ipAddress is intentionally a placeholder — we never expose the
 * server's real IP to the client; the proxy hides it server-side.
 */
import { Router, type IRouter } from "express";
import { GetRelayNodesResponse, ConnectToRelayNodeResponse } from "@workspace/api-zod";
import { getRegions, getRegion, uptimePct } from "../lib/regions";

const router: IRouter = Router();

const loadAvg = (): number => {
  // Best-effort: derive a 0-100 load number from process CPU time delta.
  // Without OS-level metrics this is approximate; good enough for UI.
  const u = process.cpuUsage();
  const total = (u.user + u.system) / 1_000_000;
  const elapsed = process.uptime() || 1;
  return Math.min(95, Math.round((total / elapsed) * 100));
};

router.get("/relay/nodes", (_req, res) => {
  const regions = getRegions();
  const uptime = uptimePct();
  const load = loadAvg();

  const nodes = regions.map((r, idx) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    city: r.city,
    ipAddress: `${r.countryCode}/${r.id}`,
    latencyMs: 0,
    uptime,
    status: r.status,
    audited: false,
    noLogs: r.noLogs,
    load: idx === 0 ? load : Math.max(5, Math.round(load * 0.7)),
  }));

  const data = GetRelayNodesResponse.parse({
    nodes,
    totalCount: nodes.length,
    onlineCount: nodes.filter((n) => n.status === "online").length,
  });
  res.json(data);
});

router.post("/relay/nodes/:nodeId/connect", (req, res) => {
  const region = getRegion(req.params.nodeId);
  if (!region) {
    res.status(404).json({ error: "not_found", message: "Unknown region" });
    return;
  }
  if (region.status !== "online") {
    res.status(400).json({ error: "unavailable", message: `${region.name} is ${region.status}` });
    return;
  }

  const data = ConnectToRelayNodeResponse.parse({
    sessionId: `sn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    nodeId: region.id,
    connectedAt: new Date().toISOString(),
    maskedIp: `${region.countryCode}-${region.id}`,
    status: "connected",
  });
  res.json(data);
});

export default router;
