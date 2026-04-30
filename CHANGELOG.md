# Changelog

  All notable changes to ShadowNet are documented here. The format is
  based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
  this project adheres to [Semantic Versioning](https://semver.org/).

  ## [1.0.0] — 2026-04-30

  First production release. Architecture rewrite, documentation overhaul,
  and removal of the experimental scaffolding that supported the early
  preview builds.

  ### Added
  - **Service-worker stealth proxy** built on Ultraviolet over a hardened
    `@tomphttp/bare-server-node` backend. WebSockets, dynamic imports, and
    background fetches stay inside the proxy boundary.
  - **Region-coherent fingerprint presets** that lock UA, platform, WebGL
    vendor/renderer, fonts, screen geometry, hardware concurrency, and
    timezone into atomic bundles.
  - **Session orchestrator** that picks between proxy and remote-browser
    tiers based on per-host failure history, an optional precheck verdict,
    and the caller's entitlement.
  - **Failure classifier** for upstream responses (Cloudflare, Turnstile,
    hCaptcha, reCAPTCHA, DataDome, PerimeterX, Akamai, geo-block, soft
    block). Drives the orchestrator escalation policy.
  - **Per-host history** with a sticky-remote latch so users do not lose
    cookies and login state when navigating inside a gated origin.
  - **Holder-tier auth**: `/auth/challenge` and `/auth/verify-holder`
    flow, Solana wallet signature verification, Helius-backed SPL balance
    check, and HMAC-signed claim tokens bound to a device hash.
  - **Remote browser pool client** with strict isolation requirements
    documented for operators (fresh profile per session, no reused
    containers, fingerprint applied at launch flag layer, origin-scoped
    seed state).
  - **Trading terminal**: token discovery via DexScreener and DexProfile
    boosts, tier classification, and the alpha-score 10-layer classifier.
  - **Jupiter Ultra swap proxy** with fee routing into configured ATAs and
    the platform-fee cap (255 bps) enforced server-side.
  - **Chart page** ported from the legacy scanner: search by mint or
    `?token=<ca>`, embedded chart, trade panel, on-demand holder
    distribution, DexScreener client-side fallback for fresh mints.
  - **Intel Hub** suite: Wallet Analyzer, X CA Checker on the official X
    API v2, Smart Followers, GitHub Scanner.
  - **Admin metrics endpoint** (`/admin/metrics`) gated by `ADMIN_TOKEN`.
  - Full `.env.example` covering every consumed variable.

  ### Changed
  - README, ARCHITECTURE, SECURITY, RELAY, THREAT_MODEL, STATUS, dev.md,
    Workspace.md, and CONTRIBUTING all rewritten to reflect the production
    architecture.
  - Frontend stack documented as React + Vite + Wouter (the earlier docs
    incorrectly described Next.js).
  - Trust model rewritten around the two-tier orchestrator and the
    in-region bare-server proxy.

  ### Removed
  - **All public CORS proxy fallbacks**. `allorigins.win`,
    `thingproxy.freeboard.io`, and `corsproxy.io` are no longer in the
    code path or the documentation. Routing is end-to-end through
    ShadowNet-operated infrastructure.
  - "Experimental" project framing throughout the docs.
  - Server-side wallet generation (kept removed from the previous release).

  ### Security
  - Bare server logs hostname and status only. No bodies, headers, or
    client IPs.
  - Holder claims use HMAC-SHA256 with a 15-minute TTL and are bound to a
    device-fingerprint hash to block cross-machine replay.
  - Remote-pool spec documents hard isolation rules so a compliant pool
    implementation cannot leak state across sessions.

  ## [0.1.0] — 2026-04-28

  Initial public preview.

  ### Added
  - Stealth Sessions with fingerprint randomisation.
  - Anonymous Solana wallet generation.
  - Initial Intel Hub modules.
  - SSRF protections, rate limiting, and timeout enforcement on the proxy.
  - Architecture, security, and relay documentation.
  