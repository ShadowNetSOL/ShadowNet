# ShadowNet Threat Model

  This document describes, in plain terms, what ShadowNet is designed to
  defend against and, equally important, what it explicitly does not
  defend against. Honest scoping matters more than marketing claims.

  > ShadowNet is a privacy-first dApp. It is not a substitute for
  > hardened operational security in adversarial environments. Treat the
  > threat model as a tool for matching your use case to the right level
  > of protection, not as a guarantee of any specific outcome.

  Each row below is labelled **Live** or **Planned** so you can match the
  mitigation to what runs today versus what is on the roadmap.

  ---

  ## Adversary classes

  | Adversary | What they want | ShadowNet posture |
  | --- | --- | --- |
  | Curious dApp / website | Your IP, browser fingerprint, an account they can reuse to track you | Defended (Live, partial) |
  | Anti-bot vendor (Cloudflare, DataDome, PerimeterX, Akamai) | Decide whether to serve you a challenge or a 403 | Pre-flight classifier (Live), classifier-driven escalation to disposable Chromium (Planned) |
  | Memecoin scam-coordinator | A wallet they can hide a rug behind | Defended at the intelligence layer (Live): cross-signal graph surfaces shared identity across wallet, repo, and X |
  | Ad-tech / fingerprint vendor | Stable, cross-session identifier for the user | Browser-only wallet (Live), per-request UA rotation (Live), atomic fingerprint preset bundles (Planned) |
  | Compromised infrastructure operator (us, or a future remote-pool operator) | Snoop on user activity | Mitigated by no-key architecture and zero-body logging (Live), not eliminated (operator trust assumption remains) |
  | Compromised destination site | Pivot inside the user's session, exfiltrate cross-origin data | Per-target SSRF guard (Live), planned page-level shim with WebRTC and geolocation block (Planned), planned remote-browser isolation contract (Planned) |
  | Browser-level attacker (malicious extension, OS-level malware) | Steal keys directly from the user's browser | **Out of scope.** ShadowNet cannot defend against code running inside the user's browser process. |
  | Nation-state or ISP-level traffic-analysis adversary | Correlate user → destination by observing both ends of the connection | **Out of scope.** ShadowNet is not Tor; users requiring that level of unlinkability should use Tor or i2p. |

  ---

  ## Defended threats (Live today)

  ### Direct IP exposure to third-party services

  The proxy at `/api/proxy` fetches every destination server-side. The
  destination sees the API server's outbound IP (verifiable via
  `/api/relay/verify`, which echoes the relay IP), never the user's.

  ### Server-side request forgery (SSRF)

  Every proxied URL is parsed, the protocol is checked against the
  `http/https` allowlist, the port is checked against a blocked-port
  list, and the hostname is DNS-resolved with `dns.lookup({ all: true })`
  and rejected if it resolves to any address inside RFC 1918, loopback,
  or link-local ranges. This is a stronger check than a string-based
  "contains 192.168" filter and catches DNS-rebind attempts.

  ### Header fingerprinting via the default User-Agent

  Every outbound request from `/api/proxy` and `/api/relay/verify`
  ships a randomised UA from a curated pool. The destination sees a
  plausible browser, never `node-fetch/x.y.z` or the upstream Node
  default.

  ### Wallet-identity correlation

  The wallet generator runs entirely in the browser using audited
  primitive libraries (`@scure/bip39`, `@noble/hashes`,
  `@noble/ed25519`). The server has no key endpoint and no code path
  that ever sees a mnemonic, seed, or private key. Defense-in-depth
  runtime checks refuse to generate keys without a working OS-grade
  RNG and a secure context.

  ### Anti-bot wall surprise

  Before opening a proxied tab, the user can run
  `/api/relay/verify?url=…`. The server fetches the destination once
  with a spoofed UA and returns the status code, content-type, page
  title, latency, and the relay's own outbound IP. This lets the UI
  warn honestly when a destination is gated, instead of opening a tab
  that white-screens.

  ### On-chain identity laundering by scam coordinators

  The intelligence layer runs three independent signal streams and
  correlates them in the cross-signal graph: which wallets touched a
  mint, which repos referenced it in a README, which X accounts posted
  the CA. The verdict policy ranks results: `SAME_ENTITY_LIKELY` only
  when all three channels overlap; `CONVERGENT_INTEREST` for two-channel
  overlap; `ISOLATED` otherwise. Returned wallet addresses are masked
  (`first4…last4`) so prior-scan addresses are not leaked verbatim
  to unrelated callers.

  ---

  ## Defended threats (Planned)

  ### Passive browser fingerprinting

  The planned region-coherent preset bundles will lock together UA,
  platform, sec-ch-ua-platform, WebGL vendor and renderer, fonts,
  screen resolution, hardware concurrency, device memory, timezone, and
  locale. Every surface is internally consistent so anti-bot checks
  that look for "Windows UA + Apple GPU" inconsistencies cannot trip on
  a mismatch we created ourselves.

  ### Cross-session correlation through cookies, cache, or storage

  The planned remote-browser pool ships a session-isolation contract:
  fresh Chromium profile per session, no reused user-data directory,
  disk persistence disabled, container torn down on session end. State
  that survives the session does not exist.

  ### WebRTC IP leaks and geolocation API leaks

  The planned page-level shim disables the WebRTC PeerConnection
  constructor inside stealth sessions (which is the leak vector for
  the user's local IP) and blocks the Geolocation API.

  ### Hard-gated destinations (Cloudflare Turnstile, hCaptcha, DataDome, PerimeterX, Akamai BotManager)

  The planned two-tier orchestrator routes hard-gated destinations to a
  remote disposable Chromium that the destination sees as a real
  browser. The classifier ships eleven challenge types and a confidence
  score; routing decisions are deterministic for high-confidence cases
  and weighted-scored for the gray zone.

  ### Mid-session escalation without re-login

  The planned remote-browser flow accepts an origin-scoped `seedState`
  snapshot from the proxy tier so a user who hits a challenge halfway
  through a logged-in session can escalate without losing their
  session. The pool-side contract enforces strict origin scoping so a
  seed cannot be replayed against a different host.

  ---

  ## Out of scope

  ### Compromised infrastructure operators

  If we are coerced or compromised, the wallet generator still cannot
  leak keys (it runs in the user's browser and we have no endpoint to
  exfiltrate to), but proxied browsing traffic flows through our IP
  range and is observable to us in principle. The architecture
  minimises what we hold (no logs of bodies, headers, or IPs; in-memory
  session state only) but does not eliminate the operator trust
  assumption entirely. A future architecture goal is to push proxied
  traffic through end-to-end encrypted relays we can also not observe;
  this is not in the current build.

  ### Browser-level exploits and malicious extensions

  If the user's browser is compromised at the process level, ShadowNet
  cannot help. A malicious extension with the right permissions can
  read every key the user generates and every page they navigate to.
  The mnemonic and private-key strings remain in the React tree until
  the user navigates away; that is unavoidable in JavaScript.

  ### Nation-state or ISP-level traffic analysis

  ShadowNet is not Tor. An adversary who can observe both the user's
  ISP traffic and the destination's ingress can correlate the two
  endpoints by timing and volume. Users who require that level of
  unlinkability should use a circuit network designed for it.

  ### Account-level deanonymisation

  If the user logs in to their real Google, Twitter, or exchange
  account inside a stealth session, the account itself identifies them
  to the destination service. ShadowNet does not stop this and never
  will: the point is to give the user the option to be anonymous, not
  to make impossible decisions for them.

  ### Advanced behavioural fingerprinting

  Mouse-movement biometrics, scroll-velocity profiling, keystroke-
  timing analysis, and other techniques that build a fingerprint from
  how the user interacts with the page are out of scope. The planned
  fingerprint preset bundles cover passive surfaces; behavioural
  fingerprinting is an arms race we explicitly do not enter today.

  ### Smart-contract risk on the user's wallet

  ShadowNet generates keypairs and surfaces intelligence. It does not
  review the smart-contract code that the user's wallet might
  ultimately interact with. That responsibility stays with the user.

  ---

  ## Verifiability

  Every defended-threat claim above maps to a code path in this
  repository. If you cannot find the corresponding code, file an issue
  and we will fix the doc or fix the code, whichever is wrong.
  