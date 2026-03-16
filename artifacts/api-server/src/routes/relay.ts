import { Router, type IRouter } from "express";
import { GetRelayNodesResponse, ConnectToRelayNodeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const RELAY_NODES = [
  { id: "node-01", name: "Shadow Alpha", country: "Switzerland", city: "Zurich", ipAddress: "185.220.101.x", latencyMs: 12, uptime: 99.8, status: "online" as const, audited: true, noLogs: true, load: 23 },
  { id: "node-02", name: "Phantom Node", country: "Netherlands", city: "Amsterdam", ipAddress: "185.220.102.x", latencyMs: 18, uptime: 99.5, status: "online" as const, audited: true, noLogs: true, load: 41 },
  { id: "node-03", name: "Ghost Relay", country: "Iceland", city: "Reykjavik", ipAddress: "37.120.141.x", latencyMs: 31, uptime: 98.9, status: "online" as const, audited: true, noLogs: true, load: 17 },
  { id: "node-04", name: "Cipher Hub", country: "Romania", city: "Bucharest", ipAddress: "185.220.103.x", latencyMs: 24, uptime: 99.1, status: "online" as const, audited: true, noLogs: true, load: 58 },
  { id: "node-05", name: "Void Gate", country: "Germany", city: "Frankfurt", ipAddress: "195.176.3.x", latencyMs: 9, uptime: 99.9, status: "online" as const, audited: true, noLogs: true, load: 72 },
  { id: "node-06", name: "Nexus Shadow", country: "Singapore", city: "Singapore", ipAddress: "45.142.212.x", latencyMs: 67, uptime: 97.3, status: "online" as const, audited: true, noLogs: true, load: 34 },
  { id: "node-07", name: "Specter Node", country: "Canada", city: "Toronto", ipAddress: "198.54.132.x", latencyMs: 89, uptime: 98.1, status: "online" as const, audited: false, noLogs: true, load: 19 },
  { id: "node-08", name: "Dark Relay", country: "Japan", city: "Tokyo", ipAddress: "185.220.104.x", latencyMs: 122, uptime: 99.0, status: "online" as const, audited: true, noLogs: true, load: 44 },
  { id: "node-09", name: "Wraith Point", country: "Sweden", city: "Stockholm", ipAddress: "185.220.105.x", latencyMs: 22, uptime: 96.5, status: "maintenance" as const, audited: true, noLogs: true, load: 0 },
  { id: "node-10", name: "Veil Node", country: "Australia", city: "Sydney", ipAddress: "103.252.118.x", latencyMs: 148, uptime: 94.2, status: "offline" as const, audited: true, noLogs: true, load: 0 },
  { id: "node-11", name: "Mirage Gate", country: "Austria", city: "Vienna", ipAddress: "185.220.106.x", latencyMs: 16, uptime: 99.7, status: "online" as const, audited: true, noLogs: true, load: 29 },
  { id: "node-12", name: "Null Route", country: "Luxembourg", city: "Luxembourg", ipAddress: "185.220.107.x", latencyMs: 14, uptime: 99.6, status: "online" as const, audited: true, noLogs: true, load: 55 },
];

function randomMaskedIp(): string {
  const octets = [
    Math.floor(Math.random() * 200) + 10,
    Math.floor(Math.random() * 254) + 1,
    Math.floor(Math.random() * 254) + 1,
    Math.floor(Math.random() * 254) + 1,
  ];
  return octets.join(".");
}

router.get("/relay/nodes", (_req, res) => {
  const online = RELAY_NODES.filter((n) => n.status === "online").length;
  const data = GetRelayNodesResponse.parse({
    nodes: RELAY_NODES,
    totalCount: RELAY_NODES.length,
    onlineCount: online,
  });
  res.json(data);
});

router.post("/relay/nodes/:nodeId/connect", (req, res) => {
  const { nodeId } = req.params;
  const node = RELAY_NODES.find((n) => n.id === nodeId);

  if (!node) {
    res.status(404).json({ error: "not_found", message: `Node ${nodeId} not found` });
    return;
  }

  if (node.status !== "online") {
    res.status(400).json({ error: "unavailable", message: `Node ${node.name} is currently ${node.status}` });
    return;
  }

  const data = ConnectToRelayNodeResponse.parse({
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    connectedAt: new Date().toISOString(),
    maskedIp: randomMaskedIp(),
    status: "connected",
  });

  res.json(data);
});

export default router;
