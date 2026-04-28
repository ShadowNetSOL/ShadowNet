# Contributing to ShadowNet

  Thanks for your interest in contributing to ShadowNet — a privacy-focused
  Solana dApp. This document describes how to report issues, propose changes,
  and submit pull requests.

  > ShadowNet is experimental infrastructure. Quality, transparency, and a
  > conservative security posture matter more than raw feature velocity.

  ## Ways to contribute

  - **Report bugs** — open an issue with reproduction steps, expected vs. actual
    behavior, and environment details (browser, OS, network conditions).
  - **Suggest features** — open an issue describing the use case and the
    threat model implications, if any.
  - **Submit pull requests** — improvements to docs, code, tests, or
    infrastructure are all welcome.

  ## Reporting security vulnerabilities

  **Do not file public issues for security problems.** Follow the responsible
  disclosure process described in [SECURITY.md](./SECURITY.md).

  ## Development setup

  See [dev.md](./dev.md) for local development instructions and the project
  layout.

  Quick start:

  ```bash
  pnpm install
  pnpm run dev
  ```

  ## Pull request guidelines

  1. **Branch from `main`** and keep PRs focused — one logical change per PR.
  2. **Match the existing style** — TypeScript strict, no implicit `any`,
     no commented-out code, no dead imports.
  3. **Test your change** — add or update tests where applicable. PRs that touch
     wallet, key handling, or relay logic require extra scrutiny.
  4. **Write clear commit messages** — present tense, explain *why*, not just
     *what* (e.g. "harden relay timeout to prevent slow-loris" rather than
     "update relay.ts").
  5. **Update docs** — if your change affects user-visible behavior, update the
     relevant section of `README.md`, `ARCHITECTURE.md`, or `STATUS.md`.
  6. **No new dependencies without discussion** — supply-chain risk is real.
     Prefer the standard library or existing deps wherever possible.

  ## Areas that need extra care

  These touch user safety; expect detailed review and possible rejection if the
  risk profile is unclear:

  - Wallet generation, key derivation, or signing flows
  - Relay routing, rate limiting, or session lifetime
  - Anything that exfiltrates data to a third-party endpoint
  - Changes to documentation that make security or privacy claims

  ## Code of conduct

  Be respectful. Assume good faith. Discuss the code, not the person.
  Harassment of any kind will not be tolerated.

  ## License

  By contributing, you agree that your contributions will be licensed under the
  [MIT License](./LICENSE).
  