# Architecture

  ShadowNet is a privacy-first dApp built on a pnpm monorepo. The codebase
  ships **today** as a small, focused stack of three artifacts and is
  designed to grow into a four-module privacy-native access layer; this
  document marks each section with **Live** or **Planned** so the
  architecture you read matches the code you can run.

  The architecture is anchored on three load-bearing ideas. Every later
  section is a consequence of these:

  1. **Coherent identity, not random identity.** A spoofed fingerprint is
     worthless if the page-level shim says one thing and the outgoing HTTP
     headers say another. The system is being designed to ship atomic
     preset bundles where every surface (UA, platform, WebGL vendor and
     renderer, fonts, screen, hardware concurrency, timezone, locale)
     locks together at session creation. Today the surface is more modest:
     per-request UA rotation on the proxy, plus a randomised fingerprint
     blob exposed by the session API for client-side display.
  2. **Routing as a first-class capability.** A privacy product that only
     handles the easy 80 % of destinations is a marketing demo. The
     planned ShadowNet orchestrator will continuously decide whether each
     request rides the in-region proxy or escalates to a disposable
     Chromium in a remote-browser pool, using a failure classifier,
     per-host history, and the caller's holder-tier entitlement. Today
     the routing layer is a single proxy route with a pre-flight verifier.
  3. **No keys, no logs, no per-user state.** The server has no wallet
     endpoint anywhere in any branch, the proxy intentionally logs no
     request bodies / headers / client IPs, and the in-memory state holds
     nothing that survives a process restart. There is nothing to
     subpoena, leak, or sell.

  ---

  ## Top-level layout

  ```text
  shadownet/
  ├── artifacts/
  │   ├── api-server/              # Express 5 on Node 24
  │   │   └── src/
  │   │       ├── app.ts           # Express bootstrap, rate limits, /api router mount
  │   │       ├── index.ts         # PORT bind
  │   │       ├── routes/
  │   │       │   ├── health.ts
  │   │       │   ├── proxy.ts          # Live: /api/proxy?url=… stealth proxy
  │   │       │   ├── relay.ts          # Live: /api/relay/nodes directory + connect
  │   │       │   ├── relayVerify.ts    # Live: /api/relay/verify pre-flight check
  │   │       │   ├── session.ts        # Live: /api/session/{fingerprint,start}
  │   │       │   ├── intelligence.ts   # Live: 5 intel endpoints
  │   │       │   └── pumpTokens.ts     # Live: /api/pump-tokens feed
  │   │       └── lib/
  │   │           ├── cache.ts          # In-memory TTL cache for AI/intel
  │   │           ├── history.ts        # Wallet score + purchase history
  │   │           ├── cross-signal.ts   # Wallet ↔ repo ↔ X entity graph
  │   │           ├── github-trust.ts   # Scam / anti-gaming / structural risk
  │   │           └── wallet-archetype.ts # 8-class classifier + FIFO PnL
  │   ├── shadownet/               # React 18 + Vite 5 + Wouter
  │   │   └── src/
  │   │       ├── App.tsx
  │   │       ├── pages/
  │   │       │   ├── landing.tsx
  │   │       │   ├── docs.tsx
  │   │       │   └── app/{dashboard,sessions,wallet,relay,intel,layout}.tsx
  │   │       ├── lib/wallet.ts    # Browser-only BIP-39 → SLIP-0010 → Ed25519
  │   │       └── components/PumpViewer.tsx
  │   └── mockup-sandbox/          # Component preview workspace
  └── lib/                          # Generated OpenAPI client + Zod schemas
  ```

  ---

  ## Request lifecycle

  ### Stealth browsing — Live

  ```
  Browser          Vite dev / static       API server (Express)        Internet
  ───────         ──────────────────       ────────────────────        ────────

    user types URL ───────────►
                                GET /api/relay/verify?url=…
                                            │
                                            ▼
                                    validateUrl → DNS check
                                    reject RFC1918 / loopback /
                                    link-local / blocked port
                                            │
                                            ▼
                                    fetch(url, spoofed UA, 15 s timeout)
                                            │
                                            ▼
                                    parse <title>, capture status,
                                    content-type, latency, server header
                                            │
                                            ▼
                                    best-effort: GET ipify.org for
                                    outbound relay IP (proof of route)
                                ◄──── verdict + relayIp + pageTitle
    precheck verdict shown
    to user (anti-bot, etc.)
                                GET /api/proxy?url=…
                                            │
                                            ▼
                                    same SSRF guard, then fetch
                                    with random UA from pool
                                            │
                                            ▼
                                    strip x-frame-options, CSP,
                                    HSTS, x-content-type-options,
                                    ACAO from response headers
                                            │
                                            ▼
                                    for HTML responses: rewrite
                                    href / src / srcset / form action
                                    through /api/proxy?url=… and
                                    inject head intercept script
                                ◄──── proxied page
    iframe renders.
    Intercept script catches every later
    fetch / XHR / dynamic <script> / setAttribute('src')
    and re-routes through /api/proxy.
  ```

  The intercept script is the load-bearing piece for SPA support. It
  patches `window.location` (so a Next.js router thinks it sees the real
  target URL), `fetch` and `XMLHttpRequest` (so XHR-driven APIs stay
  inside the proxy), and the `Element.setAttribute('src' | 'href')` plus
  `HTMLScriptElement.src` / `HTMLLinkElement.href` property setters (so
  webpack chunk loaders that set `script.src = "/_next/static/chunks/…"`
  also stay routed through ShadowNet). Without this, the proxy survives
  the first navigation and white-screens on the second click.

  ### Stealth browsing — Planned (UV bare-server)

  The planned upgrade replaces the per-route HTML rewrite with a
  service-worker proxy on Ultraviolet, mounted under `/service/` in the
  client and backed by `@tomphttp/bare-server-node` at `/bare/` on the
  API server. The service worker catches **every** fetch the page can
  make (HTML, JS, XHR, fetch, WebSocket, dynamic imports, sub-resources)
  and forwards it to the bare server, which streams the upstream
  response back. WebSocket upgrades pass through bare's `upgrade`
  handler so realtime sites (pump.fun, jup.ag, dexscreener) work without
  any per-site shim.

  ### Wallet generation — Live

  The flow is **entirely client-side**. The backend has no
  `/wallet/generate` endpoint and the build will fail if you try to add
  one without also adding a wallet-routes file (there is none, by design).

  ```
  Browser
  ───────

     click "Generate"
          │
          ▼
     assertSecureRuntime()
       - require crypto.getRandomValues
       - probe RNG for non-zero output
       - require window.isSecureContext (HTTPS or localhost)
          │
          ▼
     generateMnemonic(@scure/bip39, 128 bits, English wordlist)
          │
          ▼
     mnemonicToSeed → 64-byte seed
          │
          ▼
     SLIP-0010 hardened path m/44'/501'/0'/0'
       - HMAC-SHA512 master from "ed25519 seed"
       - per-segment ckdPriv with 0x00 || key || index
       - all intermediate buffers .fill(0)'d
          │
          ▼
     ed.getPublicKeyAsync(privKey32)
     secretKey = priv32 || pub32  ← Solana wire format
          │
          ▼
     { publicKey, privateKey, mnemonic, derivationPath, provenance } returned
     intermediate seed + chain codes wiped
  ```

  The provenance descriptor returned to the UI explicitly names the
  entropy source, RNG bits, curve, derivation standard, and library set
  so a sophisticated user can verify generation against any other tool.

  ### Intelligence — Live

  All five Intelligence endpoints share one cache layer (`lib/cache.ts`),
  one history store (`lib/history.ts`), the cross-signal graph
  (`lib/cross-signal.ts`), the wallet-archetype classifier
  (`lib/wallet-archetype.ts`), and the GitHub trust scorer
  (`lib/github-trust.ts`). External calls go to:

  - **Solana RPC** with tiered failover: `SOLANA_RPC_URL` (typically
    Helius) → `solana-mainnet.publicnode.com` → `api.mainnet-beta.solana.com`.
  - **OpenAI / OpenRouter** via the standard `OPENAI_API_KEY` and optional
    `OPENAI_BASE_URL`. Default model is configurable via `AI_MODEL`.
  - **X API v2** with an app-only Bearer token.
  - **Wayback Machine** for X handle snapshot history.
  - **Dexscreener** for token pair enrichment.
  - **GitHub REST** for repo metadata.

  See [INTELLIGENCE.md](./INTELLIGENCE.md) for endpoint reference and the
  verdict policy of the cross-signal graph.

  ### Trading — Planned

  The planned trading terminal will reuse the relay routing layer for any
  upstream calls, hold the Jupiter Ultra API key server-side, and route
  platform fees into pre-created associated token accounts. The
  alpha-score 10-layer classifier will run server-side on cached
  Dexscreener + Jupiter audit data so the UI never has to recompute the
  score itself. See [ROADMAP.md](./ROADMAP.md#trading-terminal).

  ---

  ## Production posture

  | Concern | How it's handled today (Live) |
  | --- | --- |
  | Rate limiting | 60 rpm / IP global, plus a 500 ms slow-down on `/api/proxy` after the first 20 requests in a window |
  | Per-endpoint rate limit | Intelligence GitHub scanner: 8 / min |
  | Request timeout | 10 s app-wide, raised to 60 s for the GitHub scanner (AI calls take 20–30 s) |
  | Body size | 1 MB on JSON and urlencoded |
  | CORS | Open by default in this build (intended for dApp embedding); production deployments should narrow it at the edge proxy |
  | SSRF | DNS-resolved RFC 1918 / loopback / link-local rejection on `/api/proxy` and `/api/relay/verify`, plus blocked-port list (22, 25, 3306, 6379), plus protocol allowlist (http / https only) |
  | Logging | The proxy intentionally logs no request bodies, headers, or client IPs; only standard Express access logs reach Railway |
  | Secrets | Loaded from environment variables only; `SOLANA_RPC_URL`, `OPENAI_API_KEY`, `TWITTER_API_BEARER` and friends never reach the browser bundle |

  ---

  ## What's wired today vs what's planned

  | Subsystem | Today (Live) | Planned |
  | --- | --- | --- |
  | Proxy | Single Express route at `/api/proxy` with HTML rewrite + intercept script | Service-worker UV bare-server at `/service/` ↔ `/bare/` with WebSocket upgrade |
  | Routing | Single ShadowNet API server | Multi-region deployment driven by `RELAY_REGION` + `RELAY_PEERS` |
  | Escalation | n/a (one tier) | Two-tier orchestrator: classifier + per-host history → in-region proxy or remote disposable Chromium |
  | Fingerprint | Random per-request UA from a pool of 3 + a separate randomised display fingerprint blob exposed by `/api/session/fingerprint` | Atomic fingerprint preset bundles, region-coherent locale and timezone, applied in both the page shim and the bare server |
  | Auth | Public, no accounts | Holder-tier via Solana SPL balance + HMAC claim + device-hash binding |
  | Page shim | Per-page intercept script (location / fetch / XHR / element setters) | Plus WebRTC disable, geolocation block, destination-origin SW block |
  | Intel | 5 endpoints with caching + cross-signal + archetype + GitHub trust | Add Telegram and Discord channel scanning |
  | Trading | Pump.fun token feed | Discovery + alpha-score + Jupiter Ultra swap proxy + chart page + holder distribution |

  ---

  ## Why this design

  ShadowNet ships incrementally because the privacy stack should be
  audit-friendly at every step, not "rewrite the whole thing every six
  months." The current code is small enough to read end-to-end in an
  afternoon. Every planned feature has a published architecture in
  [ROADMAP.md](./ROADMAP.md) so contributors can see what they would
  inherit before they invest time. The repo is MIT and the issue tracker
  is open.
  