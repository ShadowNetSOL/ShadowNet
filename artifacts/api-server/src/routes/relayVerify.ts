import { Router } from "express";

const router = Router();

const SPOOFED_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function pickUA() {
  return SPOOFED_UAS[Math.floor(Math.random() * SPOOFED_UAS.length)];
}

// GET /relay/verify?url=<encoded>
// Fetches the target server-side and returns proof: relay IP, status, timing, page title
router.get("/relay/verify", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return res.status(400).json({ error: "Missing url parameter" });

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    if (!/^https?:\/\//i.test(targetUrl)) throw new Error("invalid protocol");
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const start = Date.now();
  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": pickUA(),
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
    });

    const latencyMs = Date.now() - start;
    const finalUrl = upstream.url || targetUrl;
    const contentType = upstream.headers.get("content-type") ?? "";
    const server = upstream.headers.get("server") ?? upstream.headers.get("x-powered-by") ?? "unknown";

    // Try to extract page title from HTML
    let pageTitle = "";
    if (contentType.includes("text/html")) {
      const text = await upstream.text();
      const m = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
      if (m) pageTitle = m[1].trim();
    }

    // Get the server's outbound IP from an IP echo service
    let relayIp = "relay-node";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(4000),
      });
      if (ipRes.ok) {
        const j = await ipRes.json() as { ip?: string };
        if (j.ip) relayIp = j.ip;
      }
    } catch { /* ignore */ }

    const parsed = new URL(finalUrl);

    return res.json({
      ok: true,
      targetUrl: finalUrl,
      targetHost: parsed.host,
      status: upstream.status,
      statusText: upstream.statusText,
      latencyMs,
      relayIp,
      server,
      contentType: contentType.split(";")[0].trim(),
      pageTitle: pageTitle || parsed.host,
      redirected: finalUrl !== targetUrl,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    const latencyMs = Date.now() - start;
    return res.status(502).json({ ok: false, error: msg, latencyMs });
  }
});

export default router;
