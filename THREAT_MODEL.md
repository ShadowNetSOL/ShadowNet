# ShadowNet Threat Model

  This document describes, in plain terms, what ShadowNet is designed to defend
  against and — equally important — what it explicitly **does not** defend
  against. Honest scoping matters more than marketing claims.

  > ShadowNet is **experimental privacy infrastructure**. It should not be
  > relied on for high-stakes anonymity, journalism in adversarial environments,
  > or protection against well-resourced adversaries.

  ---

  ## In scope: what ShadowNet attempts to mitigate

  | Threat | Mitigation |
  | --- | --- |
  | **Direct IP exposure** to third-party sites visited via the app | Relay-based request routing — destinations see the relay IP |
  | **Passive browser fingerprinting** (canvas, WebGL, audio, fonts, screen geometry, timezone, language) | Per-session randomization of fingerprint surface in stealth sessions |
  | **Cross-session correlation** via cookies, cache, or storage | Sandboxed session isolation; no shared state across sessions |
  | **WebRTC IP leaks** | WebRTC disabled inside stealth sessions |
  | **Geolocation API leaks** | Geolocation API blocked inside stealth sessions |
  | **Service-worker persistence** | Service-worker registration prevented inside stealth sessions |
  | **Wallet identity correlation** | Anonymous Solana keypair generation per session |
  | **SSRF via the proxy** | Protocol allowlist, port denylist, private/internal IP filtering, DNS validation |
  | **Relay abuse** | Rate limiting, request throttling, upstream timeouts |
  | **Doxxing via on-chain research** | Intel Hub queries are routed through the relay layer |

  ---

  ## Out of scope: what ShadowNet does **not** protect against

  | Threat | Why ShadowNet cannot help |
  | --- | --- |
  | **Compromised or malicious relay nodes** | The relay sees source IP and request metadata. Trust in the operator is required. |
  | **Nation-state or ISP-level traffic analysis** | A single-hop relay does not defeat global passive adversaries. |
  | **Browser-level exploits or malicious extensions** | Out-of-band code execution bypasses any in-page mitigations. |
  | **Active fingerprinting** (mouse dynamics, behavioral biometrics, advanced timing attacks) | Best-effort fingerprint randomization cannot mask behavioral signals. |
  | **Account-level deanonymization** (logging in to your real Google account inside a stealth session) | If you authenticate as yourself, you are no longer anonymous. |
  | **Side-channel correlation across services** | If you reuse a wallet, a username, or a writing style, you can be linked. |
  | **Lost or leaked private keys** | ShadowNet cannot recover keys and cannot detect compromised user devices. |
  | **Smart-contract risk on Solana** | The Intel Hub provides signal, not safety guarantees. |

  ---

  ## Trust assumptions (current)

  To use ShadowNet today, you implicitly trust:

  1. **The ShadowNet operator** — relays in the current version are centrally
     operated and not yet independently audited.
  2. **Upstream public relay providers** (allorigins.win, thingproxy,
     corsproxy.io) used as temporary fallbacks. Their privacy and logging
     policies are outside ShadowNet's control. See [RELAY.md](./RELAY.md).
  3. **The browser and OS** running the client.
  4. **Solana RPC providers** queried by the Intel Hub.
  5. **The TLS certificate authorities** trusted by your browser.

  ---

  ## Roadmap to reduce trust

  - Independently operated relay nodes with published no-log policies
  - Geographic distribution and node selection transparency
  - Independent third-party audits of the relay and wallet code
  - Public uptime and incident reporting
  - Reproducible builds for the client

  See [STATUS.md](./STATUS.md) for current progress and [RELAY.md](./RELAY.md)
  for the relay roadmap.

  ---

  ## Reporting model gaps

  If you spot a threat we haven't covered or a mitigation that overstates what
  the system delivers, please open an issue (or follow the responsible
  disclosure process in [SECURITY.md](./SECURITY.md) for security-sensitive
  reports). We treat clarity in the threat model as a first-class requirement.
  