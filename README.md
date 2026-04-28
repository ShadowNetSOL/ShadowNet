# 🌑 ShadowNet

  > **Privacy-native access layer for Web3** — interact with decentralized
  > applications while reducing exposure of your IP, session data, and device
  > fingerprint.

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![CI](https://img.shields.io/github/actions/workflow/status/ShadowNetSOL/ShadowNet/ci.yml?branch=main&label=CI)](https://github.com/ShadowNetSOL/ShadowNet/actions)
  [![Solana](https://img.shields.io/badge/Solana-mainnet-success)](https://solana.com)
  [![Status: Experimental](https://img.shields.io/badge/status-experimental-orange.svg)](./STATUS.md)

  [![🌐 Get Started](https://img.shields.io/badge/Get_Started-app--shadownet.net-brightgreen?style=for-the-badge)](https://app-shadownet.net)

  ---

  ## ⚠️ Experimental Project Notice

  ShadowNet is an experimental privacy-focused platform under active development.

  - Relay infrastructure is in progress and **has not been independently audited**
  - Public relay services are used temporarily as fallback nodes
  - Privacy features aim to **reduce** tracking, not guarantee anonymity
  - This project should **not** be relied on for sensitive or high-risk use cases

  For full details, see [RELAY.md](./RELAY.md), [SECURITY.md](./SECURITY.md),
  [STATUS.md](./STATUS.md), and [THREAT_MODEL.md](./THREAT_MODEL.md).

  ---

  ## 🧠 What is ShadowNet?

  ShadowNet is a **privacy-native access layer for the decentralized web**.
  It combines four independent modules — **stealth sessions, anonymous wallets,
  a relay network, and on-chain intelligence (Intel Hub)** — into a single
  session-and-relay architecture aimed at reducing identity, location, and
  device-fingerprint exposure.

  ShadowNet is **not a VPN replacement** and is **not a substitute** for hardened
  operational security. See [THREAT_MODEL.md](./THREAT_MODEL.md) for what it
  does and does not protect against.

  ---

  ## ✨ Key Features

  ### 1. Stealth Sessions
  - Sandboxed sessions with **randomized fingerprints** per launch
  - Randomized attributes: user-agent, screen resolution, color depth, timezone,
    language, platform, WebGL strings, canvas hash, audio hash, font list
  - Traffic routed through **relay nodes** to mask the originating IP
  - **Session isolation** prevents cookies, cache, or storage from leaking
    across sessions
  - **How to use:** Stealth Sessions → enter target URL → select relay node →
    *Initiate Stealth* → *Launch Target Site*. Sessions last up to one hour.

  ### 2. Anonymous Wallet Generation
  - **Generated 100% in your browser** — the server never sees your mnemonic
    or private key. There is no key endpoint to compromise.
  - Uses audited Web3-grade primitives: `@scure/bip39` (mnemonic),
    `@noble/ed25519` (signing), and SLIP-0010 hardened derivation on the
    standard Solana path `m/44'/501'/0'/0'`
  - Compatible with **Phantom**, **Solflare**, and other Solana wallets
  - Keys live only in volatile browser memory — refresh the page and they
    are gone. Save the mnemonic offline before navigating away.
  - **Importing into a wallet:** see the in-app guidance under
    *Anonymous Wallet → Export Options*. Treat any private key or seed phrase
    as you would a password — store offline or in an encrypted vault.
  - ShadowNet **cannot recover lost keys**

  > ⚠️ Never paste a private key or seed phrase into any website, chat, or
  > document you do not fully control.

  ### 3. Relay Network
  - Curated relay-based routing (centrally operated in the current version)
  - Select nodes by latency, geographic location, or jurisdiction
  - Node status: online / maintenance / offline, with auto-refresh
  - Destination servers see only the relay IP, not your real IP
  - See [RELAY.md](./RELAY.md) for the full relay model and roadmap

  ### 4. Intel Hub
  - **Wallet Analyzer** — transaction history, PnL, frequently held assets
  - **X CA Checker** — scans X (Twitter) accounts for Solana contract
    addresses
  - **Smart Followers** — identifies high-signal on-chain followers as social
    alpha indicators
  - **GitHub Scanner** — heuristic + AI-assisted trust scoring for any
    public GitHub repository

  ---

  ## 🛡 Security Model (Summary)

  ShadowNet implements several defensive mechanisms server-side:

  - URL validation and protocol enforcement (only `http` and `https`)
  - Private/internal IP range blocking (SSRF protection)
  - Rate limiting and request throttling on all API routes
  - Timeout protection on outbound requests
  - Header sanitization and controlled response handling
  - WebRTC, geolocation, and service-worker overrides in stealth sessions

  For the full model, limitations, and known caveats, see
  [SECURITY.md](./SECURITY.md).

  ---

  ## 🛠 Tech Stack

  - **Blockchain:** Solana
  - **Language:** TypeScript / JavaScript
  - **Runtime:** Node.js ≥ 18
  - **Package Manager:** pnpm (monorepo workspace)
  - **Frontend:** React + Vite
  - **Backend:** Express

  ---

  ## 📦 Getting Started

  ### Prerequisites

  - Node.js ≥ 18
  - pnpm
  - (Optional) Solana CLI for local chain interaction
  - (Optional) Phantom or Solflare wallet

  ### Installation

  ```bash
  git clone https://github.com/ShadowNetSOL/ShadowNet.git
  cd ShadowNet
  pnpm install
  pnpm run dev
  ```

  The dev server prints the local URL (typically `http://localhost:5173` for
  the web app). For full local development notes, see [dev.md](./dev.md).

  ---

  ## 🧪 Usage

  1. Connect a Solana wallet (or generate an anonymous one in-app)
  2. Use **Stealth Sessions** for private browsing
  3. Generate **anonymous wallets** and import them into Phantom/Solflare
  4. Route traffic through the **Relay Network**
  5. Explore the **Intel Hub** for on-chain and social intelligence

  ---

  ## 👥 Contributing

  Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the
  workflow, review expectations, and areas that require extra scrutiny
  (wallet, key handling, relay logic).

  For security issues, **do not open a public issue** — follow the disclosure
  process in [SECURITY.md](./SECURITY.md).

  This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

  ---

  ## 📚 Documentation Index

  | File | Purpose |
  | --- | --- |
  | [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture overview |
  | [RELAY.md](./RELAY.md) | Relay network design and roadmap |
  | [SECURITY.md](./SECURITY.md) | Security model, threat model, and limits |
  | [THREAT_MODEL.md](./THREAT_MODEL.md) | What ShadowNet does and does **not** protect against |
  | [STATUS.md](./STATUS.md) | Current system status |
  | [CHANGELOG.md](./CHANGELOG.md) | Release history |
  | [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
  | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community guidelines |
  | [dev.md](./dev.md) | Local development notes |

  ---

  ## 📄 License

  ShadowNet is released under the [MIT License](./LICENSE).

  ## 📫 Contact

  - **GitHub:** [ShadowNetSOL](https://github.com/ShadowNetSOL)
  - **Live site:** [app-shadownet.net](https://app-shadownet.net)
  