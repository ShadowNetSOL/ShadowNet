# Workspace

  ShadowNet is a pnpm workspace monorepo. Each artifact (deployable
  application) lives under `artifacts/`. Each shared library lives
  under `lib/`. TypeScript project references stitch the dependency
  graph together so type-checks are incremental and code generation
  flows from a single OpenAPI source of truth.

  ## Stack

  | Layer | Choice |
  | --- | --- |
  | Monorepo | pnpm workspaces |
  | Node | 24.x |
  | Package manager | pnpm 9.x |
  | TypeScript | 5.9 |
  | Frontend | React 18, Vite 5, Wouter, Tailwind, Framer Motion |
  | API framework | Express 5 |
  | Stealth proxy | Ultraviolet over `@tomphttp/bare-server-node` |
  | Database (optional) | PostgreSQL via Drizzle ORM |
  | Validation | Zod (`zod/v4`), `drizzle-zod` |
  | API codegen | Orval, generating from OpenAPI |
  | Build | esbuild for the server CJS bundle, Vite for client bundles |
  | Hosting | Railway, one service per region |

  ## Layout

  ```text
  shadownet-monorepo/
  ├── artifacts/                 # Deployable applications
  │   ├── api-server/            # Express + bare server (Node)
  │   ├── mockup-sandbox/        # Vite component preview server
  │   └── shadownet/             # Vite SPA (React + Wouter)
  ├── lib/                       # Shared libraries
  │   ├── api-spec/              # OpenAPI document + Orval config
  │   ├── api-zod/               # Generated Zod schemas
  │   ├── api-client-react/      # Generated React Query hooks
  │   └── db/                    # Drizzle schema and DB connection
  ├── scripts/                   # Workspace utility scripts
  ├── .env.example               # Authoritative env reference
  ├── pnpm-workspace.yaml
  ├── tsconfig.base.json
  ├── tsconfig.json
  └── package.json
  ```

  ## Artifacts

  ### `artifacts/api-server`

  Express 5 application that serves three things:

  1. `/api/*` JSON control plane (sessions, orchestrator, relay catalog,
     trading, intelligence, auth, admin).
  2. `/bare/*` Ultraviolet bare server for stealth proxy traffic.
  3. The built frontend SPA, served from the same origin so the service
     worker boots from the same domain as `/bare/`.

  Entry point: `src/index.ts`. The HTTP server intercepts `/bare/*`
  before passing to the Express app, and also handles `upgrade` events
  for WebSocket pass-through.

  ### `artifacts/shadownet`

  Vite + React + Wouter SPA. Pages live under `src/pages`:

  - `landing.tsx`, `docs.tsx` for marketing surfaces.
  - `pages/app/sessions.tsx` for stealth-session control.
  - `pages/app/wallet.tsx` for browser-side keypair generation.
  - `pages/app/relay.tsx` for the region directory.
  - `pages/app/trading.tsx` for the Discover token list.
  - `pages/app/chart.tsx` for the per-token detail view.
  - `pages/app/intel.tsx` for the Intel Hub.
  - `pages/app/remote.tsx` for the holder-tier remote browser surface.
  - `pages/app/dashboard.tsx` for the holder hub.

  The service worker lives at `public/uv/sw.js`. It is registered by
  `pages/app/sessions.tsx` (and the remote/proxy boot flow) and
  intercepts every fetch the page makes once a stealth session is active.

  ### `artifacts/mockup-sandbox`

  Vite-based component preview server used during design iteration. Each
  component gets its own URL for iframe embedding. Not deployed to
  production; this artifact only runs locally.

  ## Shared libraries

  ### `lib/api-spec`

  OpenAPI document describing every `/api/*` endpoint plus all request
  and response shapes. The single source of truth for the API contract.

  Run `pnpm --filter @workspace/api-spec run codegen` to regenerate
  `api-zod` and `api-client-react` after changes.

  ### `lib/api-zod`

  Generated Zod schemas. The API server uses them to validate request
  bodies and response payloads. Do not edit by hand.

  ### `lib/api-client-react`

  Generated React Query hooks. The frontend imports typed hooks from
  here for every `/api/*` endpoint it calls. Do not edit by hand.

  ### `lib/db`

  Drizzle ORM schema and database connection helpers. Optional. Required
  only by features that opt into Postgres-backed storage.

  ## TypeScript project references

  `tsconfig.json` references every artifact and library so a single
  `pnpm run typecheck` walks the entire dependency graph. Each package
  has its own `tsconfig.json` extending `tsconfig.base.json`.

  ## Adding a new artifact

  1. Scaffold under `artifacts/<name>/` with its own `package.json`.
  2. Register the artifact through the artifacts skill so the workflow
     runner knows how to start it.
  3. Pick a unique `slug` and matching `previewPath`.
  4. Make the dev server read `PORT` from the environment so per-artifact
     port assignments do not collide.

  ## Adding a shared library

  1. Scaffold under `lib/<name>/` with its own `package.json` and
     `tsconfig.json` extending `tsconfig.base.json`.
  2. Add it to the `pnpm-workspace.yaml` packages list (already wildcarded
     for `lib/*`, no edit usually required).
  3. Add it as a TypeScript project reference in the consuming package's
     `tsconfig.json`.
  4. Import via the `@workspace/<name>` alias declared in the root
     `pnpm-workspace.yaml`.

  ## CI

  GitHub Actions runs typecheck and build on every push to `main` and
  every PR. Dependabot tracks npm and GitHub Actions updates. The
  relevant workflow files live in `.github/workflows/`.

  ## Conventions

  - TypeScript strict, no implicit `any`, no `require`, no
    commented-out code.
  - One logical change per PR.
  - Update `.env.example` whenever a new `process.env.<VAR>` reference
    appears in code.
  - Update the relevant doc whenever a user-visible behaviour changes.

  See [CONTRIBUTING.md](./CONTRIBUTING.md) for the PR workflow and
  [ARCHITECTURE.md](./ARCHITECTURE.md) for the runtime architecture.
  