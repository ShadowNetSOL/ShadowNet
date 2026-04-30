# Contributing to ShadowNet

  Thanks for your interest in contributing to ShadowNet, a privacy-first
  Solana dApp. This document describes how to report issues, propose
  changes, and submit pull requests.

  > Quality, transparency, and a conservative security posture matter
  > more to us than raw feature velocity. PRs that simplify, clarify, or
  > harden existing behaviour are always welcome.

  ## Ways to contribute

  - **Report bugs.** Open an issue with reproduction steps, expected vs.
    actual behaviour, and environment details (browser, OS, network).
  - **Suggest features.** Open an issue describing the use case and any
    threat-model implications.
  - **Submit pull requests.** Improvements to docs, code, tests, and
    infrastructure are all welcome.

  ## Reporting security vulnerabilities

  **Do not file public issues for security problems.** Follow the
  responsible-disclosure process in [SECURITY.md](./SECURITY.md).

  ## Development setup

  See [dev.md](./dev.md) for the full local-development guide.

  Quick start:

  ```bash
  pnpm install
  pnpm run dev
  ```

  ## Pull-request guidelines

  1. **Branch from `main`** and keep PRs focused. One logical change per
     PR makes review and rollback easy.
  2. **Match the existing style.** TypeScript strict, no implicit `any`,
     no commented-out code, no dead imports.
  3. **Test your change.** Add or update tests where applicable. PRs that
     touch wallet, key handling, orchestrator routing, or relay logic
     require extra scrutiny.
  4. **Write clear commit messages.** Present tense, explain *why* not
     just *what* (e.g. "harden relay timeout to prevent slow-loris"
     rather than "update relay.ts").
  5. **Update docs.** If your change affects user-visible behaviour,
     update the relevant section of `README.md`, `ARCHITECTURE.md`, or
     `STATUS.md`.
  6. **No new dependencies without discussion.** Supply-chain risk is
     real. Prefer the standard library or existing deps wherever possible.

  ## Areas that need extra care

  These touch user safety, so expect detailed review and possible
  rejection if the risk profile is unclear:

  - Wallet generation, key derivation, or signing flows.
  - Orchestrator routing, classifier verdicts, or per-host history logic.
  - Holder-tier auth: nonce minting, signature verification, claim issuance.
  - Anything that exfiltrates data to a third-party endpoint.
  - Documentation that makes security or privacy claims.

  ## Code of conduct

  Be respectful. Assume good faith. Discuss the code, not the person.
  Harassment of any kind will not be tolerated. See
  [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

  ## License

  By contributing, you agree that your contributions will be licensed
  under the [MIT License](./LICENSE).
  