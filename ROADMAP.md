# Roadmap

  ShadowNet is shipping the privacy stack Web3 was supposed to have, in
  phases. This document captures the **Planned** features in detail, why
  they exist, and the architecture we have committed to. Everything in
  this file is forward-looking; for what runs today, see
  [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

  > Forward-looking. Items below are under active development by the
  > core team. Architectures are committed; target windows are best-
  > estimate, not contractual.

  ---

  ## Phase 1 — Stealth browsing v2 (UV bare-server)

  The current proxy is an HTML-rewriter with a clever interception
  script. It works for most static and SPA destinations and breaks on
  realtime-heavy sites (WebSockets in pump.fun's launchpad feed,
  EventSource streams in dexscreener live charts) plus a handful of
  edge cases in dynamic-import-heavy bundlers.

  **The plan:** ship a service-worker proxy on Ultraviolet, mounted
  under `/service/` in the client and backed by
  `@tomphttp/bare-server-node` at `/bare/` on the API server.

  What changes for the user:

  - Realtime sites work (WebSocket upgrade is forwarded by bare).
  - Dynamic-import edge cases disappear (the SW intercepts every
    fetch, including those the page didn't know it was making).
  - Page load is faster because the rewrite step on the response body
    goes away.

  What changes for the operator:

  - Bare server is mounted with a strict origin allowlist.
  - The SW scope (`/service/`) is isolated from the dApp scope (`/`)
    so a compromised destination cannot pivot into the dApp.
  - The same SSRF guard that today protects `/api/proxy` is ported
    to the bare server's outbound fetch path.

  ---

  ## Phase 2 — Region-coherent fingerprint preset bundles

  Today, the `/api/session/fingerprint` endpoint returns a randomised
  fingerprint blob (UA, screen, timezone, fonts, WebGL vendor /
  renderer, canvas / audio hashes) that the UI displays. The proxy
  itself rotates UAs from a small pool. There is no link between the
  two surfaces.

  **The plan:** ship eight atomic preset bundles, one per OS-class
  (Windows + Chrome, Windows + Edge, macOS + Safari, macOS + Chrome,
  Linux + Firefox, Linux + Chrome, Android + Chrome, iOS + Safari).
  Each bundle locks together:

  - `User-Agent`
  - `sec-ch-ua`, `sec-ch-ua-platform`, `sec-ch-ua-mobile`
  - WebGL vendor and renderer (matched to the platform)
  - Font list (matched to the OS)
  - Screen resolution and color depth (matched to a plausible device)
  - Hardware concurrency and device memory
  - Timezone and locale (matched to the relay region)

  Sessions pick one bundle at start. Every outbound HTTP header, every
  JS-exposed property, and every relayed WebSocket handshake uses the
  same bundle for the session's lifetime. Anti-bot vendors that look
  for "Windows UA + Apple GPU" inconsistencies cannot trip on a
  mismatch we created ourselves.

  ---

  ## Phase 3 — Two-tier orchestrator

  A privacy proxy that handles the easy 80 % of destinations is a
  marketing demo. The remaining 20 % (Cloudflare Turnstile, hCaptcha,
  DataDome, PerimeterX, Akamai BotManager) is the difference between a
  toy and a product.

  **The plan:** introduce an orchestrator that, on every request,
  decides between two tiers:

  - **Tier 1 — In-region proxy** (the bare-server stealth flow, fast,
    cheap, handles most destinations).
  - **Tier 2 — Remote disposable Chromium pool** (slower, expensive,
    handles every hard-gated destination by being a real browser).

  The orchestrator's input signals:

  - Result of `/api/relay/verify` (status, latency, anti-bot
    classifier verdict).
  - Per-host failure history (recent failures on the same destination
    push routing to Tier 2).
  - Caller's holder-tier entitlement (Tier 2 is a paid surface).
  - Classifier confidence on the eleven challenge types we recognise.

  The output is a routing decision with an explanation. High-confidence
  cases route deterministically; the gray zone uses a weighted
  `routingScore` so users get consistent behaviour without flapping.

  ---

  ## Phase 4 — Holder-tier authentication

  Tier 2 (the remote-browser pool) is expensive per-session. It is
  gated by Solana SPL holder status against a configured
  `ENTITLEMENT_MINT`.

  **The plan:**

  1. `/api/auth/challenge` returns a one-time nonce.
  2. The user signs the challenge with Phantom or Solflare.
  3. `/api/auth/verify-holder` validates the Ed25519 signature and
     queries Helius for the wallet's SPL balance.
  4. On success, the server issues an HMAC-signed claim token bound to
     a `deviceHash` (SHA-256 of stable browser identity inputs).
  5. The orchestrator validates the claim on every Tier 2 request
     without further RPC calls.

  Token TTL is 15 minutes. A wallet that drops below the threshold
  mid-session loses access at most 15 minutes later. The frontend
  silently re-signs near expiry. Cross-machine replay is prevented by
  the device binding: a stolen claim is useless on another browser.

  ---

  ## Phase 5 — Remote disposable-Chromium pool

  The pool is operated as a separate service ShadowNet talks to over a
  private HTTP API at `REMOTE_BROWSER_POOL_URL`. The pool-side
  contract:

  1. Fresh Chromium profile per session, no reused user-data
     directory, no persistent cache, history, or extensions.
  2. Disk persistence disabled (`--incognito` or
     `--user-data-dir` pointing at tmpfs).
  3. Containers torn down on `DELETE /sessions/:id` or on idle-kill.
     No container is ever reused. "Warm pool" means pre-spawned, not
     pre-used.
  4. Fingerprint applied at the launch-flag layer (UA,
     sec-ch-ua-platform, languages, timezone, screen, hardware
     concurrency, device memory, WebGL vendor / renderer), not via
     JS injection.
  5. `seedState` (for in-session escalation) scoped strictly to
     `seedState.host` and `seedState.origin`, applied before the
     first navigation.
  6. Outbound traffic to ShadowNet egress IPs forbidden, so a
     malicious dApp cannot pivot through the pool.
  7. Clipboard sync disabled by default.
  8. Service Workers and IndexedDB persistence disabled.

  The pool is streamed to the user over WebRTC for low-latency input.

  ---

  ## Phase 6 — Trading terminal

  ShadowNet ships a stealth proxy and a wallet generator. Users today
  can already paste those into Jupiter, Raydium, or Photon. The
  trading-terminal phase brings the swap experience native to the dApp
  so users never have to leave a private session to trade.

  **The plan:**

  - **Token discovery.** Combine the Pump.fun feed (live today) with
    Solana token-2022 launches and a holder-distribution scan. Sort
    controls for volume, age, change. Market-cap tiering: micro
    (<$100k), small ($100k–$1m), mid ($1m–$10m), large ($10m+).
  - **Alpha-score classifier.** Ten layers: liquidity depth, buy-sell
    ratio, holder distribution, volume momentum, age, bonding-curve
    state, Jupiter audit signals, plus three additional layers
    (creator history, on-chain identity overlap with the cross-signal
    graph, and concentration risk). Output is BUY / WATCH / AVOID /
    PUMPING with an explanation array.
  - **Jupiter Ultra swap proxy.** Server-side Jupiter API key,
    platform-fee routing into pre-created associated token accounts
    (wSOL, USDC, USDT), 255 bps Ultra fee cap enforced server-side.
  - **Token-detail chart page.** Embedded chart with Dexscreener
    client-side fallback for freshly-launched mints, on-demand holder
    distribution, integrated trade panel.

  ---

  ## Phase 7 — Multi-region deployment

  Today, all live proxy traffic flows through one ShadowNet API
  server. The relay-node directory at `/api/relay/nodes` displays a
  curated list of planned regions for UI purposes.

  **The plan:** one Railway service per region, each booting with
  `RELAY_REGION` set and a `RELAY_PEERS` list of sibling instances.
  The lead instance discovers its siblings at boot and the
  orchestrator routes per-request to the closest healthy peer (or to
  the user-selected region if explicit).

  Each region runs the full stack (bare-server, intel cache, history
  store) so a single region failure degrades latency, not
  availability.

  ---

  ## Phase 8 — Intelligence Hub expansion

  Harden existing surfaces and add new ones:

  - **X API v2 Bearer upgrade.** Replace the Nitter scrape in `/x-ca`
    and ship the live follower-graph version of `/smart-followers`.
    The route shapes are already locked.
  - **Wire the X-channel edge into the cross-signal graph** so the
    verdict policy upgrades from a wallet ↔ repo convergence test
    to a full three-channel test.
  - **SSRF hardening on `/api/relay/verify`.** Apply the same
    private-IP / blocked-port guard list that already protects
    `/api/proxy`.
  - **Telegram channel scanning** with the same signal-extraction
    methodology used for X.
  - **Discord channel scanning** for projects that primarily live in
    Discord.
  - **Per-mint intelligence dossier**: a pre-computed view combining
    wallet activity, repo references, X posts, smart-money buys, and
    the cross-signal verdict on one URL.
  - **Webhook subscriptions** so users can be notified when watched
    wallets / handles / mints cross thresholds.

  ---

  ## How to follow along

  The repo's master branch is the current truth: every commit either
  ships a Live feature or moves a Planned feature toward Live. PRs are
  welcome on any phase. Issues tagged `roadmap` track planned work
  and are the right place to discuss prioritisation.
  