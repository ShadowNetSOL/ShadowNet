import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Duplex } from "node:stream";
import express from "express";
import app from "./app";
import {
  isBareRequest,
  routeBareRequest,
  routeBareUpgrade,
} from "./proxyServer";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Serve the built frontend (Vite output) from the same Railway service.
// In production builds this directory is copied next to the bundled server.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production __dirname is artifacts/api-server/dist and the build step
// copies the frontend into dist/public. STATIC_DIR can override for dev.
const STATIC_DIR =
  process.env["STATIC_DIR"] ?? path.resolve(__dirname, "public");

app.use(
  express.static(STATIC_DIR, {
    index: "index.html",
    setHeaders: (res) => {
      // Strip framework fingerprints
      res.removeHeader("X-Powered-By");
      // SPA assets — let the SW take over for anything under /service/
      res.setHeader("Referrer-Policy", "no-referrer");
    },
  }),
);

// SPA fallback. /api and /bare are handled before this; /service is served
// by index.html so the SW can boot and re-handle the navigation.
app.get(/^\/(?!api\/|bare\/).*/, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

const server = createServer((req, res) => {
  // Hide framework identity at the lowest layer
  res.removeHeader?.("X-Powered-By");

  if (req.url && isBareRequest(req)) {
    routeBareRequest(req, res);
    return;
  }
  app(req, res);
});

server.on("upgrade", (req, socket: Duplex, head) => {
  if (req.url && isBareRequest(req)) {
    routeBareUpgrade(req, socket, head);
    return;
  }
  socket.end();
});

server.listen(port, () => {
  console.log(`ShadowNet listening on :${port}`);
});
