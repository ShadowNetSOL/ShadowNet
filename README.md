<div align="center">

  # 🌑 ShadowNet

  ### The privacy layer Web3 was supposed to have.

  Anonymous wallets, sovereign browsing, and on-chain intelligence
  in one open-source dApp. Built for users who refuse to choose
  between participating in Web3 and protecting their identity.

  [![🌐 Launch App](https://img.shields.io/badge/Launch_App-shadownet.network-39FF14?style=for-the-badge&logo=ghost&logoColor=black)](https://shadownet.network)
  [![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6?style=for-the-badge)](./LICENSE)
  [![Status](https://img.shields.io/badge/Status-Mainnet_Live-39FF14?style=for-the-badge)](#status)
  [![Solana](https://img.shields.io/badge/Solana-Mainnet-8B5CF6?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com)

  </div>

  ---

  ## What ShadowNet is

  Crypto is supposed to be permissionless and private. In practice the
  modern Web3 stack leaks identity at every layer. Wallets phone home,
  RPCs see your IP, dApps fingerprint your browser, on-chain history is
  a permanent public record of every move you make, and most "privacy"
  products are either custodial mixers or VPN affiliate links.

  ShadowNet rebuilds the user surface from scratch with privacy as a
  first-class architectural property, not a checklist of disclaimers
  buried in a settings menu. One open-source dApp gives you four
  cooperating tools that share a single private session and routing
  layer:

  > Browse the open web. Generate a Solana wallet. Run on-chain
  > intelligence. Discover and trade tokens.
  >
  > All from infrastructure that never sees your keys, never logs your
  > request bodies, and never persists your session.

  ---

  ## Security notice

  ShadowNet is **self-custodial** and **non-custodial**. Wallet
  generation runs **client-side only**, in your browser. We will
  never ask you to enter, paste, share, or send your seed phrase,
  mnemonic, or private key. Not to us, not to Replit, not to any
  "support" account, not to any dApp. **Treat your seed phrase as a
  password**: never share it, store it offline, and keep it private.
  Anyone asking for your recovery words to "verify", "claim", or
  "migrate" your wallet is phishing you. Our full
  [threat model](./THREAT_MODEL.md) and
  [security policy](./SECURITY.md) describe what ShadowNet defends
  against and what is out of scope.

  ---

  ## Status legend

  Throughout this README and the supporting docs, every feature is
  labelled so investors and users can tell what ships today versus what
  is on the active roadmap.

  - **Live** — shipped on `mainnet` at https://shadownet.network and
    verifiable in this repo.
  - **Planned** — actively under development by the core team. Code is
    partially in place or scheduled for a near-term release. Listed here
    because the architecture is committed; treat as forward-looking.

  ---

  ## The four modules

  ### 🥷 Stealth Browsing

  | Capability | Status |
  | --- | --- |
  | Server-side iframe proxy with response-header stripping (X-Frame-Options, CSP, HSTS) so any site renders in-app | **Live** |
  | SSRF guard: DNS lookup with RFC 1918 / loopback / link-local rejection, blocked-port list (22, 25, 3306, 6379), HTTP(S)-only protocol filter | **Live** |
  | Inline interception script that patches `window.location`, `fetch`, `XMLHttpRequest`, and dynamic `script`/`link` injection so SPA chunks (Next.js, Vite) stay inside the proxy on every navigation | **Live** |
  | Random user-agent rotation per request from a curated pool | **Live** |
  | 60 requests / minute / IP rate limit, plus a 500 ms slow-down after the first 20 requests in a window | **Live** |
  | Server-side reachability precheck (`/api/relay/verify`) that returns status, latency, page title, content-type, and the relay's outbound IP so users can verify their request actually leaves through ShadowNet infrastructure (note: the precheck currently validates protocol and URL shape only; the same DNS-resolved private-IP and blocked-port guard the main proxy enforces is on the near-term hardening list) | **Live** (hardening pending) |
  | Service-worker proxy on Ultraviolet over a hardened `@tomphttp/bare-server-node`, replacing the legacy iframe rewrite to fix realtime sites and dynamic-import edge cases | **Planned** |
  | Region-coherent fingerprint preset bundles (atomic UA + platform + WebGL vendor/renderer + fonts + screen + timezone + locale, one OS-class per preset) | **Planned** |
  | Two-tier orchestrator that routes each request between the in-region proxy and a remote disposable-Chromium pool based on a failure classifier, per-host history, precheck verdict, and the caller's holder-tier entitlement | **Planned** |
  | Page-level shim that disables WebRTC, blocks the geolocation API, and prevents service-worker registration from the destination origin | **Planned** |

  ### 🔑 Anonymous Wallets

  | Capability | Status |
  | --- | --- |
  | Solana keypair generation runs **entirely in your browser**. The server has no key endpoint and no code path that ever sees a mnemonic, seed, or private key | **Live** |
  | BIP-39 (English, 12 words, 128-bit entropy) → SLIP-0010 hardened derivation on the standard Solana path `m/44'/501'/0'/0'` → Ed25519 keypair, using the audited primitive libraries `@scure/bip39`, `@noble/hashes`, and `@noble/ed25519` | **Live** |
  | Pre-flight defense-in-depth: refuses to generate keys if WebCrypto `getRandomValues` is unavailable, if the RNG returns all zeros, or if the page is not in a secure context (HTTPS or localhost) | **Live** |
  | Best-effort wipe of all intermediate buffers (HMAC working state, derived chain codes, secret-key bytes) once the keypair has been returned | **Live** |
  | Phantom-compatible: identical secret bytes produce the identical public key and signing roundtrip under `@solana/web3.js`'s `Keypair.fromSecretKey` | **Live** |
  | Provenance descriptor returned alongside every keypair (entropy source, RNG bits, curve, derivation standard, libraries) so the user can independently verify the generation method | **Live** |

  ### 🛰️ Intelligence Hub

  | Capability | Status |
  | --- | --- |
  | **Wallet Analyzer** — Solana RPC summary with SOL balance, token-account count, recent activity, AI-generated narrative, all under a tiered RPC failover (Helius → publicnode → mainnet-beta) | **Live** |
  | **Wallet Deep-Scan** — concurrent batched parsed-transaction fetch (up to 200 signatures), dev-token discovery, FIFO-cost-basis PnL, and 8-class wallet-archetype classifier (sniper, airdrop farmer, LP, smart money, bag holder, active trader, dormant, normal) | **Live** |
  | **X CA Checker** — pulls a profile via a Nitter mirror, extracts every Solana contract address from the bio and recent posts, and enriches with Wayback Machine snapshot history (firstSeen, lastSeen, possible previous handles) for handle-rebrand detection | **Live** |
  | **Smart Followers** — heuristic preview that returns a sample high-signal follower set with the upstream-API-required descriptor; full scan over the live follower graph (verified, ratio, account age, intersecting follows) lands once an X API v2 Bearer is wired | **Planned** (preview shipped) |
  | **GitHub Scanner** — repo metadata + AI-driven code review with a structured trust score, dedicated rate limiter (8 / minute), 60-second timeout, and three independent risk passes: scam-pattern detection, anti-gaming (star manipulation), and structural risk | **Live** |
  | **Cross-signal entity graph** — memory-bounded graph that links wallets and GitHub repos to mints they touch and returns a verdict (`SAME_ENTITY_LIKELY` for full convergence, `CONVERGENT_INTEREST` for partial overlap, `ISOLATED` otherwise); the X-channel edge type is implemented in the graph library and not yet wired to the live X-CA route | **Live** (wallet ↔ repo edges; X edges Planned) |
  | Caching with explicit TTLs on the AI / token-metadata layer so repeat scans return instantly without re-billing the upstream provider; per-endpoint result caching across all five routes is rolling out incrementally | **Live** (partial) |

  See [INTELLIGENCE.md](./INTELLIGENCE.md) for the full endpoint reference,
  verdict policies, and example payloads.

  ### 📈 Trading Terminal

  | Capability | Status |
  | --- | --- |
  | Pump.fun token discovery feed pulling live data from the Dexscreener token-profiles endpoint, filtered to Solana mints with the `pump` suffix and enriched with pair price / 24 h volume / liquidity / buy-sell counts | **Live** |
  | Full token-discovery view with micro / small / mid / large market-cap tiering and on-card sort controls (volume, age, change) | **Planned** |
  | Alpha-score 10-layer classifier (liquidity depth, buy-sell ratio, holder distribution, volume momentum, age, bonding-curve state, Jupiter audit signals, plus three additional layers) producing a BUY / WATCH / AVOID / PUMPING signal on every token | **Planned** |
  | Jupiter Ultra swap proxy with the Jupiter API key held server-side, platform-fee routing into pre-created associated token accounts (wSOL, USDC, USDT), and the 255 bps Ultra fee cap enforced server-side | **Planned** |
  | Token-detail chart page with embedded chart, on-demand holder-distribution scan, integrated trade panel, and a Dexscreener client-side fallback so freshly-launched mints render the moment they appear on chain | **Planned** |

  ### 🌍 Relay Network

  | Capability | Status |
  | --- | --- |
  | Relay node directory at `/api/relay/nodes` returning name, country, city, latency, uptime, and per-node `audited` / `noLogs` flags so the UI can display the planned global footprint | **Live** (directory only — see honest framing below) |
  | Per-node connect endpoint that issues a session id and a masked outbound IP for UI display | **Live** |
  | Multi-region deployment with one Railway service per region, region registry driven by environment variables (`RELAY_REGION`, `RELAY_PEERS`), and the lead instance discovering its siblings at boot | **Planned** |
  | Remote disposable-Chromium pool (`REMOTE_BROWSER_POOL_URL`) with WebRTC streaming, hard tear-down on idle, and an explicit pool-side isolation contract (fresh profile per session, no disk persistence, no SW / IndexedDB, fingerprint applied at launch flag layer) | **Planned** |

  > **Honest framing.** The relay-node directory currently displays a
  > curated list of planned regions; all live proxy traffic today goes
  > through a single ShadowNet API server and the precheck endpoint
  > returns the actual outbound IP that destination sites will see. The
  > per-region deployment described in [RELAY.md](./ROADMAP.md#relay-network)
  > is in active development and will replace the directory display with
  > live per-region routing.

  ---

  ## Quick start

  ```bash
  pnpm install
  pnpm run dev
  ```

  Frontend boots at `http://localhost:5173`. The API server binds the
  platform-injected `PORT`. See [dev.md](./dev.md) for the full
  environment reference, env keys, and codegen workflow.

  ---

  ## Documentation

  | Doc | What it covers |
  | --- | --- |
  | [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, request lifecycle, what's wired today vs the planned routing brain |
  | [SECURITY.md](./SECURITY.md) | Security model, hardening layers, key-management posture, honest scoping |
  | [THREAT_MODEL.md](./THREAT_MODEL.md) | What ShadowNet defends against and what it explicitly does not |
  | [INTELLIGENCE.md](./INTELLIGENCE.md) | Intelligence Hub: 5 endpoints, cross-signal graph, wallet-archetype classifier, GitHub trust scoring |
  | [ROADMAP.md](./ROADMAP.md) | Detailed roadmap for the planned features (UV bare-server, orchestrator, holder-tier, trading terminal, multi-region) |
  | [dev.md](./dev.md) | Local development, env keys, codegen workflow |

  ---

  ## Tech stack

  | Layer | Stack |
  | --- | --- |
  | Frontend | React 18, Vite 5, TypeScript 5.9, Wouter, Tailwind, Framer Motion |
  | Backend | Node 24, Express 5, TypeScript 5.9 |
  | Shared | OpenAPI + Orval codegen, Zod runtime validation |
  | Solana | `@solana/web3.js`, Helius RPC (with publicnode + mainnet-beta failover) |
  | Intelligence | OpenAI / OpenRouter (`gpt-5` default, configurable), Nitter scrape via cheerio (X API v2 Bearer upgrade Planned), Dexscreener, Wayback Machine, GitHub REST |
  | Wallet primitives | `@scure/bip39`, `@noble/hashes`, `@noble/ed25519`, `bs58` |
  | Build | esbuild (server bundle), Vite (client bundle) |
  | Hosting | Railway (today single-region, multi-region planned) |

  ---

  ## Status

  **Mainnet, today (Live):**

  - Stealth iframe proxy with SSRF guard, header hygiene, SPA-aware interception
  - Browser-only Solana wallet generator built on audited primitive libraries with runtime preflight
  - Intelligence Hub: five endpoints (wallet, wallet/onchain, x-ca, smart-followers, github-scan), wallet ↔ repo cross-signal graph, 8-class archetype classifier, GitHub trust scoring; X data via a Nitter mirror plus Wayback Machine handle history
  - Pump.fun token-discovery feed
  - Relay-node directory (UI display) and per-target reachability precheck
  - Production rate limits (60 rpm + slow-down + per-endpoint AI limit), timeouts, and CORS

  **In active development (Planned):**

  - Service-worker UV bare-server proxy with WebSocket support
  - Region-coherent fingerprint preset bundles + session store
  - Two-tier orchestrator with classifier-driven escalation
  - Holder-tier authentication via Solana SPL balance + HMAC + device hash
  - Remote disposable-Chromium pool with WebRTC streaming
  - Trading terminal with alpha-score classifier and Jupiter Ultra swap proxy
  - Multi-region deployment with regions registry

  See [ROADMAP.md](./ROADMAP.md) for phasing and target windows.

  ---

  ## Contributing

  ShadowNet is open source under MIT and welcomes contributors. Issues,
  feature suggestions, and pull requests are all welcome. See
  [SECURITY.md](./SECURITY.md) for responsible disclosure of any
  vulnerability you find.

  ---

  ## License

  MIT. See [LICENSE](./LICENSE).

  ---

  <div align="center">

  **ShadowNet** · privacy-native access layer for Web3 ·
  [shadownet.network](https://shadownet.network)

  </div>
  