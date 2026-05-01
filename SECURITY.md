# Security

  This document describes ShadowNet's security model, the layers of
  protection it ships in production today, and the limits of what it
  can guarantee. Every claim is grounded in code paths in this
  repository. Honest scoping matters more than marketing claims; if a
  control isn't a hard guarantee, we don't frame it as one.

  For a per-threat breakdown, see [THREAT_MODEL.md](./THREAT_MODEL.md).

  Where a control is part of the active roadmap rather than the live
  build, it is labelled **Planned**. Everything else is **Live**.

  ---

  ## Security principles

  ShadowNet follows a pragmatic posture:

  - **Minimise trust assumptions** wherever possible.
  - **Fail safely.** Invalid or risky requests are rejected, never silently
    rerouted.
  - **Prefer transparency over guarantees.** Users get an honest verdict,
    not a checkmark.
  - **Limit data exposure** rather than promise full anonymity.
  - **No dark patterns.** Every claim in the UI is backed by a code path
    you can read in this repo.

  ---

  ## What ShadowNet protects against

  **Live today:**

  - Direct IP exposure from the user's browser to third-party sites,
    through the server-side proxy
  - Server-side request forgery (SSRF), by DNS-checking every proxied
    hostname against RFC 1918 / loopback / link-local ranges and
    rejecting non-HTTP(S) protocols and a blocked-port list
  - Wallet identity correlation, since keys are generated and held in
    the browser using audited primitive libraries
  - Anti-bot wall surprise, through a server-side reachability + page
    classifier that returns an honest verdict before the user navigates
    through the proxy
  - Header fingerprinting through the browser's default `User-Agent`,
    by rotating the outbound UA per request from a curated pool

  **Planned:**

  - Passive browser fingerprinting at every layer (canvas, WebGL,
    audio, fonts, screen geometry, hardware concurrency, device memory,
    timezone, language) via region-coherent atomic preset bundles
  - Cross-session correlation through cookies, cache, or storage, via
    session-isolated remote-browser containers
  - WebRTC IP leaks and geolocation API leaks inside stealth sessions,
    via a page-level shim
  - Hard-gated destinations (Cloudflare Turnstile, hCaptcha, DataDome,
    PerimeterX, Akamai BotManager) via classifier-driven escalation to
    a remote disposable-Chromium pool

  ## What ShadowNet does **not** protect against

  - Compromised infrastructure operators (us, or any future remote-pool
    operator). The architecture minimises what we hold but does not
    eliminate the operator trust assumption entirely.
  - Advanced fingerprinting techniques (mouse-movement biometrics,
    scroll dynamics, sub-millisecond timing attacks).
  - Browser-level exploits or malicious extensions installed in the
    user's browser.
  - Nation-state or ISP-level traffic-analysis adversaries who can
    observe both ends of a connection.
  - Account-level deanonymisation. If you log in to your real Google
    account inside a stealth session, you are no longer anonymous.
  - Any guarantee that any third-party service will accept proxied
    traffic. Anti-bot vendors evolve continuously and not every
    destination will work every day.

  See [THREAT_MODEL.md](./THREAT_MODEL.md) for the full table.

  ---

  ## Stealth proxy hardening — Live

  The proxy at `/api/proxy?url=…` runs every request through a SSRF
  guard before any outbound `fetch`:

  - **Protocol allowlist.** Only `http://` and `https://` are accepted.
  - **Blocked port list.** Ports 22, 25, 3306, and 6379 are rejected.
  - **DNS-resolved private-IP rejection.** The hostname is resolved with
    `dns.lookup({ all: true })` and any address inside an RFC 1918
    range, loopback (`127.0.0.0/8`, `::1`), or link-local
    (`169.254.0.0/16`) is rejected. This catches DNS-rebind tricks
    that a string-based check alone would miss.
  - **URL parse failure rejection.** Malformed URLs are dropped before
    any outbound traffic.

  **Header hygiene on the response side.** The proxy strips
  `X-Frame-Options`, `Content-Security-Policy`,
  `X-Content-Type-Options`, `Strict-Transport-Security`, and
  `Access-Control-Allow-Origin` so the proxied page renders inside an
  embedded frame. This is a deliberate trade-off: the user gets
  in-frame rendering, and CSP / HSTS protections against the **target
  site** are intentionally relaxed for the proxied response. The user
  remains protected by the page-level interception script (which
  reasserts that the page cannot navigate outside the proxy boundary)
  and by the SSRF guard on every subsequent request the page makes.

  **SPA-aware interception.** A small script is injected at the top of
  `<head>` for every HTML response. It patches:

  1. `window.location` (so a Next.js / React Router / Vue Router app
     sees the real target URL when it builds links)
  2. `fetch` and `XMLHttpRequest` (so dynamic API calls stay inside
     the proxy)
  3. `Element.setAttribute('src' | 'href')` and the
     `HTMLScriptElement.src` / `HTMLLinkElement.href` property
     setters (so webpack chunk loaders, dynamic `import()`, and
     late-injected `<script>` / `<link>` tags also stay routed)

  Without this, the proxy survives the first navigation but breaks on
  the second click. The script is the load-bearing piece of SPA support
  and is reviewable in `artifacts/api-server/src/routes/proxy.ts`.

  **Rate limiting.**

  - **Global**: 60 requests / minute / IP via `express-rate-limit`,
    applied to `/api/proxy` and `/api/intelligence`.
  - **Slow-down**: `express-slow-down` adds a 500 ms delay per hit
    after the first 20 requests in a window on `/api/proxy`.
  - **Per-endpoint**: the GitHub scanner under `/api/intelligence` has
    its own dedicated 8-per-minute limiter because every call hits a
    paid AI endpoint.

  **Request timeouts.**

  - 10 s app-wide on every API request.
  - The GitHub scanner overrides this to 60 s for the AI pass; on
    timeout the response is a clean 504, never a half-completed scan.

  **Logging discipline.** The proxy code intentionally logs no request
  bodies, no request headers, no response bodies, and no client IPs.
  Standard Express access logs (method, status, duration) reach the
  hosting platform; nothing else does.

  ---

  ## Wallet and key management — Live

  ShadowNet's wallet generator is the most security-sensitive code path
  in the system. It is also one of the smallest, by design.

  - **Wallet generation runs entirely in your browser.** The server has
    no `/wallet/generate` endpoint and no code path that ever sees a
    mnemonic, seed, or private key. There is no route file for keys,
    there is no db schema for keys, there is no environment variable
    that influences key derivation. Search the repo: there is nothing
    to find.
  - **Audited primitive libraries.** The browser uses
    [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) for the
    BIP-39 mnemonic and seed (audited),
    [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) for
    HMAC-SHA512 (audited), and
    [`@noble/ed25519`](https://github.com/paulmillr/noble-ed25519) for
    Ed25519 signing and verification (audited). Note: the libraries are
    audited, not the dApp itself.
  - **Standard Solana derivation.** SLIP-0010 hardened derivation on
    the path `m/44'/501'/0'/0'`. This is the path Phantom uses, so
    the keypair is importable without ceremony.
  - **Phantom-compatibility verified.** Identical secret bytes produce
    the identical public key under `@solana/web3.js`'s
    `Keypair.fromSecretKey`, and a roundtrip sign / verify passes.
  - **Defense-in-depth runtime checks.** Generation refuses to run if
    WebCrypto `getRandomValues` is unavailable, if the RNG returns
    all zeros on a probe, or if the page is not in a secure context
    (HTTPS or localhost). Each refusal raises a typed error that
    surfaces in the UI rather than silently returning a weak key.
  - **Best-effort wipe.** All intermediate buffers (HMAC working state,
    derived chain codes, the 64-byte secret-key buffer) are
    `.fill(0)`'d in the `finally` block once the keypair is returned.
    The returned `mnemonic` and `privateKey` strings remain in the
    React tree until the user navigates away; that exposure is
    unavoidable in JavaScript.
  - **Provenance descriptor.** The wallet object includes a
    `provenance` field with the entropy source, RNG bits, curve,
    derivation standard, mnemonic standard, and library list. A user
    can independently verify that the values in front of them came from
    the method they expect.

  You remain responsible for your own keys: back up the mnemonic, treat
  the private key as a password-equivalent secret, and never paste it
  into untrusted surfaces.

  ---

  ## Holder-tier authentication — Planned

  Holder-tier access (the planned remote-browser pool, plus future
  gated endpoints) will be gated by Solana SPL balance and verified
  end-to-end:

  1. `/api/auth/challenge` returns a one-time nonce.
  2. The user signs the challenge message with their wallet via Phantom
     or Solflare.
  3. `/api/auth/verify-holder` verifies the Ed25519 signature against
     the wallet's public key, then queries Helius for the wallet's SPL
     balance against the configured `ENTITLEMENT_MINT`.
  4. On success, the server issues an HMAC-signed claim token bound to
     a `deviceHash` (a SHA-256 hash of stable browser identity inputs).
  5. The orchestrator validates the claim without further RPC calls on
     subsequent requests, keeping the hot path fast.

  Tokens will have a 15-minute TTL. A wallet that drops below the
  threshold mid-session loses access at most 15 minutes later. The
  frontend silently re-signs near expiry. Cross-machine replay is
  prevented by the device binding: a stolen claim is useless on another
  browser.

  This entire surface is architected and partially implemented; see
  [ROADMAP.md](./ROADMAP.md#holder-tier-authentication) for status.

  ---

  ## Remote-browser pool isolation — Planned

  If the holder-tier remote browser ships, ShadowNet will talk to a
  separately-operated pool over a private HTTP API. The pool contract
  documented for operators (in `artifacts/api-server/src/lib/remotePool.ts`
  when shipped) requires:

  1. A fresh Chromium profile per session, with no reused user-data
     directory and no persistent cache, history, or extensions.
  2. Disk persistence disabled, via `--incognito` or
     `--user-data-dir` pointing at a tmpfs.
  3. Containers are torn down on `DELETE /sessions/:id` or on
     idle-kill. No container is ever reused. "Warm pool" means
     pre-spawned, not pre-used.
  4. The fingerprint we send is applied at the launch-flag layer (UA,
     sec-ch-ua-platform headers, languages, timezone, screen,
     hardware concurrency, device memory, WebGL vendor and renderer),
     not via JS injection (which leaks via getter origin).
  5. `seedState` (for in-session escalation) is scoped strictly:
     cookies set only for `seedState.host` with no `.domain`
     wildcards; `localStorage` written only against
     `seedState.origin`; the snapshot is rejected if
     `document.location.origin` doesn't match. Applied **before** the
     first navigation so the destination sees a logged-in user
     reloading, not a fresh hit.
  6. Outbound traffic to ShadowNet's egress IPs is forbidden, so a
     malicious dApp cannot pivot through the pool to reach the
     orchestrator's internal endpoints.
  7. Clipboard sync is disabled by default. Many WebRTC browser stacks
     expose a clipboard channel; that would leak copied wallet
     addresses and break the user's local clipboard.
  8. Service Workers and IndexedDB persistence are disabled in the
     launched profile flags. Anything that writes to disk would
     survive container lifetime if the operator misconfigured the
     tmpfs.

  These are operator-side requirements. ShadowNet will degrade
  gracefully (return an "unavailable" descriptor and stay on the proxy
  tier) until `REMOTE_BROWSER_POOL_URL` is set and the pool side ships.

  ---

  ## Disclosure

  If you find a vulnerability in any ShadowNet code path, please open a
  private security advisory through GitHub or DM the maintainers on the
  project's official channels. We treat responsible disclosure
  seriously and will credit reporters who request it.
  