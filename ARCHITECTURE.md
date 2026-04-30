# Architecture Overview

  ShadowNet is a privacy-first dApp made of four cooperating modules
  sharing a single session and routing layer:

  1. **Stealth proxy** for browsing the open web through ShadowNet
     infrastructure with a randomised, region-coherent fingerprint.
  2. **Wallet engine** for generating and using Solana keypairs entirely
     inside the browser.
  3. **Trading engine** for token discovery, alpha scoring, and Jupiter
     Ultra swap execution.
  4. **Intel engine** for wallet, X (Twitter), and GitHub research.

  The architecture is designed around three load-bearing ideas. Every
  later section is a consequence of these:

  1. **Coherent identity, not random identity.** A spoofed fingerprint
     is worthless if the page-level shim says one thing and the outgoing
     HTTP headers say another. We ship atomic preset bundles
     (UA + platform + WebGL vendor/renderer + fonts + screen + hardware
     concurrency + timezone + locale) that lock together at session
     creation and apply consistently in both the page and the bare
     server. This eliminates the most common class of stealth-tool
     detection in a single design choice.
  2. **Routing as a first-class capability.** A privacy product that
     only handles the easy 80% of destinations is a marketing demo. The
     ShadowNet orchestrator continuously decides whether each request
     should ride the cheap in-region proxy tier or escalate to a
     disposable Chromium in a remote-browser pool. The decision uses a
     failure classifier, per-host history, an optional precheck verdict,
     and the caller's holder-tier entitlement. Users never have to think
     about it.
  3. **No keys, no logs, no per-user state.** The server has no wallet
     endpoint, the bare server logs hostname and HTTP status only, and
     the session store lives in memory. There is nothing to subpoena,
     leak, or sell.

  This document describes how those ideas are realised in code, and how
  a single request flows through the system end to end.

  ---

  ## 🧱 Top-level layout

  ```text
  ┌─────────────────────────────────────────────────────────────────┐
  │ Browser (React + Vite + Wouter)                                 │
  │                                                                 │
  │   pages/app/{trading,chart,sessions,wallet,intel,relay,remote}  │
  │   service worker (uv/sw.js)  ──┐                                │
  └────────────────────────────────┼────────────────────────────────┘
                                   │
                                   ▼  https
  ┌─────────────────────────────────────────────────────────────────┐
  │ ShadowNet API Server (Express 5 on Node 24, one per region)     │
  │                                                                 │
  │   /api/*       json control plane                               │
  │   /bare/*      Ultraviolet bare-server (HTTP + WebSocket)       │
  │                                                                 │
  │   ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
  │   │ orchestrator │──│ classifier   │──│ per-host history   │    │
  │   └──────────────┘  └──────────────┘  └────────────────────┘    │
  │   ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
  │   │ session store│  │ region cat.  │  │ holder claim (HMAC)│    │
  │   └──────────────┘  └──────────────┘  └────────────────────┘    │
  └─────────────────────────────────────────────────────────────────┘
          │                                   │              │
          ▼                                   ▼              ▼
     destination web              remote-browser pool   Helius / Jupiter
     (HTTP + WebSocket)           (WebRTC, Chromium)    (Solana RPC + APIs)
  ```

  ---

  ## 🔁 Request lifecycle

  ### Browsing through the proxy tier

  1. The user navigates to a stealth session and types a target URL.
  2. The frontend asks `/api/orchestrator/start` which destination tier
     to use. The orchestrator decides based on per-host history, an
     optional precheck verdict, and the caller's entitlement.
  3. For the proxy tier, the page registers the service worker at
     `/uv/sw.js`. Every subsequent request the page makes (HTML, JS,
     XHR, `fetch`, WebSocket, dynamic imports) is intercepted and
     forwarded to `/bare/` on the API server.
  4. The bare server fetches the destination, strips `Server` and
     `X-Powered-By` headers, applies the session fingerprint to outgoing
     request headers (Accept-Language, sec-ch-ua-platform, etc.), and
     streams the response back through the service worker into the page.
  5. WebSocket upgrades are handled by the bare server's `upgrade`
     handler so realtime sites work.

  ### Browsing through the remote-browser tier

  When the orchestrator decides escalation is required (Cloudflare
  Turnstile, hCaptcha, DataDome, PerimeterX, Akamai BotManager, or a
  host history that consistently fails), the flow changes:

  1. The orchestrator issues a session against the remote-browser pool
     over its private HTTP API, passing the region, fingerprint, TTL,
     and any origin-scoped seed state captured from a proxied tab the
     user was already on.
  2. The pool returns a signal URL plus ICE servers.
  3. The frontend opens a WebRTC connection: a video track for the
     rendered page and an "input" data channel for keyboard, mouse, and
     scroll events.
  4. The page never reaches the user's machine. The destination sees the
     pool's IP and the launch-flag-applied fingerprint of a real,
     freshly-spawned Chromium profile.
  5. The frontend heartbeats every minute. Idle for 5 minutes or past
     TTL, the orchestrator tells the pool to tear the container down.

  ### Trading

  1. The user opens `/app/trading` (the Discover page) or `/app/chart`
     (the token detail view).
  2. Trading reads from `/api/tokens` which aggregates DexScreener pairs
     and DexProfile boosts, classifies into micro/small/mid/large tiers,
     and runs each token through the alpha-score 10-layer classifier.
  3. When the user opens a swap, the frontend calls `/api/swap/quote`
     for an Ultra quote, signs the resulting transaction with the
     browser-resident Solana keypair, and posts the signed transaction
     to `/api/swap/execute`. The server forwards to Jupiter Ultra and
     returns the result.
  4. Platform fees are routed into the configured ATAs (wSOL, USDC,
     USDT) on the operator's fee wallet, capped at 255 bps per Jupiter's
     Ultra contract.

  ### Holder-tier authentication

  1. The frontend requests a one-time nonce from `/api/auth/challenge`.
  2. The user signs the challenge message with their wallet
     (`signMessage`).
  3. The frontend posts `{ wallet, nonce, signature, deviceHash }` to
     `/api/auth/verify-holder`.
  4. The server verifies the ed25519 signature, then queries Helius for
     the wallet's SPL balance against `ENTITLEMENT_MINT`.
  5. On success, the server returns an HMAC-signed claim token bound to
     the device hash. The orchestrator validates this token without
     another RPC round-trip on subsequent requests.
  6. Tokens have a 15-minute TTL. The frontend silently re-signs near
     expiry, so a wallet that drops below the threshold mid-session
     loses access at most 15 minutes later.

  ---

  ## 🧠 Orchestrator decision model

  Hard rules short-circuit first, in this order:

  1. `FORCE_REMOTE_FOR_HOSTS` env match.
  2. Sticky-remote latch on the host.
  3. Precheck verdict with confidence ≥ 0.75.
  4. Per-host failure rate ≥ 0.4 in the last 24 hours.

  Anything in the fuzzy middle (precheck 0.4–0.75, host failure rate
  0.2–0.4, mild stall history) is scored against env-tunable weights
  and compared to `ROUTE_ESCALATE_THRESHOLD`. The verdict's reason
  string names the dominant factor, so production logs stay auditable.

  If the orchestrator selects the remote tier but the caller is not a
  holder, the server returns an honest 402-style payload describing
  what they need to unlock, not a silent failure.

  ---

  ## 🔐 Security layers

  | Layer | Mechanism |
  | --- | --- |
  | Input validation | Protocol allowlist, port denylist, DNS-based private-IP filtering on every proxied URL |
  | SSRF | Loopback, RFC 1918, and link-local addresses denied at the host check |
  | Rate limiting | 60 req/min on `/api/intelligence` and `/api/relay`; slow-down on `/api/relay` after 20 req/min |
  | Timeout | 10 s server-side request budget on every API route |
  | Logging | Bare server logs hostname and status only. No bodies, headers, or client IPs |
  | Header hygiene | `X-Powered-By` and `Server` stripped at both Express and HTTP layers |
  | Geographic policy | OFAC country-code soft-block list exposed for upstream enforcement (Cloudflare or Railway middleware) |
  | Holder claims | HMAC-SHA256, 15-minute TTL, bound to device-fingerprint hash |

  Inside stealth sessions the page-level shim additionally:

  - Disables WebRTC to prevent IP leaks.
  - Blocks the geolocation API.
  - Prevents service-worker registration from the destination origin.
  - Spoofs `screen`, `navigator.platform`, `navigator.userAgentData`,
    hardware concurrency, device memory, and timezone to match the
    session preset.

  ---

  ## 🌐 Region model

  Each Railway service equals one outbound IP equals one region. A
  single instance reads its own descriptor from
  `RELAY_REGION`, `RELAY_REGION_NAME`, `RELAY_REGION_COUNTRY`,
  `RELAY_REGION_CITY`, `RELAY_REGION_TZ`, and `RELAY_REGION_LOCALE`.
  The "lead" instance discovers its siblings via `RELAY_PEERS`, a JSON
  array of region descriptors, and surfaces them through
  `/api/relay/nodes`. There is no centrally hard-coded relay list.

  See [RELAY.md](./RELAY.md) for the full schema.

  ---

  ## ⚖️ Trust model

  To use ShadowNet today you implicitly trust:

  1. The ShadowNet operator (us) for the relay infrastructure.
  2. The operator of the remote-browser pool, if you use the holder tier.
  3. The browser and OS running the client.
  4. Solana RPC providers queried by the Intel Hub and entitlement check.
  5. The TLS certificate authorities trusted by your browser.

  Wallet keys are explicitly out of this list. They never leave your
  browser.

  ---

  ## 🛣️ Future direction

  - Independent third-party audit of the relay and orchestrator code.
  - Reproducible client builds.
  - Wider geographic distribution.
  - Open-source reference implementation of the remote-browser pool, so
    community operators can run additional capacity.

  See [STATUS.md](./STATUS.md) for the current state and
  [CHANGELOG.md](./CHANGELOG.md) for release notes.
  