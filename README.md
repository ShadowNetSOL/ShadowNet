<div align="center">

  # 🌑 ShadowNet

  ### **The privacy layer Web3 was supposed to have.**

  Anonymous wallets, sovereign browsing, and on-chain intelligence
  in one open-source dApp. Built for users who refuse to choose
  between participating in Web3 and protecting their identity.

  [![🌐 Launch App](https://img.shields.io/badge/Launch_App-shadownet.network-39FF14?style=for-the-badge&logo=ghost&logoColor=black)](https://shadownet.network)
  [![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6?style=for-the-badge)](./LICENSE)
  [![Status: Live](https://img.shields.io/badge/Status-Production-39FF14?style=for-the-badge)](./STATUS.md)
  [![Solana](https://img.shields.io/badge/Solana-Mainnet-8B5CF6?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com)

  </div>

  ---

  ## 💡 Why ShadowNet exists

  Crypto is supposed to be permissionless and private. In practice, the
  modern Web3 stack leaks identity at every layer: wallets phone home,
  RPCs see your IP, dApps fingerprint your browser, on-chain history is
  a public record of your every move, and "privacy mixers" mostly just
  attract regulatory heat.

  ShadowNet rebuilds the user surface from scratch, with privacy as a
  **first-class architectural property**, not a checklist of disclaimers
  buried in a settings menu. One app gives you four cooperating tools
  that share a single private session and routing layer:

  > **Browse the open web.** **Generate a Solana wallet.**
  > **Trade through a fee-routed Jupiter Ultra proxy.**
  > **Run on-chain intelligence.**
  >
  > All from infrastructure that never sees your keys, never logs your
  > requests, and never persists your session.

  ---

  ## ⚡ What makes this different

  Most "privacy" dApps are a wallet wrapper plus a VPN affiliate link.
  ShadowNet ships actual primitives:

  | Innovation | What it is | Why it matters |
  | --- | --- | --- |
  | **Region-coherent fingerprint bundles** | Atomic UA / platform / WebGL / fonts / screen / timezone / locale presets that lock together | Anti-bot systems trip on internal contradictions (Windows UA + Apple GPU). Atomic bundles eliminate the entire class of detection. |
  | **Two-tier orchestrator** | A classifier + per-host failure history routes each request between an in-region service-worker proxy and a remote-browser pool, transparently | Most stealth tools collapse the moment a destination shows a Cloudflare challenge. Ours escalates to a real disposable Chromium and keeps going. |
  | **Holder-gated remote browser** | The remote-browser tier is unlocked by signing a message with a wallet that holds the gating SPL token. HMAC-bound to a device hash, 15-minute TTL, no off-chain accounts | A clean, on-chain entitlement model. No emails, no passwords, no Stripe. The token is the access. |
  | **Sovereign wallet generation** | Solana keypairs generated 100% in the browser using audited primitives (`@scure/bip39`, `@noble/ed25519`, SLIP-0010), Phantom-compatible | The server has no key endpoint, no recovery path, and nothing to subpoena. We literally cannot lose what we never hold. |
  | **Bare-server stealth, not public proxies** | Built on Ultraviolet over a hardened `@tomphttp/bare-server-node` we operate ourselves | No `allorigins`, `thingproxy`, or `corsproxy` in the path. End-to-end through ShadowNet-operated infrastructure. |
  | **Alpha-score 10-layer classifier** | Liquidity depth, buy/sell ratio, holder distribution, volume momentum, age, bonding-curve state, Jupiter audit signals, and more | Powers the BUY / WATCH / AVOID / PUMPING signal on every token card in the trading terminal. Built on real on-chain data, not vibes. |

  ---

  ## 🧩 The four modules

  ### 🥷 Stealth Browsing

  Service-worker proxy with **region-coherent fingerprint spoofing**, plus
  optional escalation to a **remote disposable-Chromium pool** for hard-gated
  destinations. Sessions are isolated, expire after one hour, and leave
  nothing on disk. WebRTC, geolocation, and destination-origin
  service-worker registration are all locked down inside the session so
  the page-level shim cannot be sidestepped.

  ### 🔑 Anonymous Wallets

  Solana keypairs generated 100% in your browser. Phantom-compatible.
  Verified against `@solana/web3.js`'s `Keypair.fromSecretKey` at unit-test
  level: identical secret bytes produce the identical public key, and the
  keypair signs and verifies correctly. The server has **no** key endpoint
  and no code path that ever sees a mnemonic, seed, or private key.

  ### 📈 Trading Terminal

  Token discovery via DexScreener with profile-boost enrichment, classified
  into micro / small / mid / large tiers, scored by the **alpha-score
  10-layer classifier**. Jupiter Ultra swaps are server-proxied so the API
  key never reaches the browser, with platform fees routed into pre-created
  ATAs (wSOL, USDC, USDT) and the 255 bps Ultra cap enforced server-side.

  Plus a full **token-detail Chart page** with embedded chart, trade panel,
  on-demand holder distribution, and a DexScreener client-side fallback so
  fresh-launched mints render the moment they appear on chain.

  ### 🛰️ Intel Hub

  Four research tools sharing the same private routing layer:

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

  Frontend boots at `http://localhost:5173`. API server binds the
  platform-injected `PORT`. See [dev.md](./dev.md) for the full
  environment reference.

  ---

  ## 📚 Documentation

  | Doc | What it covers |
  | --- | --- |
  | [WHY.md](./WHY.md) | Why ShadowNet exists, why now, what makes the design opinionated |
  | [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, request lifecycle, orchestrator routing |
  | [COMPARISON.md](./COMPARISON.md) | How ShadowNet compares to Tor, Brave, VPN+Phantom, mixers, stealth scripts |
  | [SECURITY.md](./SECURITY.md) | Security model, hardening layers, key-management posture |
  | [THREAT_MODEL.md](./THREAT_MODEL.md) | What ShadowNet does and does not defend against |
  | [RELAY.md](./RELAY.md) | Region registry, multi-region deployment, remote-pool tier |
  | [STATUS.md](./STATUS.md) | Live components and execution roadmap |
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
  | Data | DexScreener, Birdeye (optional), CoinGecko, X API v2, GitHub API |
  | Build | esbuild (server bundle), Vite (client bundle) |
  | Hosting | Railway (per-region deployments) |

  ---

  ## 🛣️ Roadmap

  **Shipped (v1.0):**
  - Production stealth proxy with region-coherent fingerprints
  - Two-tier orchestrator (proxy + remote browser) with classifier-driven escalation
  - Anonymous Solana wallets, browser-only key handling
  - Trading terminal with alpha-score classifier and Jupiter Ultra swaps
  - Intel Hub: Wallet Analyzer, X CA Checker, Smart Followers, GitHub Scanner
  - Holder-tier authentication via on-chain SPL balance + HMAC claims

  **Next:**
  - Independent third-party security audit of the relay and orchestrator
  - Open-source reference implementation of the remote-browser pool, so
    community operators can run additional capacity
  - Wider geographic distribution of the region registry
  - Public uptime dashboard and incident reporting
  - Reproducible client builds

  ---

  ## 🤝 Contributing

  ShadowNet is open source under MIT and welcomes contributors. Issues,
  feature suggestions, and pull requests are all welcome. See
  [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and
  [SECURITY.md](./SECURITY.md) for responsible disclosure.

  ---

  ## 📜 License

  MIT. See [LICENSE](./LICENSE).

  ---

  <div align="center">

  **ShadowNet** · privacy-native access layer for Web3 ·
  [shadownet.network](https://shadownet.network)

  </div>
  