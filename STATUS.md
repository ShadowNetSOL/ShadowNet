# 📊 ShadowNet System Status

  ShadowNet is **live in production** at
  [shadownet.network](https://shadownet.network), serving real traffic
  on Solana mainnet today. This page is the source of truth for what is
  shipped, what is opt-in, and what is on the execution roadmap.

  If you are evaluating ShadowNet from a technical, product, or
  investment angle, this is the page to check first. We update it
  release by release.

  ---

  ## ✅ Live in production

  Every component below is deployed, exercised on mainnet, and covered
  by the documented architecture in [ARCHITECTURE.md](./ARCHITECTURE.md):

  | Component | Status | Notes |
  | --- | --- | --- |
  | Stealth proxy (bare-server + service worker) | ✅ Live | Ultraviolet over `@tomphttp/bare-server-node` |
  | Region-coherent fingerprint presets | ✅ Live | Atomic UA / platform / WebGL / fonts / resolution bundles |
  | Session orchestrator | ✅ Live | Routes between proxy and remote tiers |
  | Per-host failure history + classifier | ✅ Live | Auto-escalates known-gated destinations |
  | Anonymous wallet generation | ✅ Live | Browser-only, Phantom-compatible |
  | Trading terminal (Discover) | ✅ Live | DexScreener + alpha scoring |
  | Jupiter Ultra swap proxy | ✅ Live | Fee-routed via configured ATAs |
  | Chart page (token detail) | ✅ Live | Birdeye holder enrichment optional |
  | Intel Hub: Wallet Analyzer | ✅ Live | |
  | Intel Hub: X CA Checker | ✅ Live | Official X API v2, app-only Bearer auth |
  | Intel Hub: Smart Followers | ✅ Live | |
  | Intel Hub: GitHub Scanner | ✅ Live | |
  | Holder-tier auth (HMAC claim) | ✅ Live | Helius-backed SPL balance check |
  | Remote-browser pool client | ✅ Live | Connects to a separately-operated pool |
  | Admin metrics endpoint | 🟡 Opt-in | Enable by setting `ADMIN_TOKEN` |

  ---

  ## 🌐 Region network

  The relay catalog is sourced from environment configuration, not a
  hard-coded list. One Railway service equals one outbound IP equals one
  region. To advertise more than one region in the UI:

  1. Deploy the API server to additional regions.
  2. Set `RELAY_REGION`, `RELAY_REGION_NAME`, `RELAY_REGION_COUNTRY`,
     `RELAY_REGION_CITY`, `RELAY_REGION_TZ`, and `RELAY_REGION_LOCALE`
     on each instance.
  3. On your "lead" instance, list the others in `RELAY_PEERS` (a JSON
     array of region descriptors).

  If `RELAY_REGION` is unset, the server surfaces a single default
  region so the UI never lies about what is reachable.

  See [RELAY.md](./RELAY.md) for the full schema.

  ---

  ## 🔒 Hardening in production

  - TLS terminated at the Railway edge, with `trust proxy 1` so client
    IPs are read from `X-Forwarded-For`.
  - Express-level and HTTP-level removal of `X-Powered-By` and `Server`
    headers.
  - Rate limit of 60 req/min on `/api/intelligence` and `/api/relay`,
    plus a slow-down on `/api/relay` after 20 req/min.
  - 10-second per-request timeout.
  - SSRF guards on the proxy: protocol allowlist, port denylist, DNS-based
    private-IP filtering.
  - OFAC country-code soft-block list exposed for upstream enforcement.
  - No request bodies, headers, or client IPs are logged by the bare
    server. Hostname and status code only.

  ---

  ## 🛣️ Execution roadmap

  The roadmap is about transparency and decentralisation. The product
  is functional today; what follows raises the trust ceiling:

  - Independent third-party security audit of the relay and orchestrator.
  - Open-source reference implementation of the remote-browser pool, so
    community operators can run additional capacity.
  - Wider geographic distribution of the region registry.
  - Public uptime dashboard with per-region availability.
  - Public incident reporting.
  - Reproducible client builds.

  ---

  ## 📌 Summary

  ShadowNet is production-grade today. The roadmap is about maturing
  transparency, decentralisation, and third-party verification, not
  about catching up to a baseline.
  