# Why ShadowNet

  A short statement of intent. For the technical surface, see
  [ARCHITECTURE.md](./ARCHITECTURE.md). For the threat model, see
  [THREAT_MODEL.md](./THREAT_MODEL.md). This document is the *why* that
  makes the rest of the repo worth building.

  ---

  ## The thesis

  Web3's founding promise was permissionless, peer-to-peer, and private.
  The first two mostly arrived. The third did not.

  The modern Web3 stack leaks identity at every layer:

  - Wallets phone home to telemetry endpoints on every signature.
  - Public RPCs see your IP on every `getBalance`.
  - dApps fingerprint your browser the moment you connect.
  - Block explorers map your address to your behaviour, forever.
  - "Privacy" tools either get sanctioned (mixers) or solve only one
    small slice of the problem (a VPN does not stop fingerprinting).

  The result is the worst of both worlds: enough centralised surveillance
  to attract regulators, and enough public on-chain history to deanonymise
  anyone who does not actively defend themselves. Crypto's own users are
  the easiest target population on the internet.

  ShadowNet exists because that gap is solvable, and nobody has solved
  it end-to-end in one product.

  ---

  ## Why now

  Three timing factors make this the right window:

  1. **Anti-bot infrastructure has caught up to stealth tooling.**
     Cloudflare Turnstile, hCaptcha, DataDome, PerimeterX, and Akamai
     BotManager now block almost every naive proxy and headless-browser
     setup within seconds. A serious privacy product needs a real
     answer, not a single-tier proxy that collapses on the first
     challenge wall.
  2. **On-chain entitlement is finally clean.** Solana's signing UX,
     plus mature mints and SPL balance reads via Helius, make it
     possible to gate access through a wallet signature instead of a
     Stripe checkout. No emails, no passwords, no off-chain accounts.
     The token is the access.
  3. **Browser-side cryptography is production-ready.** `@scure/bip39`,
     `@noble/ed25519`, and SLIP-0010 are audited, fast in the browser,
     and Phantom-compatible. There is no longer any reason for a server
     to ever touch a user's mnemonic.

  These three did not exist together until recently. ShadowNet is the
  product that becomes possible when they do.

  ---

  ## Why this team, this repo

  The architectural decisions in this codebase are opinionated, and the
  opinions matter:

  - **Coherent identity, not random identity.** Atomic fingerprint
    bundles solve a class of detection that random-per-field spoofing
    cannot. This is the difference between looking suspicious and
    looking ordinary.
  - **Routing as a first-class capability.** The two-tier orchestrator
    with a classifier and per-host failure history means the product
    keeps working as the adversary upgrades. Single-tier proxies do not.
  - **No keys, no logs, no per-user state.** The server has no wallet
    endpoint, the bare server logs hostname and HTTP status only, and
    the session store is in-memory. There is nothing to subpoena, leak,
    or sell. This is a posture, not a feature flag.
  - **Open source under MIT, end to end.** Every line of the relay,
    orchestrator, and frontend is on GitHub. No closed middleware, no
    proprietary tracking SDK, no hidden dependency phoning home.
  - **Honest scoping.** [SECURITY.md](./SECURITY.md) and
    [THREAT_MODEL.md](./THREAT_MODEL.md) name what we do **not** defend
    against. A privacy product that overstates its protection is worse
    than one that admits its limits.

  ---

  ## The product proof

  Concrete things you can verify by reading the code today:

  - Stealth proxy on Ultraviolet over a hardened
    `@tomphttp/bare-server-node`. No public CORS proxies in the path.
  - Region-coherent fingerprint preset bundles applied in both the
    page-level shim and the bare-server outgoing-header layer.
  - Two-tier orchestrator with a classifier and per-host history.
  - Holder-tier authentication: nonce, ed25519 signature verification,
    Helius-backed SPL balance check, HMAC claim token bound to a
    device-fingerprint hash.
  - Browser-only Solana keypair generation, Phantom-compatible.
  - Trading terminal with a 10-layer alpha-score classifier and Jupiter
    Ultra swaps fee-routed through pre-created ATAs.
  - Intel Hub: Wallet Analyzer, X CA Checker (official X API v2),
    Smart Followers, GitHub Scanner.

  Everything above is live in production at
  [shadownet.network](https://shadownet.network). See
  [STATUS.md](./STATUS.md) for the live-component matrix.

  ---

  ## Where this goes

  The roadmap is about raising the trust ceiling, not closing capability
  gaps. In rough priority order:

  - Independent third-party security audit of the relay and orchestrator.
  - Open-source reference implementation of the remote-browser pool, so
    community operators can run additional capacity without reinventing
    the isolation contract.
  - Wider geographic distribution of the region registry.
  - Public uptime dashboard with per-region availability.
  - Reproducible client builds.
  - Public incident reporting.

  Each of these reduces how much you have to trust us specifically, and
  makes ShadowNet harder to coerce, take down, or quietly compromise.
  That is the goal.

  ---

  ## Closing

  Privacy is not a side feature, a settings toggle, or a marketing
  adjective. It is an architectural property that has to be designed in
  from the first commit. ShadowNet was. That is the entire reason this
  repo exists.

  If that resonates, dig into the code. If something looks weak,
  [open an issue](https://github.com/ShadowNetSOL/ShadowNet/issues).
  If something looks like an overclaim,
  [file a security advisory](https://github.com/ShadowNetSOL/ShadowNet/security/advisories/new).
  The goal is not to be flattered. The goal is to be right.
  