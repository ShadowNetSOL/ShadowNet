# Changelog

  All notable changes to ShadowNet are documented here. The format
  loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
  and the project uses [Semantic Versioning](https://semver.org/) once a
  `v1.0.0` is tagged.

  ---

  ## [Unreleased]

  ### Added
  - Top-level documentation suite: `README.md`, `ARCHITECTURE.md`,
    `SECURITY.md`, `THREAT_MODEL.md`, `INTELLIGENCE.md`,
    `ROADMAP.md`, `CHANGELOG.md`, `CONTRIBUTING.md`.
  - Honest Live / Planned labelling across every feature claim.

  ### Changed
  - Documented the proxy's SPA interception script (location / fetch /
    XHR / element-setter patches) as a load-bearing piece of the
    current stealth flow.
  - Documented the Intelligence Hub's caching, rate-limiting, and
    cross-signal entity graph in detail.

  ---

  ## [0.1.0] — Mainnet ship

  Initial mainnet release.

  ### Live features

  - Stealth iframe proxy (`/api/proxy?url=…`) with SSRF guard,
    response-header hygiene, SPA-aware interception script, random
    user-agent rotation, 60 rpm rate limit, and 500 ms slow-down
    after 20 requests.
  - Server-side reachability + anti-bot precheck
    (`/api/relay/verify`).
  - Browser-only Solana wallet generator with audited primitive
    libraries (`@scure/bip39`, `@noble/hashes`, `@noble/ed25519`),
    defense-in-depth runtime checks, and best-effort buffer wipe.
  - Intelligence Hub: `/wallet`, `/wallet/onchain`, `/x-ca` (Nitter +
    Wayback Machine), `/smart-followers` (preview pending X API
    Bearer wiring), `/github-scan`.
  - Cross-signal entity graph: wallet ↔ repo edges live; X-channel
    edge type implemented in the graph library, wiring from `/x-ca`
    pending.
  - 8-class wallet-archetype classifier with FIFO PnL.
  - GitHub trust scorer (scam-pattern, anti-gaming, structural risk).
  - Pump.fun token discovery feed via Dexscreener.
  - Relay-node directory and connect endpoint.
  - Tiered Solana RPC failover (Helius → publicnode → mainnet-beta).

  [Unreleased]: https://github.com/ShadowNetSOL/ShadowNet/compare/v0.1.0...HEAD
  [0.1.0]: https://github.com/ShadowNetSOL/ShadowNet/releases/tag/v0.1.0
  