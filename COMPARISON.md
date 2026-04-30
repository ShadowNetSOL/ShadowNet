# How ShadowNet compares

  This page maps ShadowNet against the tools people most often reach for
  when they want privacy or stealth on Web3. The comparison is meant to
  be honest, not flattering. Each tool below is good at what it does;
  none of them does what ShadowNet does.

  > Short version: every existing option solves *one slice* of the
  > problem (network privacy, OR stealth browsing, OR wallet sovereignty,
  > OR on-chain research). ShadowNet is the only product designed from
  > day one to do all four in one session.

  ---

  ## Capability matrix

  | Capability | **ShadowNet** | Tor Browser | Brave + Phantom | VPN + Phantom | Stealth scripts (puppeteer-extra-stealth, etc.) | Mixers (Tornado-style) |
  | --- | :---: | :---: | :---: | :---: | :---: | :---: |
  | **IP routed through privacy infrastructure** | ✅ | ✅ | ❌ | ✅ | ⚠️ DIY | ❌ |
  | **Region-coherent browser fingerprint** | ✅ atomic preset bundles | ⚠️ uniform "Tor browser" fingerprint | ❌ unique per user | ❌ | ⚠️ requires manual coherence work | ❌ |
  | **Auto-escalation to remote browser when challenged** | ✅ classifier-driven | ❌ | ❌ | ❌ | ❌ | ❌ |
  | **Anti-bot wall handling (Cloudflare, hCaptcha, DataDome)** | ✅ remote tier | ❌ blocked frequently | ❌ | ❌ | ⚠️ fragile, breaks per release | ❌ |
  | **Browser-only wallet generation (server never sees keys)** | ✅ `@scure/bip39` + `@noble/ed25519` | n/a | ✅ | ✅ | n/a | n/a |
  | **Phantom-compatible Solana wallets** | ✅ verified at unit-test level | ❌ | ✅ native | ✅ native | ❌ | ❌ |
  | **Web3-native trading (Jupiter Ultra)** | ✅ fee-routed swap proxy | ❌ | ❌ | ❌ | ❌ | ❌ |
  | **On-chain intel (wallet PnL, X CA, smart followers, GitHub recon)** | ✅ Intel Hub | ❌ | ❌ | ❌ | ❌ | ❌ |
  | **Operator logs nothing user-identifying** | ✅ hostname + status only | ✅ if relay operators are honest | ❌ Brave is a company with logs | ⚠️ depends on VPN | n/a | ❌ on-chain trail |
  | **Open source, MIT** | ✅ | ✅ | ⚠️ partial | ❌ commercial | ⚠️ many forks | ⚠️ varies |
  | **Holder-gated access (no Stripe, no email)** | ✅ on-chain SPL balance + HMAC claim | ❌ | ❌ | ❌ | ❌ | n/a |
  | **Regulatory posture** | ✅ no custody, no on-chain mixing | ✅ | ✅ | ✅ | ✅ | ❌ heavy sanctions risk |

  Legend: ✅ ships and works · ⚠️ partial or DIY · ❌ does not exist
  in this category

  ---

  ## Per-tool notes

  ### Tor Browser

  The gold standard for network-level anonymity. Every Tor user looks
  identical at the browser-fingerprint level (by design), which is
  genuinely powerful. But:

  - Tor exit nodes are blocked by most modern dApps and on-ramps.
  - Tor is not Solana-native. There is no wallet, no Jupiter, no
    on-chain research surface.
  - The "browse with Tor, then swap on a regular browser" workflow
    defeats the entire point: the swap session deanonymises you.

  **Verdict.** Best in class for "I want to read a website privately".
  Not a Web3 access layer.

  ### Brave + Phantom

  The default crypto-native browsing setup. Brave has built-in shields,
  which are real, and Phantom is a great wallet. But:

  - Your IP is never hidden unless you enable Brave Tor (which
    inherits Tor's exit-node block problem).
  - Your fingerprint is your normal Brave fingerprint, which is unique
    enough to track across sites.
  - Brave is a company with telemetry, an ad business, and a logged-in
    Rewards system. The privacy story is real but partial.
  - Nothing escalates when a dApp throws a Cloudflare challenge.

  **Verdict.** A baseline. Not a privacy stack.

  ### VPN + Phantom

  The most common setup users assume protects them. It does not, in the
  ways that matter:

  - A VPN swaps one IP for another. Your browser fingerprint, cookies,
    WebRTC, and behaviour are all still you.
  - Most consumer VPNs log enough metadata to deanonymise on subpoena.
  - No anti-bot escalation, no session isolation, no Web3-native
    surface.

  **Verdict.** Solves the IP layer only, and even that imperfectly.

  ### Stealth scripts (puppeteer-extra-stealth, undetected-chromedriver, etc.)

  The DIY route for technical users. These are libraries, not products:

  - You are responsible for fingerprint coherence, proxy rotation, and
    challenge handling.
  - They lag the anti-bot upgrades, often by weeks.
  - No wallet, no swap layer, no on-chain intel.
  - Not a user-facing dApp.

  **Verdict.** Useful for engineers building scrapers. Not a substitute
  for an integrated privacy product.

  ### Mixers (Tornado Cash and successors)

  A different category entirely. Mixers obfuscate on-chain origin of
  funds; they do not protect your *session* identity. They also carry
  serious regulatory exposure:

  - US OFAC has sanctioned mixer contracts and indicted developers.
  - Many CEXs auto-flag wallets that have ever interacted with one.
  - They do nothing for browser fingerprint, IP, or session.

  **Verdict.** Different problem, different (severe) risk profile.
  Not comparable.

  ---

  ## Where ShadowNet sits

  ShadowNet is the only option that:

  1. **Treats privacy as a stack, not a feature.** Network, fingerprint,
     session, and key handling are all designed together.
  2. **Is Web3-native.** Wallet, trading terminal, on-chain intel, and
     the relay all live in one app, in one session.
  3. **Has a real answer to the anti-bot upgrade cycle.** The two-tier
     orchestrator escalates to a disposable Chromium pool when needed,
     transparently.
  4. **Holds nothing that could be subpoenaed.** No keys, no logs, no
     per-user accounts.
  5. **Is open source under MIT, end to end.** Every line is auditable
     on GitHub today.

  ---

  ## What ShadowNet does *not* claim

  To stay credible, here is what we explicitly do not say:

  - We do **not** claim to defeat global passive adversaries (NSA-tier
    traffic analysis). No relay product can.
  - We do **not** claim audited infrastructure. Independent audit is
    on the roadmap, framed honestly in [STATUS.md](./STATUS.md).
  - We do **not** claim to protect against active fingerprinting like
    mouse-dynamics or behavioural biometrics. See
    [THREAT_MODEL.md](./THREAT_MODEL.md).
  - We do **not** claim to make on-chain history private. Solana is a
    public ledger; ShadowNet protects everything *around* it.

  This list matters. A privacy product that overstates its protection
  is worse than one that admits its limits, because users make decisions
  based on what they think they have.
  