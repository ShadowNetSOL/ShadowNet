# 🌑 ShadowNet

  > **Privacy-native access layer for Web3.** Interact with decentralised
  > applications, scan tokens, and browse the open web without exposing your
  > IP, session state, or device fingerprint.

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![CI](https://img.shields.io/github/actions/workflow/status/ShadowNetSOL/ShadowNet/ci.yml?branch=main&label=CI)](https://github.com/ShadowNetSOL/ShadowNet/actions)
  [![Solana](https://img.shields.io/badge/Solana-mainnet-success)](https://solana.com)
  [![Status: Production](https://img.shields.io/badge/status-production-brightgreen.svg)](./STATUS.md)

  [![🌐 Launch App](https://img.shields.io/badge/Launch_App-shadownet.network-brightgreen?style=for-the-badge)](https://shadownet.network)

  ---

  ## What is ShadowNet?

  ShadowNet is a privacy-first dApp built around four tightly-integrated
  modules that share a single session and routing layer:

  1. **Stealth Browsing.** A service-worker proxy with region-coherent
     fingerprint spoofing, plus optional escalation to a remote browser pool
     for hard-gated destinations.
  2. **Anonymous Wallets.** Solana keypairs generated entirely in your
     browser, Phantom-compatible, never transmitted.
  3. **Trading Terminal.** Token discovery, alpha scoring, and Jupiter Ultra
     swap execution through a fee-routed server proxy.
  4. **Intel Hub.** Wallet analysis, X (Twitter) contract-address scanning,
     smart-follower graphing, and GitHub project recon.

  The whole product is open source, audit-friendly, and designed so the
  server never holds anything it does not need to: no key custody, no
  browsing logs, no per-user identifiers.

  ---

  ## ✨ Features

  ### 🥷 Stealth Browsing
  - **Service-worker proxy** built on Ultraviolet over a hardened
    `@tomphttp/bare-server-node` backend. Catches every request the page
    makes, including dynamic imports, XHR, and WebSockets.
  - **Region-coherent fingerprints**: UA, platform, WebGL vendor/renderer,
    fonts, screen geometry, hardware concurrency, and timezone are pulled
    from atomic preset bundles so anti-bot systems cannot trip on internal
    contradictions (e.g. Windows UA paired with an Apple GPU).
  - **Per-session isolation**. Cookies, cache, and storage do not survive
    across sessions. Sessions expire after one hour.
  - **Two routing tiers**, chosen by the orchestrator, not the user:
    - *Proxy tier* (default) handles the majority of destinations.
    - *Remote-browser tier* (token-gated) takes over for sites with active
      anti-bot challenges (Cloudflare Turnstile, hCaptcha, DataDome,
      PerimeterX, Akamai BotManager). The pool runs disposable Chromium
      containers behind WebRTC.
  - **WebRTC, geolocation, and service-worker registration** are blocked
    inside stealth sessions to prevent leakage paths the page-level shim
    cannot otherwise close.

  ### 🔑 Anonymous Wallets
  - Generated 100% in the browser using `@scure/bip39` for the mnemonic,
    `@noble/ed25519` for signing, and SLIP-0010 hardened derivation on the
    standard Solana path `m/44'/501'/0'/0'`.
  - Phantom-compatible. Verified against `@solana/web3.js`'s
    `Keypair.fromSecretKey`: identical secret bytes produce the identical
    public key, and the keypair signs and verifies correctly.
  - The server has **no** key endpoint. There is no code path that ever sees
    a mnemonic, seed, or private key.
  - Keys live only in volatile browser memory. Refresh the tab and they are
    gone. Save the seed phrase offline before navigating away.

  > ⚠️ Never paste a private key or seed phrase into any website, chat, or
  > document you do not fully control.

  ### 📈 Trading Terminal
  - **Token discovery** sourced from DexScreener with profile-boost
    enrichment, classified into *micro / small / mid / large* tiers.
  - **Alpha Score**, a 10-layer weighted classifier (liquidity depth,
    buy/sell ratio, holder distribution, volume momentum, age, bonding-curve
    state, and Jupiter audit signals) that drives the BUY / WATCH / AVOID /
    PUMPING signal you see on each card.
  - **Jupiter Ultra swaps**, server-proxied so the API key never reaches the
    browser. Quote and execution endpoints handle fee routing into your
    configured ATAs (wSOL, USDC, USDT) and respect Jupiter's 255 bps
    platform-fee cap.
  - **Network pulse** widget aggregates live trade flow for the at-a-glance
    panel.

  ### 📊 Chart
  - Full token-detail view with embedded chart, trade panel, and
    on-demand holder distribution.
  - Accepts a mint via the search box or via `?token=<ca>` so you can deep
    link straight into a position.
  - DexScreener fallback runs client-side when the server cache has not yet
    ingested a freshly-launched mint, so previews work the moment a token
    appears on chain.

  ### 🛰️ Intel Hub
  - **Wallet Analyzer.** Transaction history, PnL, and frequently held
    assets for any Solana address.
  - **X CA Checker.** Scans X (Twitter) accounts for Solana contract
    addresses through the official X API v2 with app-only Bearer auth.
  - **Smart Followers.** Surfaces overlapping high-signal followers across
    a set of accounts.
  - **GitHub Scanner.** Pulls public-repo metadata to flag freshly-spun-up
    or vibe-coded projects.

  ---

  ## 🚀 Quick start

  ```bash
  pnpm install
  pnpm run dev
  ```

  The frontend boots at `http://localhost:5173` and the API server at the
  `PORT` value injected by Replit. See [dev.md](./dev.md) for environment
  variables, multi-region setup, and the codegen workflow.

  ---

  ## 📚 Documentation

  | Doc | What it covers |
  | --- | --- |
  | [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, request lifecycle, orchestrator routing |
  | [SECURITY.md](./SECURITY.md) | Security model, hardening layers, key-management posture |
  | [THREAT_MODEL.md](./THREAT_MODEL.md) | What ShadowNet does and does not defend against |
  | [RELAY.md](./RELAY.md) | Region registry, multi-region deployment, remote-pool tier |
  | [STATUS.md](./STATUS.md) | Current production state and active roadmap |
  | [CHANGELOG.md](./CHANGELOG.md) | Release history |
  | [CONTRIBUTING.md](./CONTRIBUTING.md) | How to file issues and submit PRs |
  | [dev.md](./dev.md) | Local development, env keys, codegen |
  | [Workspace.md](./Workspace.md) | pnpm monorepo layout and conventions |

  ---

  ## 🧱 Tech stack

  | Layer | Stack |
  | --- | --- |
  | Frontend | React 18, Vite 5, TypeScript 5.9, Wouter, Tailwind, Framer Motion |
  | Backend | Node 24, Express 5, TypeScript 5.9, Ultraviolet bare server |
  | Shared | OpenAPI + Orval codegen, Zod runtime validation |
  | Solana | `@solana/web3.js`, Helius RPC, Jupiter Ultra Swap API |
  | Data | DexScreener, Birdeye (optional), CoinGecko, Twitter API v2, GitHub API |
  | Build | esbuild (server bundle), Vite (client bundle) |
  | Hosting | Railway (per-region deployments) |

  ---

  ## 🤝 Contributing

  We welcome bug reports, feature suggestions, and pull requests.
  See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow and
  [SECURITY.md](./SECURITY.md) for responsible disclosure.

  ---

  ## 📜 License

  MIT. See [LICENSE](./LICENSE).
  