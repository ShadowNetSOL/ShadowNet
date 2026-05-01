# Contributing to ShadowNet

  Thanks for considering a contribution. ShadowNet is open source under
  MIT and welcomes pull requests, issues, and security reports from
  anyone who shares the goal of giving Web3 a real privacy layer.

  ---

  ## Ground rules

  - **Be honest.** Every feature claim in code comments, commit
    messages, docs, or UI strings must be backed by a code path you can
    point to. We use **Live** and **Planned** labels in the docs for a
    reason; please continue that practice.
  - **Be explicit on failure.** Functions should fail with a typed,
    surfaceable error. Silent fallbacks that hide misconfiguration are
    not landed.
  - **Be small.** Smaller PRs land faster and are easier to review. If a
    change is large, please open an issue first to align on direction.

  ---

  ## Local development

  ```bash
  pnpm install
  pnpm run dev
  ```

  The frontend boots at `http://localhost:5173`. The API server binds
  the platform-injected `PORT`. See [dev.md](./dev.md) for the full
  environment reference and the OpenAPI codegen workflow.

  ---

  ## Codegen

  Shared API types live in `lib/api-zod` and are generated from the
  OpenAPI spec via Orval. After editing the spec:

  ```bash
  pnpm --filter @workspace/api-spec run codegen
  ```

  Both the API server and the React client import the generated types
  and Zod validators.

  ---

  ## Testing your change

  - Run `pnpm typecheck` at the repo root before pushing.
  - For changes to the proxy or any intel endpoint, exercise the
    endpoint locally with `curl` and a real upstream so you see the
    end-to-end behaviour, not just the unit shape.
  - For wallet-code changes, the Phantom-compatibility check is
    load-bearing. Confirm the test that derives a known-mnemonic
    vector still passes.

  ---

  ## Pull-request checklist

  - [ ] Code compiles (`pnpm typecheck` is clean).
  - [ ] Lint is clean (`pnpm lint`).
  - [ ] No new `any`, no new silent fallbacks, no new wallet endpoint.
  - [ ] Docs updated for any user-visible change. New features land
        with a **Live** label only when they actually ship; otherwise
        tag them **Planned** in the relevant doc.
  - [ ] CHANGELOG.md updated under `[Unreleased]`.
  - [ ] Commit messages explain *why*, not just *what*.

  ---

  ## Reporting security issues

  Please **do not** open a public issue for a security vulnerability.
  File a private security advisory through GitHub on the
  `ShadowNetSOL/ShadowNet` repo, or DM the maintainers on the
  project's official channels. We treat responsible disclosure
  seriously and will credit reporters who request it.

  ---

  ## Code of conduct

  Be respectful. Discuss ideas on their merits. Assume good faith. The
  crypto space has enough drama; we don't need to add to it.
  