# Intelligence Hub

  The Intelligence Hub is ShadowNet's on-chain and off-chain signals
  layer. Five endpoints today, all **Live** on mainnet, share one cache
  layer, one cross-signal entity graph, one wallet-archetype classifier,
  and one GitHub trust scorer. Every endpoint is rate-limited, cached
  with explicit TTLs, and designed to fail closed (clean error
  responses, never half-completed answers).

  ---

  ## Endpoint reference

  All endpoints live under `/api/intelligence` and accept JSON bodies.

  | Endpoint | Method | Body | Purpose |
  | --- | --- | --- | --- |
  | `/wallet` | POST | `{ address: string }` | Lightweight Solana wallet summary with AI-generated narrative |
  | `/wallet/onchain` | POST | `{ address: string }` | Deep on-chain scan: dev tokens, FIFO PnL, archetype |
  | `/x-ca` | POST | `{ handle: string }` | Maps an X handle to its associated Solana CAs and handle history |
  | `/smart-followers` | POST | `{ handle: string }` | Detects high-signal followers on an X account |
  | `/github-scan` | POST | `{ owner, repo }` | AI repo review with structured trust score |

  The whole hub is rate-limited at 60 requests / minute / IP. The
  GitHub scanner has its own dedicated 8-per-minute limiter on top
  because every call hits a paid AI endpoint and a 60-second timeout
  window.

  ---

  ## Wallet summary — `/wallet`

  Returns a fast, lightweight view of a Solana wallet:

  - SOL balance via the tiered RPC failover (Helius → publicnode →
    mainnet-beta).
  - SPL-token-account count.
  - Recent activity flag.
  - An AI-generated narrative summary.
  - A heuristic fallback summary if the AI provider is unavailable, so
    the endpoint never fails opaquely.

  This endpoint is the cheap one. It is intended for the dashboard
  "glance" view; users who want depth call `/wallet/onchain`.

  ---

  ## Wallet deep-scan — `/wallet/onchain`

  The deep-scan endpoint runs a concurrent batched fetch of the wallet's
  recent signatures (up to 200), parses every transaction with
  `getParsedTransactions`, and produces:

  - **Dev tokens.** Mints the wallet has authority over, with token-
    metadata enrichment (name, symbol, supply where available).
  - **FIFO-cost-basis PnL.** Lots are tracked first-in-first-out so
    realized PnL on each mint reflects the order the wallet actually
    acquired and disposed of tokens, not an averaged-cost approximation.
  - **Activity profile.** Counts of buys, sells, claims, swaps, mints,
    and program interactions over the scanned window.
  - **Wallet archetype.** A classification from the eight-class
    classifier described below.

  The scan is concurrency-bounded so a single deep-scan request cannot
  exhaust the RPC budget for other callers. Results land in the cache
  layer for the duration of the configured TTL.

  ---

  ## Wallet-archetype classifier

  The classifier (in `artifacts/api-server/src/lib/wallet-archetype.ts`)
  inspects the on-chain activity profile and the dev-token list and
  returns one of eight archetypes:

  | Archetype | Heuristic |
  | --- | --- |
  | **Sniper** | Buys early into newly-launched mints, holds briefly, sells into liquidity within the first window |
  | **Airdrop farmer** | High variety of program interactions, low capital deployment per interaction, claim-heavy activity |
  | **LP (liquidity provider)** | Concentrated time in AMM programs, paired-token deposit and withdrawal patterns |
  | **Smart money** | Realized PnL above a configured threshold and consistent positive expectancy across mints |
  | **Bag holder** | Large unrealized exposure to one or two mints with little churn |
  | **Active trader** | High frequency of distinct mint touches without the early-entry bias of a sniper |
  | **Dormant** | Activity stale beyond the configured window |
  | **Normal** | Did not match any other archetype |

  The classifier is deterministic and explainable: every classification
  ships a small `reasons` array so the UI can show what tipped the
  verdict. This is by design; opaque scores are how memecoin
  intelligence products lose user trust.

  ---

  ## X CA Checker — `/x-ca`

  Pulls a profile via the official X API v2 (app-only Bearer), extracts
  every Solana contract address (base58 32–44 chars, on-chain
  verification step) from the bio plus a window of recent posts, and
  adds **handle history via the Wayback Machine**: `firstSeen`,
  `lastSeen`, and a list of `possiblePreviousNames` collected from
  older snapshots of the same profile URL.

  The handle-history feature catches one of the most common scam
  patterns: a handle that was a different identity three months ago,
  posting a brand-new CA today.

  Cached for 10 minutes per handle.

  ---

  ## Smart followers — `/smart-followers`

  Pulls the followers of an X handle via the X API v2 and returns the
  high-signal subset, ranked by:

  - Verification status.
  - Followers / following ratio.
  - Account age.
  - Intersecting follow-graph density.

  Useful for sanity-checking a project's social-proof claims (a "1k
  followers, all bots created last week" account looks very different
  from a "1k followers, half are blue-chip founders" account).

  ---

  ## GitHub Scanner — `/github-scan`

  The most security-relevant endpoint in the hub. Given an owner and
  repo, the scanner:

  1. Pulls metadata from the GitHub REST API (stars, forks, contributors,
     commit cadence, language breakdown, top-level files).
  2. Requests the README and a small set of relevant source files
     (entry points, package manifests, common attack-surface paths).
  3. Sends the payload to the configured AI provider (default
     `gpt-5`, configurable via `AI_MODEL`) with a structured prompt
     and JSON schema for the output.
  4. Combines the AI's verdict with deterministic checks from
     `lib/github-trust.ts` running three independent passes:
     - **Scam-pattern detection.** Looks for known rug-coin scaffolds,
       drainer signatures, and suspicious imports / network calls.
     - **Anti-gaming.** Flags signs of star manipulation (sudden jumps,
       low-quality contributor histories, no real commit cadence).
     - **Structural risk.** Highlights repos that combine high
       attention with thin code (single-author, no tests, no CI).
  5. Returns a structured trust score with the contributing signals
     so the UI can show the user **why** something scored low rather
     than just the number.

  Hard limits: 8 calls per minute, 60-second timeout window. Repeated
  scans of the same repo within the cache TTL return instantly without
  rebilling the AI provider.

  ---

  ## Cross-signal entity graph

  The graph (in `artifacts/api-server/src/lib/cross-signal.ts`) is the
  hub's sharpest weapon against memecoin coordinator schemes that try
  to hide behind separate-looking on-chain, social, and code identities.

  Every Intelligence call writes its observations into a memory-bounded
  graph that links three node types:

  - **Wallets** → mints they touched (with side: buy / sell / mint).
  - **GitHub repos** → mints they referenced in READMEs / source.
  - **X accounts** → mints they posted (with optional Solscan / Birdeye
    cross-reference).

  When a caller asks for a verdict on a mint, the graph returns:

  | Verdict | Meaning |
  | --- | --- |
  | `SAME_ENTITY_LIKELY` | All three channels (wallet activity, repo content, X posts) converge on the same mint within a tight time window, and the actors share at least one observable link |
  | `CONVERGENT_INTEREST` | Two channels overlap (e.g. an X account posts a CA that a tracked wallet then buys) |
  | `ISOLATED` | No multi-channel overlap; treat the signal at face value |

  Wallet addresses returned in graph responses are masked
  (`first4…last4`) so prior-scan data is not leaked verbatim to
  unrelated callers. The graph is bounded in both node count and per-
  node edge count to prevent a denial-of-service via cross-signal
  flooding.

  ---

  ## Cache layer

  `lib/cache.ts` is a small in-memory TTL cache used across every
  intelligence endpoint. TTLs are explicit per call site (10 minutes for
  X handle scans, longer for wallet deep-scans, configurable for AI
  scans). The cache is process-local so a Railway redeploy is the only
  event that flushes it.

  ---

  ## Error semantics

  Every endpoint returns either a structured success payload or a clean
  JSON error with an `error` code (`rate_limited`,
  `upstream_unavailable`, `invalid_input`, `timeout`, `not_found`)
  and a human-readable `message`. Half-completed responses are not a
  shape the API will ever produce. AI failures fall back to a heuristic
  where one is available (e.g. wallet summary) and surface a clean error
  otherwise.

  ---

  ## Roadmap

  Items on the active roadmap for the Intelligence Hub:

  - **Telegram and Discord channel scanning** (Planned). Same
    signal-extraction methodology, applied to the two remaining
    high-volume crypto-promotion surfaces.
  - **Per-mint intelligence dossier** (Planned). Pre-computed combined
    view of wallet activity, repo references, X posts, smart-money
    buys, and the cross-signal verdict, all on one URL.
  - **Webhook subscriptions** (Planned). Push notifications for
    watched wallets / handles / mints crossing user-configured
    thresholds.

  See [ROADMAP.md](./ROADMAP.md) for phasing.
  