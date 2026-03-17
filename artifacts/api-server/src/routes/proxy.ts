import { Router } from "express";
import * as cheerio from "cheerio";

const router = Router();

const ALLOWED = /^https?:\/\//i;

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

// Injected FIRST in <head>. Intercepts every possible resource load path:
//  1. window.location spoof → SPA routers (Next.js App Router) see the real site URL
//  2. fetch() / XHR patch → dynamic API calls
//  3. Element.setAttribute('src'/'href') patch → dynamic <script>/<link> injection
//  4. HTMLScriptElement.src / HTMLLinkElement.href property setters → webpack chunk loader
// Together these prevent Next.js dynamic imports from bypassing the relay.
function buildInterceptScript(proxyBase: string, targetOrigin: string, targetHref: string): string {
  const pb = JSON.stringify(proxyBase);
  const to = JSON.stringify(targetOrigin);
  const th = JSON.stringify(targetHref);
  const targetUrl = new URL(targetHref);
  const tPathname = JSON.stringify(targetUrl.pathname || "/");
  const tSearch = JSON.stringify(targetUrl.search || "");
  const tHash = JSON.stringify(targetUrl.hash || "");
  const tHost = JSON.stringify(targetUrl.host);
  const tHostname = JSON.stringify(targetUrl.hostname);
  const tProtocol = JSON.stringify(targetUrl.protocol);
  return `<script id="__sn_intercept">(function(){
var PB=${pb},TO=${to},TH=${th};
/* ── 1. Location spoof — lets SPA routers see the real site URL ── */
try{
  var fL={href:TH,origin:TO,protocol:${tProtocol},host:${tHost},hostname:${tHostname},
    port:'',pathname:${tPathname},search:${tSearch},hash:${tHash},
    toString:function(){return TH;},assign:function(){},replace:function(){},reload:function(){}};
  Object.defineProperty(window,'location',{get:function(){return fL;},configurable:true});
}catch(e){}
/* ── 2. URL wrap — routes all requests through relay ── */
function wrap(u){
  if(!u||typeof u!=='string')return u;
  if(u.indexOf(PB)>=0)return u;
  var p=u.slice(0,5);
  if(p==='data:'||p==='blob:'||u.slice(0,11)==='javascript:'||u[0]==='#')return u;
  try{
    var a;
    if(/^https?:\\/\\//.test(u)){a=u;}
    else if(u.slice(0,2)==='//'){a='https:'+u;}
    else{a=new URL(u,TO).toString();}
    if(a.indexOf(PB)>=0)return u;
    return PB+'?url='+encodeURIComponent(a);
  }catch(e){return u;}
}
/* ── 3. Patch fetch ── */
var _f=window.fetch;
window.fetch=function(input,init){
  try{
    if(typeof input==='string'){input=wrap(input);}
    else if(input instanceof Request){var wu=wrap(input.url);if(wu!==input.url)input=new Request(wu,input);}
  }catch(e){}
  return _f.apply(this,arguments);
};
/* ── 4. Patch XHR ── */
var _x=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){
  try{if(u)arguments[1]=wrap(String(u));}catch(e){}
  return _x.apply(this,arguments);
};
/* ── 5. Patch document.createElement to intercept dynamic script/link src ── */
var _ce=document.createElement.bind(document);
document.createElement=function(tag){
  var el=_ce(tag);
  var t=typeof tag==='string'?tag.toLowerCase():'';
  if(t==='script'||t==='link'||t==='img'){
    var attr=t==='link'?'href':'src';
    var orig=Object.getOwnPropertyDescriptor(el.__proto__,attr)||Object.getOwnPropertyDescriptor(HTMLElement.prototype,attr);
    if(orig&&orig.set){
      Object.defineProperty(el,attr,{
        get:function(){return orig.get?orig.get.call(el):'';},
        set:function(v){orig.set.call(el,wrap(v));},
        configurable:true
      });
    }
  }
  return el;
};
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

function blockedPage(status: number, finalUrl: string): string {
  const isRate = status === 429;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{font-family:monospace;background:#050505;color:#fff;padding:0;margin:0}
#bar{position:fixed;top:0;left:0;right:0;height:40px;background:#050505;border-bottom:1px solid rgba(57,255,20,0.3);display:flex;align-items:center;padding:0 16px;gap:8px;font-size:11px;}
.dot{width:6px;height:6px;border-radius:50%;background:#39FF14;animation:p 1.5s infinite;}@keyframes p{0%,100%{opacity:1}50%{opacity:0.3}}
.wrap{padding:80px 40px 40px;max-width:560px;margin:0 auto}
h2{color:#39FF14;font-size:18px;margin:0 0 12px}
p{color:rgba(255,255,255,0.5);font-size:12px;line-height:1.8;margin:0 0 8px}
.tag{display:inline-block;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);color:#8B5CF6;padding:2px 8px;border-radius:4px;font-size:9px;letter-spacing:0.08em;margin-bottom:16px}
ul{color:rgba(255,255,255,0.4);font-size:11px;line-height:2;padding-left:16px}li span{color:#39FF14}
.btn{margin-top:24px;padding:10px 20px;background:#39FF14;color:#000;font-family:monospace;font-weight:bold;font-size:11px;border:none;cursor:pointer;border-radius:6px;letter-spacing:0.05em}
</style></head><body>
<div id="bar"><span class="dot"></span><b style="color:rgba(57,255,20,0.9);letter-spacing:0.08em">SHADOWNET</b><span style="color:rgba(255,255,255,0.15)">|</span><span style="color:rgba(255,255,255,0.4)">Relay active — IP masked</span></div>
<div class="wrap">
  <div class="tag">${isRate ? "RATE LIMITED" : "ACCESS BLOCKED"}</div>
  <h2>${isRate ? "Rate Limit Hit" : "Site Blocked Server Access"}</h2>
  <p style="color:rgba(255,255,255,0.2);font-size:10px;word-break:break-all;margin-bottom:16px">${finalUrl}</p>
  <p>${isRate ? "This site is temporarily rate-limiting our relay server. Try again in a few seconds." : "This site uses Cloudflare bot-protection that blocks server IPs. Your real IP was <b style='color:#39FF14'>never exposed</b> — the block happened at our relay node, not your device."}</p>
  <p style="margin-top:20px;color:rgba(255,255,255,0.25);font-size:11px">Sites that work well through the relay:</p>
  <ul>
    <li><span>solana.com</span></li>
    <li><span>solscan.io</span> — paste /token/&lt;address&gt;</li>
    <li><span>birdeye.so</span></li>
    <li><span>jup.ag</span></li>
    <li><span>raydium.io</span></li>
    <li><span>phantom.app</span></li>
  </ul>
  <button class="btn" onclick="window.close()">CLOSE RELAY</button>
</div></body></html>`;
}

function rewriteHtml(html: string, finalUrl: string, proxyBase: string): string {
  const parsed = new URL(finalUrl);
  const targetOrigin = `${parsed.protocol}//${parsed.host}`;

  const $ = cheerio.load(html);

  // Inject intercept script + styles FIRST — must run before any page JS
  $("head").prepend(buildOverlayStyles() + buildInterceptScript(proxyBase, targetOrigin, finalUrl));

  // Inject overlay bar into body
  $("body").prepend(buildOverlayHtml());

  // Remove any existing base tags (they'd conflict with our absolute proxy URLs)
  $("base").remove();

  const rw = (href: string) => proxyUrl(href, finalUrl, proxyBase);

  $("a[href]").each((_, el) => {
    const v = $(el).attr("href") ?? "";
    if (!v.startsWith("#") && !v.startsWith("javascript:") && !v.startsWith("mailto:") && !v.startsWith("tel:")) {
      $(el).attr("href", rw(v));
    }
  });

  $("form[action]").each((_, el) => {
    const v = $(el).attr("action");
    if (v) $(el).attr("action", rw(v));
  });

  $("script[src]").each((_, el) => {
    const v = $(el).attr("src");
    if (v && v !== "about:blank") $(el).attr("src", rw(v));
  });

  $("link[href]").each((_, el) => {
    const v = $(el).attr("href");
    if (v) $(el).attr("href", rw(v));
  });

  $("img[src],source[src],video[src],audio[src],track[src]").each((_, el) => {
    const v = $(el).attr("src");
    if (v && !v.startsWith("data:") && !v.startsWith("blob:")) $(el).attr("src", rw(v));
  });

  $("[data-src]").each((_, el) => {
    const v = $(el).attr("data-src");
    if (v && !v.startsWith("data:")) $(el).attr("data-src", rw(v));
  });

  $("[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") ?? "";
    const rewritten = srcset.split(",").map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return url ? [rw(url), ...rest].join(" ") : part;
    }).join(", ");
    $(el).attr("srcset", rewritten);
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    if (style.includes("url(")) {
      $(el).attr("style", style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_, u) => {
        if (u.startsWith("data:") || u.startsWith("blob:")) return `url(${u})`;
        return `url(${rw(u)})`;
      }));
    }
  });

  return $.html();
}

// ── Main proxy handler ────────────────────────────────────────────────────────

router.get("/proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;

  if (!rawUrl) return res.status(400).send("Missing ?url= parameter");

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
      signal: AbortSignal.timeout(20000),
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

    if (upstream.status === 403 || upstream.status === 429 || upstream.status === 530 || upstream.status === 1009) {
      return res.status(upstream.status).send(blockedPage(upstream.status, finalUrl));
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
      return res.send(rewritten);
    }

    if (contentType.includes("text/css")) {
      let css = await upstream.text();
      css = css.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (_, u) => {
        if (u.startsWith("data:") || u.startsWith("blob:")) return `url(${u})`;
        return `url(${proxyUrl(u, finalUrl, proxyBase)})`;
      });
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      return res.send(css);
    }

    // Everything else (JS, JSON, images, fonts, binary) — stream as-is
    const buf = await upstream.arrayBuffer();
    if (contentType) res.setHeader("Content-Type", contentType);
    return res.send(Buffer.from(buf));

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const isTimeout = msg.includes("timeout") || msg.includes("TimeoutError");
    const code = isTimeout ? 504 : 502;
    const label = isTimeout ? "Gateway Timeout" : "Proxy Error";
    return res.status(code).send(
      `<!DOCTYPE html><html><head><style>body{font-family:monospace;background:#050505;color:#39FF14;padding:40px;margin:0}</style></head><body><h2>${label}</h2><p style="color:rgba(255,255,255,0.5)">${msg}</p><p><a href="javascript:window.close()" style="color:#8B5CF6">← Close</a></p></body></html>`
    );
  }
});

export default router;
