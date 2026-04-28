# Changelog

  All notable changes to ShadowNet are documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
  and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

  ## [Unreleased]

  ### Added
  - LICENSE file (MIT) matching the README badge claim
  - CONTRIBUTING.md with PR workflow and review expectations
  - CODE_OF_CONDUCT.md (Contributor Covenant 2.1)
  - THREAT_MODEL.md documenting in-scope and out-of-scope threats
  - CHANGELOG.md (this file)
  - GitHub Actions CI workflow (typecheck + build)
  - Dependabot configuration for npm and GitHub Actions updates
  - Issue and pull request templates under `.github/`

  ### Changed
  - README.md rewritten for clarity, broken markdown fixed, contradictions
    removed (relay nodes are no longer described as "audited"), wallet section
    reframed to emphasize user responsibility for key handling, and broken
    `RELAYS.md` link corrected to `RELAY.md`

  ## [0.1.0] - 2026-04-28

  ### Added
  - Initial public release
  - Stealth Sessions with fingerprint randomization
  - Anonymous Solana wallet generation
  - Relay network (central + temporary public fallbacks)
  - Intel Hub: Wallet Analyzer, X CA Checker, Smart Followers, GitHub Scanner
  - SSRF protections, rate limiting, and timeout enforcement on the proxy
  - Architecture, security, and relay documentation
  