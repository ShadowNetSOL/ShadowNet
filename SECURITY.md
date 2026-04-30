# Security

  This document describes ShadowNet's security model, the layers of
  protection it ships in production, and the limits of what it can
  guarantee. We prefer honest scoping over marketing claims; if a control
  isn't a hard guarantee, it isn't framed as one.

  For a per-threat breakdown, see [THREAT_MODEL.md](./THREAT_MODEL.md).

  ---

  ## Security principles

  ShadowNet follows a pragmatic posture:

  - **Minimise trust assumptions** wherever possible.
  - **Fail safely.** Invalid or risky requests are rejected, never silently
    rerouted.
  - **Prefer transparency over guarantees.** Users get an honest verdict,
    not a checkmark.
  - **Limit data exposure** rather than promise full anonymity.

  ---

  ## Threat model summary

  ShadowNet is designed to mitigate:

  - Direct IP exposure to third-party services.
  - Passive browser fingerprinting (canvas, WebGL, audio, fonts, screen
    geometry, timezone, language).
  - Cross-session correlation through cookies, cache, or storage.
  - WebRTC IP leaks and geolocation API leaks inside stealth sessions.
  - SSRF through the proxy.
  - Wallet identity correlation, since keys are generated and held in the
    browser.

  ShadowNet does **not** protect against:

  - Compromised infrastructure operators (us or the remote-pool operator).
  - Advanced fingerprinting techniques (mouse dynamics, behavioural
    biometrics, advanced timing attacks).
  - Browser-level exploits or malicious extensions.
  - Nation-state or ISP-level traffic-analysis adversaries.
  - Account-level deanonymisation. If you log in to your real Google
    account inside a stealth session, you are no longer anonymous.

  See [THREAT_MODEL.md](./THREAT_MODEL.md) for the full table.

  ---

  ## Stealth proxy hardening

  The proxy is built on Ultraviolet over a hardened
  `@tomphttp/bare-server-node` backend.

  **Input validation**

  - Only `http://` and `https://` are accepted.
  - A blocked-port list rejects access to common service ports
    (22, 25, 3306, 6379).
  - Hostnames are resolved via DNS and any address inside an RFC 1918
    range, loopback, or link-local block is rejected.
  - Malformed URLs are dropped before any outbound fetch.

  **Header hygiene**

  - `X-Powered-By` is removed at both the Express layer and the raw
    HTTP layer in case any middleware re-adds it.
  - `Server` is removed on bare-server responses.
  - The bare server logs hostname and HTTP status only. No request bodies,
    no response bodies, no headers, no client IPs.

  **Rate limiting**

  - 60 requests per minute per IP on `/api/intelligence` and `/api/relay`.
  - A slow-down on `/api/relay` adds a 500 ms delay per hit after the
    first 20 in a window.
  - Every API request has a 10-second server-side timeout.

  **Geographic policy**

  - An OFAC country-code soft-block list is exported for upstream
    enforcement (Cloudflare or Railway middleware). The application layer
    does not enforce geo blocks itself.

  ---

  ## Page-level shim

  Inside a stealth session, the page-level shim:

  - Disables WebRTC entirely to prevent local-IP leaks.
  - Blocks the geolocation API.
  - Prevents service-worker registration from the destination origin.
  - Spoofs `navigator.userAgent`, `navigator.platform`,
    `navigator.userAgentData`, `navigator.hardwareConcurrency`,
    `navigator.deviceMemory`, `navigator.languages`, `screen.*`,
    `Intl` timezone, WebGL vendor and renderer, canvas noise, and audio
    noise to match the session's preset.

  The fingerprint that the page sees is the same fingerprint the bare
  server applies to outgoing HTTP headers. This alignment is enforced
  server-side via the in-memory session store keyed by session id, so an
  anti-bot system cannot trip on a UA / Accept-Language mismatch.

  ---

  ## Wallet and key management

  - **Wallet generation runs entirely in your browser.** The server has no
    `/wallet/generate` endpoint and no code path that ever sees a
    mnemonic, seed, or private key.
  - The browser-side implementation uses audited primitives:
    `@scure/bip39` for BIP-39 mnemonic and seed,
    `@noble/ed25519` for Ed25519 signing and verification,
    and SLIP-0010 hardened derivation on the standard Solana path
    `m/44'/501'/0'/0'`.
  - Phantom-compatibility is verified against `@solana/web3.js`'s
    `Keypair.fromSecretKey`. Identical secret bytes produce the identical
    public key, and the keypair signs and verifies correctly.
  - Keys live only in volatile browser memory. They are never persisted
    by ShadowNet, transmitted over the network, or written to logs.
  - The proxy and orchestrator never require key custody.

  You remain responsible for your own keys: back up the mnemonic, treat
  the private key as a password-equivalent secret, and never paste it
  into untrusted surfaces.

  ---

  ## Holder-tier authentication

  Holder-tier access (the remote-browser pool) is gated by Solana SPL
  balance and verified end-to-end:

  1. `/api/auth/challenge` returns a one-time nonce.
  2. The user signs the challenge message with their wallet.
  3. `/api/auth/verify-holder` verifies the ed25519 signature, then
     queries Helius for the wallet's SPL balance against the configured
     `ENTITLEMENT_MINT`.
  4. On success, the server issues an HMAC-signed claim token bound to a
     `deviceHash` (a SHA-256 hash of stable browser identity inputs).
  5. The orchestrator validates the claim without further RPC calls on
     subsequent requests, keeping the hot path fast.

  Tokens have a 15-minute TTL. A wallet that drops below the threshold
  mid-session loses access at most 15 minutes later. The frontend
  silently re-signs near expiry. Cross-machine replay is prevented by
  the device binding: a stolen claim is useless on another browser.

  ---

  ## Remote-browser pool isolation

  If you use the holder-tier remote browser, ShadowNet talks to a
  separately-operated pool over a private HTTP API. We document the
  following hard isolation requirements that compliant pool
  implementations MUST satisfy:

  1. Spawn a fresh Chromium profile per session. No reused user-data
     directory, no persistent cache, no installed extensions.
  2. Disable disk persistence (`--incognito` or a tmpfs user-data dir).
  3. Never reuse a container across sessions. Tear down on
     `DELETE /sessions/:id` and on idle-kill.
  4. Apply the fingerprint we send (UA, sec-ch-ua-platform, languages,
     timezone, screen, hardware concurrency, device memory, WebGL
     vendor/renderer) at the launch-flag layer, not via JS injection.
  5. If a `seedState` snapshot is provided, scope it strictly: cookies
     only for the seed host with no `.domain` wildcards, localStorage
     only for the seed origin, applied before the first navigation.
  6. Forbid outbound traffic to ShadowNet's egress IPs so a malicious
     dApp cannot pivot through the pool back into the relay.

  These constraints are documented in code at
  `artifacts/api-server/src/lib/remotePool.ts` and shipped to operators
  as part of the integration spec.

  ---

  ## Data handling

  - ShadowNet does not intentionally persist user browsing data.
  - Requests are processed in memory and forwarded to upstream services.
  - No user authentication or identity tracking is implemented at the
    application layer. The only identity surface is the holder-tier
    signature flow, which is per-session and HMAC-bound.
  - Standard server logs (timestamps, hostnames, status codes) may exist
    for abuse prevention. They are not designed for long-term storage or
    user profiling.
  - The session store is in-memory only. It is cleared on every process
    restart by design.

  ---

  ## Reporting vulnerabilities

  If you discover a security issue:

  1. **Do not file a public issue.** Contact the maintainers privately
     through the channel listed at
     [shadownet.network](https://shadownet.network) or via a GitHub
     security advisory on
     [the repository](https://github.com/ShadowNetSOL/ShadowNet/security/advisories/new).
  2. Include reproduction steps, impact assessment, and any proof of
     concept.
  3. Allow reasonable time for review and remediation before any public
     disclosure.

  We commit to acknowledging valid reports within 72 hours and to keeping
  reporters informed through the remediation cycle.

  ---

  ## Security clarifications

  - User-Agent filtering is used only for basic abuse detection. It is
    **not** relied on as a security boundary.
  - IP masking is achieved through relay-based request routing, not
    through any client-side anonymisation.
  - Fingerprint randomisation is best-effort. It substantially raises the
    bar against passive fingerprinting but does not promise unlinkability
    against active or behavioural attacks.
  - The classifier is a heuristic. It exists to drive escalation, not to
    block content.
  