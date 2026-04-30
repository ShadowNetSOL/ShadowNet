# ShadowNet Threat Model

  This document describes, in plain terms, what ShadowNet is designed to
  defend against and, equally important, what it explicitly does not
  defend against. Honest scoping matters more than marketing claims.

  > ShadowNet is a privacy-first dApp. It is not a substitute for hardened
  > operational security in adversarial environments. Treat the threat
  > model as a tool for matching your use case to the right level of
  > protection.

  ---

  ## In scope: what ShadowNet attempts to mitigate

  | Threat | Mitigation |
  | --- | --- |
  | Direct IP exposure to third-party sites visited via the app | Service-worker proxy routes every page-initiated request through ShadowNet infrastructure. Destinations see the relay IP. |
  | Passive browser fingerprinting (canvas, WebGL, audio, fonts, screen geometry, timezone, language, hardware) | Region-coherent fingerprint preset bundles applied both in-page and at the bare-server outgoing-header layer |
  | Cross-session correlation via cookies, cache, or storage | Sandboxed session isolation, no shared state across sessions |
  | WebRTC IP leaks | WebRTC disabled inside stealth sessions |
  | Geolocation API leaks | Geolocation API blocked inside stealth sessions |
  | Service-worker persistence by destinations | Destination-origin service-worker registration prevented |
  | Wallet identity correlation | Anonymous Solana keypair generation per session, performed entirely in the browser. The server never sees the mnemonic or private key. |
  | SSRF via the proxy | Protocol allowlist, port denylist, DNS-based private/internal IP filtering |
  | Relay abuse | Rate limiting, request throttling, upstream timeouts |
  | Anti-bot challenge walls (Cloudflare, Turnstile, hCaptcha, DataDome, PerimeterX, Akamai) | Classifier-driven escalation to the remote-browser tier for token holders |
  | Cross-machine replay of holder claims | HMAC claim tokens are bound to a device-fingerprint hash and rejected on a different device |
  | Doxxing via on-chain research | Intel Hub queries are routed through the same relay layer as browsing |

  ---

  ## Out of scope: what ShadowNet does not protect against

  | Threat | Why ShadowNet cannot help |
  | --- | --- |
  | Compromised or malicious operator infrastructure | The operator (us, or the remote-pool operator) sees source IP and request metadata. Trust in the operator is required. |
  | Nation-state or ISP-level traffic analysis | A relay does not defeat global passive adversaries. |
  | Browser-level exploits or malicious extensions | Out-of-band code execution bypasses any in-page mitigations. |
  | Active fingerprinting (mouse dynamics, behavioural biometrics, advanced timing attacks) | Best-effort fingerprint randomisation cannot mask behavioural signals. |
  | Account-level deanonymisation | If you authenticate as yourself, you are no longer anonymous. |
  | Side-channel correlation across services | If you reuse a wallet, a username, or a writing style, you can be linked. |
  | Lost or leaked private keys | Wallet keys exist only in your browser. We cannot recover them and cannot detect compromised devices, malicious extensions, or clipboard hijackers. |
  | Smart-contract risk on Solana | The Intel Hub and Alpha Score provide signal, not safety guarantees. |

  ---

  ## Trust assumptions (current)

  To use ShadowNet today you implicitly trust:

  1. **The ShadowNet operator** for the relay infrastructure (the
     per-region API server instances).
  2. **The remote-browser pool operator** if you use the holder tier.
     Pool implementations must satisfy the hard isolation requirements
     documented in `artifacts/api-server/src/lib/remotePool.ts` and
     summarised in [SECURITY.md](./SECURITY.md).
  3. **The browser and OS** running the client.
  4. **Solana RPC providers** queried by the Intel Hub and the holder
     entitlement check (Helius by default).
  5. **The TLS certificate authorities** trusted by your browser.

  Wallet keys are explicitly excluded from this list. They are generated
  and held entirely in your browser.

  ---

  ## Roadmap to reduce trust

  - Independently audited reference implementation of the remote-browser
    pool, so community operators can run additional capacity without
    needing to reinvent the isolation contract.
  - Independent third-party audits of the relay and orchestrator code.
  - Geographic distribution and node-selection transparency.
  - Public uptime and incident reporting.
  - Reproducible builds for the client.

  See [STATUS.md](./STATUS.md) for current progress and
  [RELAY.md](./RELAY.md) for the relay roadmap.

  ---

  ## Reporting model gaps

  If you spot a threat we have not covered, or a mitigation that
  overstates what the system delivers, please open an issue. For
  security-sensitive reports, follow the responsible-disclosure process
  in [SECURITY.md](./SECURITY.md). Clarity in the threat model is a
  first-class requirement, not a "nice to have".
  