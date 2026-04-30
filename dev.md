# Local development

  This guide covers running ShadowNet on your machine, the environment
  variables you need, and the codegen workflow that keeps the frontend
  and backend type-aligned.

  ## Prerequisites

  | Tool | Version |
  | --- | --- |
  | Node | 24.x (see `.nvmrc`) |
  | pnpm | 9.x or later |
  | Postgres | optional, only required if you wire DB-backed features locally |

  ## First-run setup

  ```bash
  pnpm install
  ```

  The monorepo uses pnpm workspaces. `pnpm install` will hydrate
  `node_modules` for every artifact in `artifacts/` and every shared
  library in `lib/`.

  ## Running everything

  ```bash
  pnpm run dev
  ```

  This boots all artifacts in parallel via the workflow runner:

  - `artifacts/api-server` (Express + bare server) on the `PORT`
    environment variable.
  - `artifacts/shadownet` (Vite SPA) on its own port. The Vite config
    reads `PORT` from the environment, so do not hard-code a port in
    the dev server.
  - `artifacts/mockup-sandbox` (component preview server) for design
    iteration.

  ## Environment variables

  A complete reference lives in [`.env.example`](./.env.example). The
  short version, grouped by capability:

  ### Required for the API server to boot

  - `PORT` (injected by the platform)

  ### Required for the holder tier

  - `HELIUS_API_KEY` for the SPL balance check.
  - `ENTITLEMENT_MINT` for the gating mint address.
  - `ENTITLEMENT_MIN_BALANCE` (defaults to `1`).
  - `CLAIM_SIGNING_KEY` for HMAC-signing claim tokens.
    In dev, a process-lifetime key is generated automatically. In
    production this MUST be set to a stable secret.

  ### Required for trading and swaps

  - `SOLANA_RPC` for the trading-side Solana mainnet RPC.
  - `SOLANA_RPC_URL` for the intelligence-side Solana RPC.
    These can point at the same provider; they are kept distinct so
    you can rate-limit trading separately if you need to.
  - `JUPITER_API_KEY` for Jupiter Ultra Swap.
  - `FEE_WALLET` for the platform-fee receiver pubkey.
  - `FEE_ACCOUNT_WSOL`, `FEE_ACCOUNT_USDC`, `FEE_ACCOUNT_USDT` for
    pre-created ATAs that fees route into.
  - `PLATFORM_FEE_BPS` defaults to `100` (1%). Capped at `255` per
    Jupiter's Ultra contract.

  ### Required for Intel Hub features

  - `TWITTER_API_BEARER` for the X CA Checker (X API v2, app-only Bearer).
  - `GITHUB_TOKEN` for the GitHub Scanner (read-only public-repo scope is
    sufficient).
  - `OPENAI_API_KEY` (or `AI_INTEGRATIONS_OPENAI_API_KEY` if you use the
    Replit AI integration) for AI-assisted classification.
  - `AI_MODEL` to pin the model id, optional.

  ### Region descriptor (multi-region deploys)

  - `RELAY_REGION`, `RELAY_REGION_NAME`, `RELAY_REGION_COUNTRY`,
    `RELAY_REGION_CITY`, `RELAY_REGION_TZ`, `RELAY_REGION_LOCALE` for
    this instance's region.
  - `RELAY_PEERS` (lead instance only) is a JSON array of peer
    descriptors. See [RELAY.md](./RELAY.md) for the schema.

  ### Remote-browser pool (optional)

  - `REMOTE_BROWSER_POOL_URL` for the pool's HTTP endpoint.
  - `REMOTE_BROWSER_POOL_TOKEN` for the bearer token.

  ### Operator endpoints (optional)

  - `ADMIN_TOKEN` enables `/api/admin/metrics` with bearer auth.
  - `FORCE_REMOTE_FOR_HOSTS` is a comma-separated host list that
    short-circuits the orchestrator straight to the remote tier.

  ### Local convenience

  - `STATIC_DIR` overrides where the production server expects to find
    the built frontend. Used in dev only.

  ## Codegen workflow

  ShadowNet's API contract lives in `lib/api-spec` as an OpenAPI
  document. From it we generate:

  - `lib/api-zod` Zod schemas, used by the API server for request and
    response validation.
  - `lib/api-client-react` React Query hooks consumed by the frontend.

  Whenever you change the OpenAPI spec, regenerate:

  ```bash
  pnpm --filter @workspace/api-spec run codegen
  ```

  The generated files are committed. Do not edit them by hand.

  ## Project structure

  ```text
  .
  ├── artifacts/
  │   ├── api-server/         # Express + bare server
  │   ├── mockup-sandbox/     # Component preview server
  │   └── shadownet/          # Vite SPA (React + Wouter)
  ├── lib/
  │   ├── api-spec/           # OpenAPI source
  │   ├── api-zod/            # Generated Zod schemas
  │   ├── api-client-react/   # Generated React Query hooks
  │   └── db/                 # Drizzle schema (optional features)
  ├── scripts/                # Workspace utility scripts
  └── .env.example
  ```

  See [Workspace.md](./Workspace.md) for the full pnpm workspace layout
  and conventions.

  ## Troubleshooting

  **Vite preview is blank.** Make sure the dev server reads `PORT` from
  the environment. A hard-coded port collides with the platform's
  per-artifact port assignments.

  **Bare server returns 5xx for every request.** Check that
  `OFAC_BLOCKED_CC` is not silently filtering, and that your local DNS
  resolves the destination. The proxy refuses any host that resolves to
  a private IP.

  **Holder claim issuance fails in dev.** `ENTITLEMENT_DISABLED=true`
  skips the on-chain check and grants the holder tier to any
  signature-verified wallet. Use this for pre-launch and dev only;
  NEVER set it in production.

  **Trading endpoints return 503.** Confirm `JUPITER_API_KEY`,
  `SOLANA_RPC`, `FEE_WALLET`, and the three `FEE_ACCOUNT_*` ATAs are
  populated.
  