# 🌐 Relay Network

  ShadowNet's relay layer is the per-region pool of API server instances
  that handle stealth proxy traffic. Routing is end-to-end through
  ShadowNet-operated infrastructure. There are **no** public CORS proxies
  in the path.

  ---

  ## Topology

  | Layer | Where it runs | What it does |
  | --- | --- | --- |
  | Region API server | One Railway service per region | Hosts `/api/*` and the Ultraviolet bare server at `/bare/*` |
  | Region peer registry | Lead instance reads `RELAY_PEERS` env | Surfaces all reachable regions through `/api/relay/nodes` |
  | Remote-browser pool | Separate operator-run service | Holds warm Chromium containers behind WebRTC for the holder tier |
  | Frontend | Same origin as the lead API server | Static SPA served by the Express layer; SW points at `/bare/` |

  One Railway service equals one outbound IP equals one region. To list
  more than one region in the UI you deploy the API server to additional
  regions and point your lead instance's `RELAY_PEERS` at them.

  ---

  ## Region descriptor

  Each instance describes itself with the following environment
  variables:

  | Variable | Example | Purpose |
  | --- | --- | --- |
  | `RELAY_REGION` | `us-east` | Region id (used in API responses and routing) |
  | `RELAY_REGION_NAME` | `US East` | Display name |
  | `RELAY_REGION_COUNTRY` | `US` | ISO-3166 alpha-2 |
  | `RELAY_REGION_CITY` | `New York` | City label |
  | `RELAY_REGION_TZ` | `America/New_York` | IANA timezone (drives session locale) |
  | `RELAY_REGION_LOCALE` | `en-US` | BCP-47 locale (drives Accept-Language) |
  | `RELAY_PEERS` | (JSON array) | Optional. Lead instance only. |

  If `RELAY_REGION` is not set, the server still surfaces a single
  default region so the UI does not lie about what is reachable.

  `RELAY_PEERS` is a JSON array of objects matching the same shape as a
  descriptor, plus a `proxyUrl` field that points at the peer's public
  URL. Example:

  ```json
  [
    {
      "id": "eu-west",
      "name": "EU West",
      "country": "Germany",
      "countryCode": "DE",
      "city": "Frankfurt",
      "timezone": "Europe/Berlin",
      "locale": "de-DE",
      "proxyUrl": "https://eu-west.shadownet.network",
      "noLogs": true
    },
    {
      "id": "ap-tokyo",
      "name": "AP Tokyo",
      "country": "Japan",
      "countryCode": "JP",
      "city": "Tokyo",
      "timezone": "Asia/Tokyo",
      "locale": "ja-JP",
      "proxyUrl": "https://ap-tokyo.shadownet.network",
      "noLogs": true
    }
  ]
  ```

  ---

  ## Tier model

  The orchestrator picks one of two tiers per request, transparently to
  the user:

  ### Proxy tier (default)

  - Service-worker rewrites every page-initiated request and forwards
    through `/bare/` on the region API server.
  - WebSocket upgrades pass through the same bare-server pipeline.
  - The session fingerprint preset is applied to outgoing HTTP headers
    (Accept-Language, sec-ch-ua-platform, etc.) so they align with the
    page-level shim. This alignment is enforced via the in-memory
    session store keyed by session id.

  ### Remote-browser tier (holder-gated)

  - The orchestrator escalates to this tier when one of the following is
    true:
    - The host matches the operator's `FORCE_REMOTE_FOR_HOSTS` list.
    - The host has a sticky-remote latch active (a previous session
      landed on remote and the latch is still valid).
    - A precheck verdict from `/api/relay/verify` came back with
      confidence ≥ 0.75.
    - The 24-hour failure rate for the host is ≥ 0.4.
  - The pool returns a signal URL plus ICE servers. The frontend opens a
    WebRTC connection (video track + input data channel).
  - Sessions are TTL-bound and idle-killed after 5 minutes without a
    heartbeat.
  - Strict isolation is required of any compliant pool implementation.
    See [SECURITY.md](./SECURITY.md#remote-browser-pool-isolation).

  If a free-tier user lands on a host that requires escalation, the
  orchestrator returns an honest 402-style payload describing how to
  unlock it, not a silent failure.

  ---

  ## Sticky-remote latch

  Once a host is routed to the remote tier, ShadowNet does not silently
  downgrade it back to the proxy tier within the TTL window. This avoids
  losing cookies and login state when the user navigates inside a gated
  origin. The latch is per-host, not per-session, so a fresh tab to the
  same host also gets the upgraded path.

  ---

  ## Privacy posture

  - The bare server logs hostname and HTTP status only. No request bodies,
    no headers, no client IPs.
  - The Express layer strips `X-Powered-By`. The HTTP layer strips
    `Server` on bare-server responses.
  - The session store is in-memory only and is cleared on every process
    restart. It holds the fingerprint identity for an active session and
    contains no PII, no IPs, and no request bodies.
  - Region instances are stateless across requests. There is no
    cross-region session sharing today.

  ---

  ## Roadmap

  - Independent third-party audit of the bare-server, orchestrator, and
    pool-client code.
  - Public uptime dashboard with per-region availability.
  - Wider geographic distribution.
  - Open-source reference implementation of the remote-browser pool.

  See [STATUS.md](./STATUS.md) for the current production state.
  