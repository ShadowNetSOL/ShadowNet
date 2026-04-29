# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/shadownet` (`@workspace/shadownet`)

ShadowNet — privacy-native Solana Web3 toolkit. Dark theme (#050505), neon green primary (#39FF14), purple secondary (#8B5CF6), monospace.

Key pages (in `src/pages/app/`):
- `dash` — main dashboard
- `stealth` — Stealth Sessions (Tor-like relay routing)
- `wallet` — privacy-first non-custodial wallet (keys stored client-side only via `lib/wallet.ts`)
- `relay` — relay node listings
- `intel` — Intelligence Hub with 3 sub-tools:
  - **WALLET** — Wallet Analyzer with two tabs:
    - **ANALYZE**: AI-written brief, Score, Portfolio, Holdings, **Dev Tokens** (coins launched by this wallet, derived from `initializeMint`/`initializeMint2` instructions in the wallet's recent txs), and a **TRACK WALLET** button
    - **TRACKED**: list of tracked wallets (stored ONLY in `localStorage` under `shadownet:tracked-wallets`, never sent to the server) with per-wallet activity feed; polls every 45s, fires browser Notifications on new buy/sell events using monotonic request IDs to avoid stale/duplicate notifications
  - **X** — Unified X Account Intelligence (single `XAccountScanner` component): one `@username` input → one scan that returns Profile, Username History, Posted Contract Addresses, and Smart Followers. Backend integration pending (UI shows a coming-soon notice with a 4-card preview of the sections each scan produces).
  - **GITHUB** — Repo trust scanner

Backend endpoints (in `artifacts/api-server/src/routes/intelligence.ts`):
- `POST /api/intelligence/wallet` — RPC fan-out (balance, tokens, recent sigs) with `aiSummary` (OpenAI gpt-5.4 with 8s timeout + heuristic fallback, cached 5min)
- `POST /api/intelligence/wallet/onchain` — batches `getParsedTransactions` (chunks of 20, up to 200 sigs); detects dev tokens via `initializeMint*` where `mintAuthority===wallet`; classifies activity as BUY/SELL/RECEIVE/SEND using SOL+stables ("value-like") vs. other token deltas; skips failed txs (`meta.err != null`). Now also returns: per-mint **PnL** (realized via FIFO replay against current SOL-flow valuations + protective `costBasisPerUnit > 0` guard), **archetype** (SNIPER/AIRDROP_FARMER/SMART_MONEY/BAG_HOLDER/ACTIVE_TRADER/DORMANT/NORMAL with confidence + signals), **on-chain score** + **scoreHistory** (24-point ring buffer per wallet), and **copy-trade signal** (winners/moonshots vs prior recorded entries)
- `POST /api/intelligence/github-scan` — GitHub repo trust scanner. Returns: **owner_profile** (account age + repo/follower counts), **scamPatterns** (severity-tiered hits with `verdict` ∈ {LIKELY_MALICIOUS, SUSPICIOUS, LOW_CONCERN, CLEAN} + `confidence` 0–1 + `hits[]` carrying `id/label/severity/evidence`), **antiGaming** (stars/day, star-spike flag, commit-frequency consistency, bursty commits, young-owner flag), **structuralRisk** (top-contributor share, solo-dev dominance, young-cohort flag, Shannon entropy of last 100 commit messages, low-entropy flag, fork-of-template detection, top 5 contributors with per-contributor account ages), **crossSignals** (multi-source overlaps with verdict + sources), **mentionedMints** (Solana CAs extracted from README/description), and **scoreHistory** sparkline. Severity-weighted penalties + verdict floors (LIKELY_MALICIOUS caps trustScore ≤ 25, SUSPICIOUS ≤ 55) plus structural penalties drive `trustScore`; original AI score preserved as `rawTrustScore`.
- `POST /api/intelligence/x-ca`, `POST /api/intelligence/smart-followers` — legacy X stubs (no longer reachable from the unified X tab UI; kept for now until a single unified X endpoint is implemented)
- Wallet endpoint also returns **crossSignals** linking wallet's traded mints back to scanned repos / X mentions with the same verdict scheme.

Helper modules under `artifacts/api-server/src/lib/`:
- `cache.ts` — Map+TTL cache with `memo()` get-or-fetch wrapper. Periodic eviction sweep + cap-free per-entry expiry. Drop-in replacement for Redis later.
- `history.ts` — Per-subject score ring buffer (24 snapshots, 5min collapse window) and per-wallet purchase history (50 entries) for the copy-trade signal. Both Maps are LRU-bounded at 5000 subjects to prevent OOM.
- `wallet-archetype.ts` — Pure: `buildPerMintStats` (chronological replay → per-mint flow/PnL), `summarisePnl` (aggregates + best/worst mint), `classifyArchetype` (8 archetypes by activity shape).
- `github-trust.ts` — Pure. `detectScamPatterns` returns severity-tiered hits (HIGH/MEDIUM/LOW) plus an aggregate verdict + 0–1 confidence; `detectAntiGaming` covers star-velocity, commit-gap consistency, owner age; `detectStructuralRisk` (top-contributor share, young-cohort, Shannon entropy of commit messages, fork-of-template); `applyTrustAdjustments` is severity-weighted with verdict floors (LIKELY_MALICIOUS caps at 25, SUSPICIOUS at 55) and structural penalties layered on top.
- `cross-signal.ts` — Bidirectional in-memory entity graph linking wallets ↔ repos ↔ X mentions, keyed by mint. LRU-bounded (`MAX_MINTS=5000`, `MAX_PER_BUCKET=50`). Eviction (LRU + bucket-trim) cleans BOTH forward and reverse indexes, dropping empty reverse keys to prevent leaks. Verdict policy: `SAME_ENTITY_LIKELY` only when ALL three channels (wallet+repo+X) line up; two-source overlaps surface as `CONVERGENT_INTEREST`. Exposes `linkWalletMint/linkRepoMint/linkXMint`, `getCrossSignalsForWallet/Repo`, and `maskWallet` for privacy-safe response serialization (mask all wallets except the caller's own in API responses).

Caching layer: SOL price (60s), DexScreener token meta (5min, per-mint key), GitHub `/users/:owner` (30min), GitHub `/repos/:owner/:repo/commits` (15min), AI wallet summary (5min, keyed by coarse stats), AI repo analysis (10min, keyed by `full_name + pushed_at` so fresh pushes invalidate).

No DB persistence for tracked wallets — privacy-first by design.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## CI / Build Notes

The repo uses a remote-only GitHub Actions workflow (`.github/workflows/ci.yml` lives only on the `main` branch on GitHub) that runs `pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run build` on Node 20 / pnpm 9. Three things are required for CI to stay green:

1. **`pnpm.overrides` must be present in BOTH `pnpm-workspace.yaml` AND root `package.json`.** Even though pnpm 9.5+ honors `overrides:` in `pnpm-workspace.yaml`, older pnpm 9.x patches don't. `pnpm-lock.yaml` records 81 platform-binary overrides (esbuild / lightningcss / @rollup native modules / @oxide / @ngrok darwin/freebsd/linux/win32/sunos binaries, plus `esbuild@0.27.3` and `@esbuild-kit/esm-loader → tsx@^4.21.0`) — the two override blocks must stay byte-identical with the lockfile or `--frozen-lockfile` will reject install with "overrides configuration doesn't match lockfile."

2. **Express handlers in `artifacts/api-server` use `return void res.status(N).json(...)` / `return void res.json(...)`** so every code path returns `undefined` and the handler signature stays consistent under `noImplicitReturns` (TS7030). Don't reintroduce `return res.status(N).json(...)` — the bare `return res.json` form makes one branch return `Response` while success paths return `void`, and TS errors out.

3. **Vite configs (`artifacts/shadownet/vite.config.ts`, `artifacts/mockup-sandbox/vite.config.ts`) gate the `PORT` / `BASE_PATH` requirement on `process.argv.includes("build")`.** `vite build` produces static assets and doesn't need a port; CI compile-checks would otherwise fail because they don't set those env vars. Dev/preview still requires both strictly. Production deploys on Replit infrastructure inject the correct `BASE_PATH` per artifact, so the `'/'` build-time default only applies to CI compile-checks (whose output is never deployed).
