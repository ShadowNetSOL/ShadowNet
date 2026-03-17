import { Router } from "express";
import * as cheerio from "cheerio";

const router = Router();

// Allowed protocols
const ALLOWED = /^https?:\/\//i;

// Headers to strip from outgoing requests (don't expose user identity)
const STRIP_REQ = new Set([
  "host", "origin", "referer", "cookie", "authorization",
  "x-forwarded-for", "x-real-ip", "cf-connecting-ip",
]);

// Headers to strip from incoming responses
const STRIP_RES = new Set([
  "x-frame-options", "content-security-policy",
  "x-content-type-options", "strict-transport-security",
  "access-control-allow-origin",
]);

const SPOOFED_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function pickUA(): string {
  return SPOOFED_UAS[Math.floor(Math.random() * SPOOFED_UAS.length)];
}

// Build a proxied version of a URL relative to base
function proxyUrl(href: string, base: string, proxyBase: string): string {
  try {
    const abs = new URL(href, base).toString();
    if (!ALLOWED.test(abs)) return href;
    return `${proxyBase}?url=${encodeURIComponent(abs)}`;
  } catch {
    return href;
  }
}

// Rewrite HTML so all links/assets go through the proxy
function rewriteHtml(html: string, base: string, proxyBase: string): string {
  const $ = cheerio.load(html);

  // Inject base tag + overlay UI
  $("head").prepend(`
    <base href="${base}">
    <style id="__shadownet_bar">
      #__sn_bar {
        position:fixed;top:0;left:0;right:0;z-index:2147483647;
        background:#050505;border-bottom:1px solid rgba(57,255,20,0.3);
        display:flex;align-items:center;justify-content:space-between;
        padding:0 16px;height:44px;font-family:monospace;font-size:11px;
        color:rgba(255,255,255,0.6);
      }
      #__sn_bar .dot { width:6px;height:6px;border-radius:50%;background:#39FF14;animation:pulse 1.5s infinite; }
      #__sn_bar .ip { color:#39FF14;font-weight:bold; }
      #__sn_bar .close { cursor:pointer;color:rgba(255,255,255,0.3);background:none;border:none;font-size:14px; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      body { margin-top:44px !important; }
    </style>
  `);
  $("body").prepend(`
    <div id="__sn_bar">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="dot"></span>
        <span style="color:rgba(57,255,20,0.8);font-weight:bold;letter-spacing:0.1em;">SHADOWNET</span>
        <span style="color:rgba(255,255,255,0.2)">|</span>
        <span>IP cloaked via server relay</span>
      </div>
      <button class="close" onclick="history.back()">✕ EXIT</button>
    </div>
  `);

  // Rewrite links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
      $(el).attr("href", proxyUrl(href, base, proxyBase));
    }
  });

  // Rewrite form actions
  $("form[action]").each((_, el) => {
    const action = $(el).attr("action");
    if (action) $(el).attr("action", proxyUrl(action, base, proxyBase));
  });

  // Rewrite script src
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) $(el).attr("src", proxyUrl(src, base, proxyBase));
  });

  // Rewrite link href (CSS, etc.)
  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) $(el).attr("href", proxyUrl(href, base, proxyBase));
  });

  // Rewrite img, source, iframe src
  $("img[src],source[src],iframe[src],video[src],audio[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) $(el).attr("src", proxyUrl(src, base, proxyBase));
  });

  // Rewrite srcset
  $("[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") ?? "";
    const rewritten = srcset.split(",").map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return [proxyUrl(url, base, proxyBase), ...rest].join(" ");
    }).join(", ");
    $(el).attr("srcset", rewritten);
  });

  return $.html();
}

// ── Main proxy handler ─────────────────────────────────────────────────────

router.get("/proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;

  if (!rawUrl) {
    return res.status(400).send("Missing ?url= parameter");
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    if (!ALLOWED.test(targetUrl)) throw new Error("blocked protocol");
    new URL(targetUrl); // validate
  } catch {
    return res.status(400).send("Invalid or disallowed URL");
  }

  try {
    const ua = pickUA();
    const upstream = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "identity",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    // Determine final URL after redirects
    const finalUrl = upstream.url || targetUrl;
    const parsed = new URL(finalUrl);
    const base = `${parsed.protocol}//${parsed.host}`;

    // Forward status
    res.status(upstream.status);

    // Forward safe headers
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (!STRIP_RES.has(k) && k !== "transfer-encoding" && k !== "content-encoding") {
        res.setHeader(key, value);
      }
    });

    // Allow framing from our domain
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("text/html")) {
      const text = await upstream.text();
      const proxyBase = `${req.protocol}://${req.get("host")}/api/proxy`;
      const rewritten = rewriteHtml(text, finalUrl, proxyBase);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(rewritten);
    } else if (contentType.includes("text/css")) {
      // Rewrite CSS url() references
      let css = await upstream.text();
      const proxyBase = `${req.protocol}://${req.get("host")}/api/proxy`;
      css = css.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_, u) => {
        return `url(${proxyUrl(u, finalUrl, proxyBase)})`;
      });
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.send(css);
    } else {
      // Binary / other — stream directly
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      return res.status(504).send(`<html><body style="font-family:monospace;background:#050505;color:#39FF14;padding:40px"><h2>Gateway Timeout</h2><p>The target site took too long to respond.</p></body></html>`);
    }
    console.error("proxy error", err);
    res.status(502).send(`<html><body style="font-family:monospace;background:#050505;color:#39FF14;padding:40px"><h2>Proxy Error</h2><p>${msg}</p></body></html>`);
  }
});

export default router;
