/* global Ultraviolet */
/**
 * Ultraviolet runtime config. Loaded by uv.sw.js (the service worker) and by
 * the page-side handler script. Defines:
 *   - prefix:    URL path the SW intercepts
 *   - bare:      bare-server endpoint (same-origin /bare/)
 *   - encodeUrl: how the page encodes destination URLs into /service/<x>
 *   - codec:     XOR with key 2 — fast, deterministic, reversible.
 *   - inject:    per-page identity shim. Spoofs navigator surfaces, blocks
 *                IP leaks, denoises canvas/WebGL/audio, exposes a
 *                WalletConnect-backed window.solana so Solana dApps work.
 *
 * The shim runs synchronously before the page's own scripts because UV
 * inserts it as the first child of <head>. Anything async here will lose
 * the race on sites that read fingerprint surfaces in their first inline
 * script (pump.fun, dexscreener, exchange logins).
 */
self.__uv$config = {
  prefix: "/service/",
  bare: "/bare/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js",
  inject: `
    (function(){
      try {
        var fp = null;
        try { fp = JSON.parse(localStorage.getItem("__sn_fp") || "null"); } catch(e){}
        // Even without a stored fingerprint, the IP-leak blockers below run.

        // ── navigator surfaces ────────────────────────────────────────────
        function def(obj, key, getter){
          try { Object.defineProperty(obj, key, { get: getter, configurable: true }); } catch(e){}
        }
        if (fp) {
          if (fp.userAgent) def(navigator, "userAgent", function(){ return fp.userAgent; });
          if (fp.platform)  def(navigator, "platform",  function(){ return fp.platform; });
          if (fp.language)  def(navigator, "language",  function(){ return fp.language; });
          if (fp.languages) def(navigator, "languages", function(){ return fp.languages; });
          if (fp.uaPlatform && navigator.userAgentData) {
            // sec-ch-ua-platform comes from userAgentData.platform.
            try {
              def(navigator.userAgentData, "platform", function(){ return fp.uaPlatform; });
              var _ghv = navigator.userAgentData.getHighEntropyValues
                && navigator.userAgentData.getHighEntropyValues.bind(navigator.userAgentData);
              if (_ghv) {
                navigator.userAgentData.getHighEntropyValues = function(hints){
                  return _ghv(hints).then(function(v){
                    v.platform = fp.uaPlatform;
                    if (fp.userAgent) {
                      var m = /Chrome\\/(\\d+)/.exec(fp.userAgent);
                      if (m) v.uaFullVersion = m[1] + ".0.0.0";
                    }
                    return v;
                  });
                };
              }
            } catch(e){}
          }
          if (fp.screenResolution) {
            var parts = String(fp.screenResolution).split("x").map(function(n){ return parseInt(n,10); });
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              def(screen, "width",       function(){ return parts[0]; });
              def(screen, "height",      function(){ return parts[1]; });
              def(screen, "availWidth",  function(){ return parts[0]; });
              def(screen, "availHeight", function(){ return parts[1] - 40; });
            }
          }
          if (fp.colorDepth) {
            def(screen, "colorDepth", function(){ return fp.colorDepth; });
            def(screen, "pixelDepth", function(){ return fp.colorDepth; });
          }
          // Performance/CPU surface — anti-bot infers device class from
          // these. A "US Desktop Chrome" UA paired with hardwareConcurrency
          // = 2 looks like a low-end Android pretending to be desktop.
          if (fp.hardwareConcurrency) def(navigator, "hardwareConcurrency", function(){ return fp.hardwareConcurrency; });
          if (fp.deviceMemory)        def(navigator, "deviceMemory",        function(){ return fp.deviceMemory; });
          if (fp.maxTouchPoints !== undefined) def(navigator, "maxTouchPoints", function(){ return fp.maxTouchPoints; });
          // performance.now() jitter — seeded by canvasNoise so timing is
          // stable per session but not byte-identical across sessions.
          if (window.performance && window.performance.now) {
            try {
              var _now = window.performance.now.bind(window.performance);
              var seedN = noiseSeed || 0;
              var jitterMs = function(){
                seedN = (seedN * 1664525 + 1013904223) | 0;
                return ((seedN >>> 16) & 0xffff) / 0xffff * 0.1; // 0..0.1ms drift
              };
              window.performance.now = function(){ return _now() + jitterMs(); };
            } catch(e){}
          }
        }

        // ── timezone (Intl + Date) ────────────────────────────────────────
        if (fp && fp.timezone) {
          var _DTF = Intl.DateTimeFormat;
          var Patched = function(l, o){
            o = Object.assign({}, o || {});
            if (!o.timeZone) o.timeZone = fp.timezone;
            return new _DTF(l || fp.language || "en-US", o);
          };
          Patched.prototype = _DTF.prototype;
          Patched.supportedLocalesOf = _DTF.supportedLocalesOf;
          Intl.DateTimeFormat = Patched;
          // Spoof Date timezone offset to match the stated zone, best-effort.
          try {
            var _toLocaleString = Date.prototype.toLocaleString;
            Date.prototype.toLocaleString = function(l, o){
              o = Object.assign({ timeZone: fp.timezone }, o || {});
              return _toLocaleString.call(this, l || fp.language || "en-US", o);
            };
          } catch(e){}
        }

        // ── geolocation: deny ─────────────────────────────────────────────
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition = function(_, e){ if(e) e({code:1, message:"denied"}); };
          navigator.geolocation.watchPosition = function(_, e){ if(e) e({code:1, message:"denied"}); return 0; };
        }

        // ── WebRTC: kill STUN/TURN so real IP can't leak via ICE ─────────
        if (window.RTCPeerConnection) {
          var _R = window.RTCPeerConnection;
          var W = function(cfg, c){
            cfg = Object.assign({}, cfg || {});
            cfg.iceServers = [];
            cfg.iceTransportPolicy = "none";
            return new _R(cfg, c);
          };
          W.prototype = _R.prototype;
          window.RTCPeerConnection = W;
          if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = W;
        }

        // ── canvas: per-pixel deterministic noise ─────────────────────────
        // Same fingerprint id → same noise pattern, so the site sees a
        // stable identity rather than a flickering one (which is itself a
        // tell). Different sessions get different patterns.
        var noiseSeed = 0;
        if (fp && fp.canvasNoise) {
          for (var i = 0; i < fp.canvasNoise.length; i++) noiseSeed = (noiseSeed * 31 + fp.canvasNoise.charCodeAt(i)) | 0;
        }
        function mulberry32(a){
          return function(){
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = a;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
          };
        }
        try {
          var _toDataURL = HTMLCanvasElement.prototype.toDataURL;
          var _toBlob    = HTMLCanvasElement.prototype.toBlob;
          var _getImageData = CanvasRenderingContext2D.prototype.getImageData;
          function denoise(canvas){
            try {
              var ctx = canvas.getContext("2d");
              if (!ctx) return;
              var w = canvas.width, h = canvas.height;
              if (w === 0 || h === 0) return;
              var img = _getImageData.call(ctx, 0, 0, w, h);
              var rng = mulberry32(noiseSeed);
              for (var p = 0; p < img.data.length; p += 4) {
                if (rng() < 0.02) {
                  img.data[p]   = (img.data[p]   + (rng() < 0.5 ? 1 : -1)) & 0xff;
                  img.data[p+1] = (img.data[p+1] + (rng() < 0.5 ? 1 : -1)) & 0xff;
                  img.data[p+2] = (img.data[p+2] + (rng() < 0.5 ? 1 : -1)) & 0xff;
                }
              }
              ctx.putImageData(img, 0, 0);
            } catch(e){}
          }
          HTMLCanvasElement.prototype.toDataURL = function(){
            denoise(this);
            return _toDataURL.apply(this, arguments);
          };
          HTMLCanvasElement.prototype.toBlob = function(){
            denoise(this);
            return _toBlob.apply(this, arguments);
          };
          CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h){
            var data = _getImageData.call(this, x, y, w, h);
            var rng = mulberry32(noiseSeed ^ (x * 73856093) ^ (y * 19349663));
            for (var p = 0; p < data.data.length; p += 4) {
              if (rng() < 0.005) data.data[p] = (data.data[p] + 1) & 0xff;
            }
            return data;
          };
        } catch(e){}

        // ── WebGL vendor/renderer ─────────────────────────────────────────
        if (fp && (fp.webglVendor || fp.webglRenderer)) {
          var patchGL = function(proto){
            if (!proto) return;
            var _getParameter = proto.getParameter;
            proto.getParameter = function(p){
              // UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL constants.
              if (p === 37445 && fp.webglVendor)   return fp.webglVendor;
              if (p === 37446 && fp.webglRenderer) return fp.webglRenderer;
              if (p === 7936  && fp.webglVendor)   return fp.webglVendor;
              if (p === 7937  && fp.webglRenderer) return fp.webglRenderer;
              return _getParameter.call(this, p);
            };
          };
          if (window.WebGLRenderingContext)  patchGL(WebGLRenderingContext.prototype);
          if (window.WebGL2RenderingContext) patchGL(WebGL2RenderingContext.prototype);
        }

        // ── audio: tiny noise on getChannelData / getFloatFrequencyData ──
        try {
          if (window.AudioBuffer) {
            var _gcd = AudioBuffer.prototype.getChannelData;
            AudioBuffer.prototype.getChannelData = function(){
              var data = _gcd.apply(this, arguments);
              var rng = mulberry32(noiseSeed ^ 0xa5a5);
              for (var i = 0; i < data.length; i += 100) {
                data[i] = data[i] + (rng() - 0.5) * 1e-7;
              }
              return data;
            };
          }
          if (window.AnalyserNode) {
            var _gffd = AnalyserNode.prototype.getFloatFrequencyData;
            AnalyserNode.prototype.getFloatFrequencyData = function(arr){
              _gffd.call(this, arr);
              var rng = mulberry32(noiseSeed ^ 0x5a5a);
              for (var i = 0; i < arr.length; i += 7) arr[i] += (rng() - 0.5) * 0.05;
            };
          }
        } catch(e){}

        // ── JS-stall heartbeat ────────────────────────────────────────────
        // Soft-block detection: pages that 200 OK but silently fail.
        // We sample three liveness signals and post a verdict to the
        // shell (which forwards to the orchestrator's host history):
        //
        //   domMutations:      MutationObserver hit count over the window
        //   networkActivity:   fetch / XHR call count over the window
        //   eventLoopAlive:    setTimeout(0) callback fired this window
        //   longTaskMs:        accumulated long-task time (>50ms blocks)
        //
        // Verdict at +6s post-load:
        //   dom == 0 && net == 0 && !loop  → hard_stall
        //   dom == 0 && net == 0 &&  loop  → soft_block (script-path failure)
        //   longTaskMs > 2000              → js_loop_block
        //   else                           → ok
        try {
          var hb = { dom: 0, net: 0, loop: false, longTaskMs: 0 };

          // DOM mutations (subtree, including added/removed/attribute changes).
          try {
            var mo = new MutationObserver(function(muts){ hb.dom += muts.length; });
            // Wait for body to exist (inject runs in <head>).
            var startMo = function(){
              if (document.body) mo.observe(document.body, { childList: true, subtree: true, attributes: true });
              else setTimeout(startMo, 50);
            };
            startMo();
          } catch(e){}

          // Network activity: count fetch + XHR.send.
          try {
            var _fetch = window.fetch && window.fetch.bind(window);
            if (_fetch) {
              window.fetch = function(){ hb.net++; return _fetch.apply(this, arguments); };
            }
            if (window.XMLHttpRequest) {
              var _xhrSend = XMLHttpRequest.prototype.send;
              XMLHttpRequest.prototype.send = function(){ hb.net++; return _xhrSend.apply(this, arguments); };
            }
          } catch(e){}

          // Event loop liveness — if the queued callback never fires, the
          // page is busy-looping or the runtime is wedged.
          try { setTimeout(function(){ hb.loop = true; }, 50); } catch(e){}

          // Long-task observer (Chromium / Firefox). Pages locked in an
          // anti-bot JS trap accumulate seconds of >50ms tasks.
          try {
            if (window.PerformanceObserver) {
              var po = new PerformanceObserver(function(list){
                list.getEntries().forEach(function(en){
                  if (en.entryType === "longtask") hb.longTaskMs += en.duration;
                });
              });
              po.observe({ entryTypes: ["longtask"] });
            }
          } catch(e){}

          // Report at +6s after load (or +6s from inject if load already passed).
          // First stall verdict triggers a single reload-and-retry before
          // we report it as a stall to the orchestrator. Some sites pass
          // on second load (race conditions, deferred-script bot traps).
          // We track the retry across reloads via sessionStorage so the
          // second-load decision survives the reload itself.
          var STALL_KEY = "__sn_stall_retry";
          var retried = false;
          try { retried = sessionStorage.getItem(STALL_KEY) === "1"; } catch(e){}

          var report = function(){
            var verdict = "ok";
            if (hb.dom === 0 && hb.net === 0 && !hb.loop)        verdict = "hard_stall";
            else if (hb.dom === 0 && hb.net === 0 && hb.loop)    verdict = "soft_block";
            else if (hb.longTaskMs > 2000)                       verdict = "js_loop_block";

            // Cheap retry: reload once on the first stall before
            // bothering the orchestrator. If we cleared the load on the
            // retried pass, drop the retry flag so the next visit starts
            // fresh. If we still stall, escalate.
            if (verdict !== "ok" && !retried) {
              try { sessionStorage.setItem(STALL_KEY, "1"); } catch(e){}
              try { location.reload(); } catch(e){}
              return;
            }
            if (retried && verdict === "ok") {
              try { sessionStorage.removeItem(STALL_KEY); } catch(e){}
            }

            // Capture state snapshot for mid-session escalation. The shell
            // stores it briefly; if it routes the user to remote, the
            // pool replays cookies + localStorage so the destination
            // doesn't see a clean-slate request (which would re-trigger
            // the same Cloudflare challenge).
            //
            // Origin scoping: the snapshot is tagged with the exact
            // top-level origin it was captured from. The pool MUST
            // refuse to apply this state to any other origin — cookies
            // get scoped to .host (no wildcard), localStorage only to
            // matching origin. Cross-site contamination = security bug.
            var state = null;
            if (verdict !== "ok") {
              try {
                var lsObj = {};
                var lsBytes = 0;
                for (var k = 0; k < localStorage.length; k++) {
                  var name = localStorage.key(k);
                  if (!name) continue;
                  var val = localStorage.getItem(name) || "";
                  // Cap at 256KB total — enough for auth tokens and CF
                  // clearance, not enough for tracker garbage.
                  if (lsBytes + name.length + val.length > 256 * 1024) break;
                  lsObj[name] = val;
                  lsBytes += name.length + val.length;
                }
                state = {
                  url: location.href,
                  origin: location.origin,
                  host: location.host,
                  cookies: document.cookie || "",
                  localStorage: lsObj,
                };
              } catch(e){}
            }

            var msg = {
              __shadownet: true,
              kind: "stall-report",
              host: location.host,
              verdict: verdict,
              dom: hb.dom, net: hb.net, loop: hb.loop, longTaskMs: Math.round(hb.longTaskMs),
              retried: retried,
              state: state,
            };
            try { if (window.opener) window.opener.postMessage(msg, "*"); } catch(e){}
            try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*"); } catch(e){}
            try { new BroadcastChannel("shadownet-stall").postMessage(msg); } catch(e){}
          };
          var schedule = function(){ setTimeout(report, 6000); };
          if (document.readyState === "complete") schedule();
          else window.addEventListener("load", schedule, { once: true });
        } catch(e){}

        // ── window.solana shim (WalletConnect bridge) ─────────────────────
        // Hardened bridge: full Phantom-compatible event surface, single-
        // flight serialisation (no double-signs while a prior request is
        // pending), 3-min timeout, BroadcastChannel fallback when the
        // proxied tab can't reach window.opener (cross-origin isolation,
        // popup blockers).
        //
        // The shell (parent / opener / BroadcastChannel listener) is the
        // one that actually shows a "Waiting for wallet approval…" overlay
        // and forwards the request to WalletConnect v2 → user's phone.
        // This shim only mediates the protocol; it never holds keys.
        (function(){
          if (window.solana && window.solana.__shadownet) return;

          var listeners = { connect: [], disconnect: [], accountChanged: [] };
          function emit(ev, arg){ (listeners[ev] || []).slice().forEach(function(cb){ try { cb(arg); } catch(e){} }); }

          // Single-flight queue — only one signing call in flight at a
          // time. Sites that fire signTransaction() twice in quick
          // succession won't double-prompt the user; the second call waits
          // for the first to resolve.
          var queue = Promise.resolve();
          function enqueue(fn){
            var next = queue.then(fn, fn);
            // Don't propagate failures into the chain.
            queue = next.catch(function(){});
            return next;
          }

          var pending = {};
          var bcast = null;
          try { bcast = new BroadcastChannel("shadownet-wallet"); } catch(e){}

          function postUp(msg){
            // Try opener first (window.open without noopener), fall back
            // to parent (iframe), then BroadcastChannel as the last
            // resort. The shell listens on all three.
            var sent = false;
            try { if (window.opener && window.opener !== window) { window.opener.postMessage(msg, "*"); sent = true; } } catch(e){}
            try { if (window.parent && window.parent !== window) { window.parent.postMessage(msg, "*"); sent = true; } } catch(e){}
            try { if (bcast) { bcast.postMessage(msg); sent = true; } } catch(e){}
            return sent;
          }

          function rpc(method, params){
            return enqueue(function(){
              return new Promise(function(resolve, reject){
                var id = "wc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
                var origin = location.href;
                pending[id] = { resolve: resolve, reject: reject };
                var sent = postUp({ __shadownet: true, kind: "wallet-rpc", id: id, method: method, params: params, origin: origin });
                if (!sent) { delete pending[id]; reject(new Error("ShadowNet shell unreachable")); return; }
                // 3-minute ceiling so a forgotten phone tap doesn't hang
                // the dApp's promise forever.
                setTimeout(function(){
                  if (pending[id]) { pending[id].reject(new Error("Wallet request timed out")); delete pending[id]; }
                }, 3 * 60 * 1000);
              });
            });
          }

          function handleReply(d){
            if (!d || d.__shadownet !== true) return;
            if (d.kind === "wallet-rpc-reply") {
              var p = pending[d.id]; if (!p) return;
              delete pending[d.id];
              if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
            } else if (d.kind === "wallet-event") {
              if (d.event === "accountChanged") {
                solana.publicKey = d.publicKey ? makePubkey(d.publicKey) : null;
                solana.isConnected = !!d.publicKey;
                emit("accountChanged", solana.publicKey);
              } else if (d.event === "disconnect") {
                solana.isConnected = false; solana.publicKey = null; emit("disconnect");
              }
            }
          }

          window.addEventListener("message", function(ev){ handleReply(ev.data); });
          if (bcast) bcast.addEventListener("message", function(ev){ handleReply(ev.data); });

          function makePubkey(b58){
            return {
              toBase58: function(){ return b58; },
              toString: function(){ return b58; },
              toBytes: function(){
                // Minimal base58 decoder so dApps that call toBytes() don't
                // explode. Not a full PublicKey impl; sites should use
                // toBase58() for transport and let web3.js reconstitute.
                var ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
                var bytes = [0];
                for (var i = 0; i < b58.length; i++) {
                  var v = ALPH.indexOf(b58[i]); if (v < 0) return new Uint8Array(0);
                  for (var j = 0, c = v; j < bytes.length; j++) { c += bytes[j] * 58; bytes[j] = c & 0xff; c >>= 8; }
                  while (c) { bytes.push(c & 0xff); c >>= 8; }
                }
                for (var k = 0; k < b58.length && b58[k] === "1"; k++) bytes.push(0);
                return new Uint8Array(bytes.reverse());
              },
              equals: function(other){ return other && other.toBase58 && other.toBase58() === b58; },
            };
          }

          var solana = {
            __shadownet: true,
            isPhantom: true,
            isConnected: false,
            publicKey: null,
            on: function(ev, cb){ if (!listeners[ev]) listeners[ev] = []; listeners[ev].push(cb); },
            off: function(ev, cb){
              var ls = listeners[ev]; if (!ls) return;
              listeners[ev] = ls.filter(function(x){ return x !== cb; });
            },
            removeListener: function(ev, cb){ this.off(ev, cb); },
            removeAllListeners: function(ev){ if (ev) listeners[ev] = []; else listeners = { connect: [], disconnect: [], accountChanged: [] }; },
            connect: function(opts){
              return rpc("connect", { onlyIfTrusted: !!(opts && opts.onlyIfTrusted) }).then(function(r){
                solana.isConnected = true;
                solana.publicKey = r && r.publicKey ? makePubkey(r.publicKey) : null;
                emit("connect", solana.publicKey);
                return { publicKey: solana.publicKey };
              });
            },
            disconnect: function(){
              solana.isConnected = false; solana.publicKey = null;
              emit("disconnect");
              return rpc("disconnect", {});
            },
            signMessage: function(msg, enc){
              var b = msg instanceof Uint8Array ? Array.from(msg) : msg;
              return rpc("signMessage", { message: b, encoding: enc || "utf8" }).then(function(r){
                if (r && r.signature && Array.isArray(r.signature)) r.signature = new Uint8Array(r.signature);
                return r;
              });
            },
            signTransaction: function(tx){
              var serialized = (tx && tx.serialize) ? Array.from(tx.serialize({ requireAllSignatures: false })) : tx;
              return rpc("signTransaction", { transaction: serialized }).then(function(r){
                // dApps generally call .serialize on what they get back, so
                // returning the original tx with a signed flag works for
                // most (Phantom does the same — mutates in place).
                if (tx && r && r.signature && tx.addSignature && r.publicKey) {
                  try { tx.addSignature(makePubkey(r.publicKey), new Uint8Array(r.signature)); return tx; } catch(e){}
                }
                return r;
              });
            },
            signAllTransactions: function(txs){
              return rpc("signAllTransactions", { transactions: txs.map(function(t){
                return (t && t.serialize) ? Array.from(t.serialize({ requireAllSignatures: false })) : t;
              })});
            },
            signAndSendTransaction: function(tx, opts){
              var serialized = (tx && tx.serialize) ? Array.from(tx.serialize({ requireAllSignatures: false })) : tx;
              return rpc("signAndSendTransaction", { transaction: serialized, options: opts || {} });
            },
            request: function(args){
              if (!args || !args.method) return Promise.reject(new Error("method required"));
              return rpc("request", args);
            },
          };

          try { Object.defineProperty(window, "solana",  { value: solana, writable: false, configurable: false }); } catch(e){ window.solana = solana; }
          try { Object.defineProperty(window, "phantom", { value: { solana: solana }, writable: false, configurable: false }); } catch(e){ window.phantom = { solana: solana }; }
          // Some dApps dispatch this to wake injected providers.
          try { window.dispatchEvent(new Event("wallet-standard:register-wallet")); } catch(e){}
        })();
      } catch(e){}
    })();
  `,
};
