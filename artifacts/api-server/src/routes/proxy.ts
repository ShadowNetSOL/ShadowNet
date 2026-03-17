import { Router } from "express";
import * as cheerio from "cheerio";

const router = Router();

const ALLOWED = /^https?:\/\//i;

const STRIP_REQ = new Set([
  "host", "origin", "referer", "cookie", "authorization",
  "x-forwarded-for", "x-real-ip", "cf-connecting-ip",
]);

const STRIP_RES = new Set([
  "x-frame-options", "content-security-policy",
  "x-content-type-options", "strict-transport-security",
  "access-control-allow-origin",
]);

const SPOOFED_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function pickUA(): string {
  return SPOOFED_UAS[Math.floor(Math.random() * SPOOFED_UAS.length)];
}

// Detect the real external protocol — Replit's internal connection is always HTTP
// but the user faces HTTPS. Honour x-forwarded-proto first.
function getExternalProto(req: import("express").Request): string {
  const fwd = req.headers["x-forwarded-proto"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.protocol;
}

function buildProxyBase(req: import("express").Request): string {
  return `${getExternalProto(req)}://${req.get("host")}/api/proxy`;
}

function proxyUrl(href: string, base: string, proxyBase: string): string {
  try {
    const abs = new URL(href, base).toString();
    if (!ALLOWED.test(abs)) return href;
    return `${proxyBase}?url=${encodeURIComponent(abs)}`;
  } catch {
    return href;
  }
}

// JS snippet injected at the very top of <head> to intercept dynamic fetch/XHR
// This patches window.fetch and XMLHttpRequest so SPA API calls also route through proxy
function buildInterceptScript(proxyBase: string): string {
  return `<script id="__sn_intercept">(function(){
  var PB=${JSON.stringify(proxyBase)};
  function wrap(url){if(typeof url==='string'&&/^https?:\\/\\//.test(url)&&url.indexOf(PB)<0){return PB+'?url='+encodeURIComponent(url);}return url;}
  var _fetch=window.fetch;
  window.fetch=function(input,init){try{if(typeof input==='string')input=wrap(input);else if(input&&typeof input.url==='string'){var u=wrap(input.url);if(u!==input.url)input=new Request(u,input);}}catch(e){}return _fetch.apply(this,arguments);};
  var _open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,url){try{arguments[1]=wrap(url);}catch(e){}return _open.apply(this,arguments);};
})();</script>`;
}

function buildOverlayStyles(): string {
  return `<style id="__sn_styles">
  #__sn_bar{position:fixed;top:0;left:0;right:0;z-index:2147483647;
    background:#050505;border-bottom:1px solid rgba(57,255,20,0.3);
    display:flex;align-items:center;justify-content:space-between;
    padding:0 16px;height:40px;font-family:monospace;font-size:11px;
    color:rgba(255,255,255,0.6);box-sizing:border-box;}
  #__sn_bar .dot{width:6px;height:6px;border-radius:50%;background:#39FF14;display:inline-block;animation:snpulse 1.5s infinite;}
  #__sn_bar .label{color:rgba(57,255,20,0.9);font-weight:bold;letter-spacing:0.08em;margin-left:8px;}
  #__sn_bar .close{cursor:pointer;color:rgba(255,255,255,0.35);background:none;border:1px solid rgba(255,255,255,0.1);font-size:10px;font-family:monospace;padding:3px 8px;border-radius:4px;}
  @keyframes snpulse{0%,100%{opacity:1}50%{opacity:0.3}}
  body{padding-top:40px!important;}
  </style>`;
}

function buildOverlayHtml(): string {
  return `<div id="__sn_bar">
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="dot"></span>
      <span class="label">SHADOWNET</span>
      <span style="color:rgba(255,255,255,0.15);margin:0 4px">|</span>
      <span>IP cloaked via server relay</span>
    </div>
    <button class="close" onclick="window.close()">&#x2715; EXIT</button>
  </div>`;
}

function rewriteHtml(html: string, finalUrl: string, proxyBase: string): string {
  const $ = cheerio.load(html);

  // Inject intercept script + styles FIRST (before any other head content)
  $("head").prepend(buildOverlayStyles() + buildInterceptScript(proxyBase));

  // Inject overlay bar at top of body
  $("body").prepend(buildOverlayHtml());

  // Remove base tags that could override our URL handling
  $("base").remove();

  // Rewrite all static resource references
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      $(el).attr("href", proxyUrl(href, finalUrl, proxyBase));
    }
  });

  $("form[action]").each((_, el) => {
    const action = $(el).attr("action");
    if (action) $(el).attr("action", proxyUrl(action, finalUrl, proxyBase));
  });

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src !== "about:blank") $(el).attr("src", proxyUrl(src, finalUrl, proxyBase));
  });

  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) $(el).attr("href", proxyUrl(href, finalUrl, proxyBase));
  });

  $("img[src],source[src],video[src],audio[src],track[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.startsWith("data:")) $(el).attr("src", proxyUrl(src, finalUrl, proxyBase));
  });

  $("[data-src]").each((_, el) => {
    const src = $(el).attr("data-src");
    if (src && !src.startsWith("data:")) $(el).attr("data-src", proxyUrl(src, finalUrl, proxyBase));
  });

  $("[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") ?? "";
    const rewritten = srcset.split(",").map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return url ? [proxyUrl(url, finalUrl, proxyBase), ...rest].join(" ") : part;
    }).join(", ");
    $(el).attr("srcset", rewritten);
  });

  // Rewrite inline style background-image url() references
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    if (style.includes("url(")) {
      const updated = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_, u) => {
        if (u.startsWith("data:")) return `url(${u})`;
        return `url(${proxyUrl(u, finalUrl, proxyBase)})`;
      });
      $(el).attr("style", updated);
    }
  });

  return $.html();
}

// ── Proxy handler ────────────────────────────────────────────────────────────

router.get("/proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;

  if (!rawUrl) {
    return res.status(400).send("Missing ?url= parameter");
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    if (!ALLOWED.test(targetUrl)) throw new Error("blocked protocol");
    new URL(targetUrl);
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
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "max-age=0",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-CH-UA": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
      },
    });

    const finalUrl = upstream.url || targetUrl;

    // Friendly error page for bot-blocked or server errors
    if (upstream.status === 403 || upstream.status === 429) {
      return res.status(upstream.status).send(
        `<html><head><style>*{box-sizing:border-box}body{font-family:monospace;background:#050505;color:#fff;padding:0;margin:0}
        #bar{position:fixed;top:0;left:0;right:0;height:40px;background:#050505;border-bottom:1px solid rgba(57,255,20,0.3);display:flex;align-items:center;padding:0 16px;gap:8px;font-size:11px;}
        .dot{width:6px;height:6px;border-radius:50%;background:#39FF14;animation:p 1.5s infinite;}
        @keyframes p{0%,100%{opacity:1}50%{opacity:0.3}}
        .label{color:rgba(57,255,20,0.9);font-weight:bold;letter-spacing:0.08em}
        .wrap{padding:80px 40px 40px;max-width:560px;margin:0 auto}
        h2{color:#39FF14;font-size:18px;margin:0 0 12px}
        p{color:rgba(255,255,255,0.5);font-size:12px;line-height:1.8;margin:0 0 8px}
        .url{color:rgba(255,255,255,0.25);word-break:break-all;font-size:10px;margin-bottom:24px}
        .tag{display:inline-block;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);color:#8B5CF6;padding:2px 8px;border-radius:4px;font-size:9px;letter-spacing:0.08em;margin-bottom:16px}
        ul{color:rgba(255,255,255,0.4);font-size:11px;line-height:2;padding-left:16px}
        li span{color:#39FF14}
        .btn{display:inline-block;margin-top:24px;padding:10px 20px;background:#39FF14;color:#000;font-family:monospace;font-weight:bold;font-size:11px;border:none;cursor:pointer;border-radius:6px;text-decoration:none;letter-spacing:0.05em}
        </style></head><body>
        <div id="bar"><span class="dot"></span><span class="label">SHADOWNET</span><span style="color:rgba(255,255,255,0.15)">|</span><span style="color:rgba(255,255,255,0.4)">Relay active &mdash; IP masked</span></div>
        <div class="wrap">
          <div class="tag">${upstream.status === 429 ? "RATE LIMITED" : "ACCESS BLOCKED"}</div>
          <h2>${upstream.status === 429 ? "Rate Limit Hit" : "Site Blocked Server Access"}</h2>
          <p class="url">${finalUrl}</p>
          <p>${upstream.status === 429 ? "This site is temporarily rate-limiting our server." : "This site uses Cloudflare or similar bot-protection that blocks server-side fetching. Your IP was still never exposed — the block happened at our relay node."}</p>
          <p style="margin-top:16px;color:rgba(255,255,255,0.3);font-size:11px">Sites that typically work through the relay:</p>
          <ul>
            <li><span>solana.com</span> — Solana Foundation</li>
            <li><span>solscan.io/token/&lt;address&gt;</span> — Token explorer</li>
            <li><span>birdeye.so</span> — Price charts</li>
            <li><span>pump.fun</span> — Token launches</li>
            <li><span>jup.ag</span> — Jupiter DEX</li>
            <li><span>raydium.io</span> — Raydium DEX</li>
          </ul>
          <button class="btn" onclick="window.close()">CLOSE RELAY</button>
        </div>
        </body></html>`
      );
    }

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (!STRIP_RES.has(k) && k !== "transfer-encoding" && k !== "content-encoding") {
        res.setHeader(key, value);
      }
    });

    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const contentType = upstream.headers.get("content-type") ?? "";
    const proxyBase = buildProxyBase(req);

    if (contentType.includes("text/html")) {
      const text = await upstream.text();
      const rewritten = rewriteHtml(text, finalUrl, proxyBase);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(rewritten, "utf-8").toString());
      res.send(rewritten);

    } else if (contentType.includes("text/css")) {
      let css = await upstream.text();
      css = css.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_, u) => {
        if (u.startsWith("data:")) return `url(${u})`;
        return `url(${proxyUrl(u, finalUrl, proxyBase)})`;
      });
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.send(css);

    } else if (contentType.includes("javascript") || contentType.includes("ecmascript")) {
      // Pass JS through as-is — dynamic URLs are handled by the injected fetch interceptor
      const buf = await upstream.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(buf));

    } else {
      const buf = await upstream.arrayBuffer();
      if (contentType) res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(buf));
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const isTimeout = msg.includes("timeout") || msg.includes("TimeoutError");
    const code = isTimeout ? 504 : 502;
    const label = isTimeout ? "Gateway Timeout" : "Proxy Error";
    res.status(code).send(
      `<html><head><style>body{font-family:monospace;background:#050505;color:#39FF14;padding:40px;margin:0}</style></head><body><h2>${label}</h2><p>${msg}</p><p><a href="javascript:history.back()" style="color:#8B5CF6">← Go back</a></p></body></html>`
    );
  }
});

export default router;
