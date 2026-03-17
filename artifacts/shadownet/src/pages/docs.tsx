import { BookOpen, Shield, Key, Network, Radar, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: "What is ShadowNet?",
    a: "ShadowNet is a privacy-first Web3 access layer designed for anonymous interaction with decentralized applications and the open web. It combines stealth browsing sessions with hardware-level fingerprint spoofing, anonymous Solana keypair generation, and a curated network of audited relay nodes — giving you verifiable, zero-knowledge anonymity without relying on centralized intermediaries.",
  },
  {
    q: "How does ShadowNet protect my identity?",
    a: "ShadowNet operates across three separate layers of protection. First, fingerprint randomization replaces every trackable browser signal — canvas hash, WebGL renderer, audio context, screen resolution, timezone, fonts, and user-agent — with cryptographically generated alternatives. Second, IP cloaking routes all traffic through audited relay nodes so your real IP address is never exposed to any destination server. Third, session isolation ensures that every stealth session runs in a sandboxed context; no cookies, cache, or local storage from previous sessions carry over.",
  },
  {
    q: "How do I start a stealth session?",
    a: "Navigate to the Stealth Sessions page. Enter the target URL you want to visit in the destination field, then select a relay node from the dropdown (or leave it as Direct Connection if you only need fingerprint spoofing). Click INITIATE STEALTH — ShadowNet will generate a fresh fingerprint profile, establish a session through the relay, and present you with a LAUNCH TARGET SITE button to open your destination in the new anonymous context.",
  },
  {
    q: "Can I choose which relay node handles my traffic?",
    a: "Yes. The Stealth Sessions page provides a full node selector listing every available relay in the ShadowNet network, including their country, city, current latency, and capacity. You can pick any online node before initiating a session. The Relay Network page gives you a detailed view with audit status, uptime history, and load metrics to help you choose the most suitable node for your needs.",
  },
  {
    q: "Are the Solana wallets I generate safe to use?",
    a: "ShadowNet generates Solana keypairs entirely on the server using a secure Ed25519 key derivation algorithm and BIP-39 mnemonic generation. The private key and mnemonic are transmitted to you over HTTPS and are never logged, stored, or cached anywhere on the ShadowNet infrastructure. Once the response reaches your browser, the keys exist only in your session memory. You should save your private key and mnemonic immediately and securely — if you close the page without saving them, they cannot be recovered.",
  },
  {
    q: "Can I import my ShadowNet wallet into Phantom?",
    a: "Yes. ShadowNet generates Solana wallets with Base58-encoded private keys in the exact format that Phantom's Import Private Key feature accepts. Open Phantom, go to Settings → Add / Connect Wallet → Import Private Key, and paste the private key displayed on the Wallet Generator page. Your wallet will be imported immediately with full access to send, receive, and interact with dApps.",
  },
  {
    q: "What is the ShadowNet relay network?",
    a: "The ShadowNet relay network is a globally distributed set of routing nodes that mask your IP address by acting as an intermediary between your browser and any destination server. Each node in the network undergoes an independent audit to verify security compliance, a strict no-logging policy, and consistent uptime. Relay nodes are classified as Online, Maintenance, or Offline, and their current load and latency are reported in real time on the Relay Network page.",
  },
  {
    q: "Does ShadowNet store any user data?",
    a: "No. ShadowNet is built on a zero-retention architecture. Fingerprint profiles are generated on-demand and discarded after the API response. Stealth session records are ephemeral and held in memory only for the duration of the request cycle. Wallet keys are never persisted to any database. Relay node connections are stateless. There are no user accounts, no analytics trackers, and no third-party telemetry embedded anywhere in the platform.",
  },
  {
    q: "What does 'audited relay node' mean?",
    a: "An audited relay node is one that has been independently reviewed by a third-party security assessor. The audit covers the node operator's no-logging policy, the server's network isolation configuration, data retention practices, and jurisdictional legal exposure. Nodes that pass the audit receive the Audited badge visible on the Relay Network page. Unaudited nodes are still available but are flagged so you can make an informed choice.",
  },
  {
    q: "Is ShadowNet a VPN?",
    a: "ShadowNet is not a traditional VPN. A VPN typically encrypts all traffic at the OS level and routes it through a single provider's infrastructure. ShadowNet operates at the application layer, specifically targeting Web3 and browser-based activity. It adds fingerprint randomization and session isolation on top of IP routing — capabilities that a standard VPN does not provide. Think of it as a privacy toolkit purpose-built for anonymous on-chain and dApp interaction.",
  },
];

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: Array<{ heading?: string; body: string }>;
}

const intelFaqs: FaqItem[] = [
  {
    q: "What is Intel Hub?",
    a: "Intel Hub is ShadowNet's on-chain investigation suite. It lets you analyze any Solana wallet's transaction history, check Twitter/X accounts for contract addresses they've posted, and track the followers of any X account — all without leaving ShadowNet. Intel Hub is designed for token due-diligence, alpha research, and wallet surveillance.",
  },
  {
    q: "How does the Wallet Analyzer work?",
    a: "Enter any Solana public key. Intel Hub queries the Helius RPC to retrieve all historical transactions for that address, computes PnL across every token traded, identifies the wallet's most profitable and most-held assets, and displays the results in a clean breakdown. You can see realized gains, token frequency, and volume without needing a third-party explorer.",
  },
  {
    q: "What is the X CA Checker?",
    a: "The X CA Checker scans any X (Twitter) account's recent posts for Solana contract addresses (CAs). It extracts and deduplicates any Base58 token mint addresses found in tweets, giving you a fast view of which tokens a given account has publicly promoted. Useful for tracking KOL calls and verifying launch claims.",
  },
  {
    q: "What does Smart Followers show?",
    a: "Smart Followers shows which high-signal X accounts follow a given user. Enter an X handle and ShadowNet cross-references the follower list against a registry of known traders, analysts, and degen wallets. High overlap with smart-money accounts indicates that the account is tracked by the market's best performers.",
  },
];

const sections: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: [
      {
        body: "ShadowNet is a privacy-native access layer for the decentralized web. It gives individuals, researchers, and builders the tools to interact with Web3 applications and the open internet without exposing their identity, location, or device fingerprint.",
      },
      {
        heading: "Why ShadowNet?",
        body: "Modern tracking infrastructure is sophisticated. Websites identify users not just by IP address but through dozens of passive browser signals: canvas rendering output, WebGL GPU information, audio context fingerprints, installed fonts, screen geometry, and more. Standard privacy tools address some of these vectors but rarely all of them simultaneously. ShadowNet was built to close every gap.",
      },
      {
        heading: "Three pillars",
        body: "ShadowNet's architecture rests on three independent privacy mechanisms: (1) Stealth Sessions with randomized fingerprints and IP cloaking, (2) Anonymous Solana wallet generation with zero server-side retention, and (3) a curated network of audited, no-log relay nodes for traffic routing.",
      },
    ],
  },
  {
    id: "stealth-sessions",
    title: "Stealth Sessions",
    icon: Shield,
    content: [
      {
        body: "A stealth session is an isolated browsing context initialized with a freshly generated, randomized identity profile. Every aspect of the browser fingerprint that websites use to track visitors is replaced with plausible but fabricated data before the session connects to any destination.",
      },
      {
        heading: "Fingerprint randomization",
        body: "When you generate a fingerprint profile, ShadowNet creates a randomized set of browser attributes: user-agent string, screen resolution, color depth, timezone, language locale, platform identifier, WebGL vendor and renderer strings, canvas hash, audio hash, and font list. Each profile is unique and statistically indistinguishable from a real browser running on different hardware.",
      },
      {
        heading: "IP cloaking via relay nodes",
        body: "Selecting a relay node before initiating a session routes your outbound traffic through that node. The destination server sees only the relay node's IP address — never your real one. Relay nodes are operated independently and are audited for no-logging compliance, meaning no record of the connection is retained at the routing layer.",
      },
      {
        heading: "Session isolation",
        body: "Each stealth session is fully sandboxed. Cookies, local storage, IndexedDB entries, and cache from any previous session are not accessible from within a new session. This prevents cross-session correlation even if the same relay node is reused.",
      },
      {
        heading: "How to use",
        body: "Go to Stealth Sessions → enter your target URL → select a relay node → click INITIATE STEALTH. Once the session is active, click LAUNCH TARGET SITE to open your destination through the protected context. The session remains active until you terminate it manually or it expires after one hour.",
      },
    ],
  },
  {
    id: "wallet-generator",
    title: "Wallet Generator",
    icon: Key,
    content: [
      {
        body: "The ShadowNet wallet generator creates anonymous Solana keypairs using the Ed25519 elliptic curve algorithm and BIP-39 mnemonic derivation. Generated wallets are fully compatible with Phantom and other Solana wallets that support private key import.",
      },
      {
        heading: "How generation works",
        body: "Each time you click Generate New Keypair, ShadowNet produces a fresh 12-word BIP-39 mnemonic, derives a seed from it, and uses the m/44'/501'/0'/0' Solana derivation path to produce an Ed25519 keypair. The result includes a Base58-encoded public key and a Base58-encoded private key ready for Phantom import.",
      },
      {
        heading: "Zero retention",
        body: "Keys are generated in memory during the API request and are never written to any database, log file, or persistent storage. The only copy of your private key and mnemonic exists in the API response transmitted to your browser. ShadowNet cannot recover keys after the response is delivered.",
      },
      {
        heading: "Importing into Phantom",
        body: "Copy the private key shown on the Wallet Generator page. Open Phantom → click your avatar → Add / Connect Wallet → Import Private Key → paste the key and confirm. Your new anonymous wallet will be added to Phantom immediately and can be used for any on-chain activity.",
      },
      {
        heading: "Security guidance",
        body: "Store your private key and mnemonic phrase in an encrypted password manager or offline secure storage immediately after generation. Do not share them with anyone. Do not screenshot them on a device with cloud sync enabled. If you lose them, the wallet cannot be recovered — ShadowNet holds no copy.",
      },
    ],
  },
  {
    id: "relay-network",
    title: "Relay Network",
    icon: Network,
    content: [
      {
        body: "The ShadowNet relay network is a geographically distributed set of independent routing nodes that anonymize your traffic by acting as an intermediary between your browser and any destination. All nodes in the network are independently audited and operate under strict no-logging policies.",
      },
      {
        heading: "Node audit process",
        body: "Each relay node undergoes a security audit covering: network isolation and firewall configuration, operating system hardening, absence of connection logging at the application and OS level, data retention policies, and jurisdictional risk assessment. Nodes that pass receive the Audited badge. Nodes pending review remain available but are labeled clearly.",
      },
      {
        heading: "Choosing a node",
        body: "The Relay Network page displays every available node with its location, current latency (in milliseconds), load percentage, uptime, audit status, and no-logs badge. For lowest latency, choose a node geographically close to you. For maximum jurisdictional distance from your target's hosting country, choose a node in a different legal jurisdiction.",
      },
      {
        heading: "Node status",
        body: "Online nodes are available immediately. Maintenance nodes are temporarily offline for upgrades and will return to service shortly. Offline nodes are unreachable and cannot be selected for new sessions. The Relay Network page refreshes node status automatically.",
      },
      {
        heading: "Connecting to a node",
        body: "You can connect to a relay node from two places: the Relay Network page (click ROUTE on any online node) or the Stealth Sessions page (select the node from the dropdown before initiating a session). Connecting from the Relay Network page alone gives you a session ID and masked IP. Connecting from Stealth Sessions combines relay routing with fingerprint randomization for the full privacy stack.",
      },
    ],
  },
  {
    id: "intel-hub",
    title: "Intel Hub",
    icon: Radar,
    content: [
      {
        body: "Intel Hub is ShadowNet's on-chain and social intelligence layer. It aggregates wallet transaction history, X account CA activity, and social graph data into a single investigation interface — purpose-built for anonymous due-diligence in the Solana ecosystem.",
      },
      {
        heading: "Wallet Analyzer",
        body: "Paste any Solana public key and Intel Hub retrieves the complete transaction history via Helius RPC. It computes realized PnL across every token traded, highlights the most frequently held assets, and summarizes total volume. No third-party explorers needed — all analysis runs within ShadowNet's privacy stack.",
      },
      {
        heading: "X CA Checker",
        body: "Enter any X (Twitter) handle and Intel Hub scans their recent posts for Solana contract addresses. It extracts and deduplicates all Base58 token mint addresses found in the timeline, giving you a clear list of tokens the account has publicly mentioned. Invaluable for tracking KOL calls, verifying presale claims, and auditing influencer histories.",
      },
      {
        heading: "Smart Followers",
        body: "Enter an X handle to see which high-signal accounts follow them. ShadowNet cross-references the follower list against a curated registry of known on-chain traders, analysts, and degen wallets. High overlap with smart-money accounts signals that the market's best performers are watching that account — a strong social alpha indicator.",
      },
      {
        heading: "API key setup",
        body: "For full Intel Hub functionality you need two API keys: a Helius API key (helius.dev) for deep Solana transaction data, and a Twitter API v2 Bearer Token (developer.twitter.com) for full X account analysis. Keys are stored only in your browser session and are never transmitted to ShadowNet's servers beyond the proxied API request.",
      },
    ],
  },
];

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="border border-primary/20 rounded-lg overflow-hidden bg-white/[0.03]"
        >
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left text-white font-mono text-sm hover:bg-primary/5 transition-colors"
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
          >
            <span className="pr-4">{item.q}</span>
            {openIdx === idx ? (
              <ChevronDown className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
            )}
          </button>
          <AnimatePresence>
            {openIdx === idx && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5 pt-1 text-sm text-white/50 font-mono leading-relaxed border-t border-primary/10">
                  {item.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const current = sections.find(s => s.id === activeSection) ?? sections[0];

  const allFaqs = [...faqs, ...intelFaqs];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Top nav */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/6 bg-[#050505]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-xs font-mono font-bold text-primary tracking-widest">SHADOWNET</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/">
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 hover:text-white/70 transition-colors cursor-pointer tracking-widest">
              <ArrowLeft className="w-3 h-3" /> BACK
            </span>
          </Link>
          <Link href="/app/dashboard">
            <span className="px-3 py-1.5 bg-primary text-black text-[10px] font-mono font-bold rounded hover:bg-white transition-colors cursor-pointer tracking-wider">LAUNCH APP</span>
          </Link>
        </div>
      </div>

    <div className="max-w-6xl mx-auto pt-24 pb-20 px-6">
      <div className="border-b border-primary/20 pb-6 mb-8">
        <h1 className="text-3xl font-display text-white flex items-center gap-3">
          <BookOpen className="text-primary w-8 h-8" />
          DOCUMENTATION
        </h1>
        <p className="text-white/50 font-mono mt-2">
          Technical reference for all ShadowNet modules and privacy protocols.
        </p>
      </div>

      {/* Mobile section picker — above the flex row */}
      <div className="md:hidden w-full mb-6">
        <select
          value={activeSection}
          onChange={e => setActiveSection(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-primary/30 rounded-md py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-primary"
        >
          {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          <option value="faq">FAQ</option>
        </select>
      </div>

      <div className="flex gap-8">
        {/* Doc sidebar — desktop only */}
        <aside className="w-56 shrink-0 hidden md:block">
          <nav className="space-y-1 sticky top-20">
            {sections.map(s => {
              const isActive = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-all font-mono text-sm ${
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-white/30 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <s.icon className="w-4 h-4 shrink-0" />
                  {s.title}
                </button>
              );
            })}
            <div className="pt-4 mt-4 border-t border-primary/10">
              <button
                onClick={() => setActiveSection("faq")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-all font-mono text-sm ${
                  activeSection === "faq"
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-white/30 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
              >
                <span className="text-base leading-none">?</span>
                FAQ
              </button>
            </div>
          </nav>
        </aside>

        {/* Doc content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeSection === "faq" ? (
              <motion.div
                key="faq"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-2xl font-display text-white mb-2">Frequently Asked Questions</h2>
                <p className="text-white/50 font-mono text-sm mb-8">Common questions about ShadowNet's privacy stack and how to use it.</p>
                <FaqAccordion items={allFaqs} />
              </motion.div>
            ) : (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <current.icon className="w-7 h-7 text-primary" />
                  <h2 className="text-2xl font-display text-white">{current.title}</h2>
                </div>

                <div className="space-y-6">
                  {current.content.map((block, i) => (
                    <div key={i} className="space-y-2">
                      {block.heading && (
                        <h3 className="text-base font-display text-primary tracking-wide">{block.heading}</h3>
                      )}
                      <p className="text-white/50 font-mono text-sm leading-relaxed">{block.body}</p>
                    </div>
                  ))}
                </div>

                {/* Inline next section hint */}
                <div className="mt-10 pt-6 border-t border-primary/10 flex flex-wrap gap-3">
                  {sections.filter(s => s.id !== current.id).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className="flex items-center gap-2 text-xs font-mono text-white/50 hover:text-primary transition-colors border border-primary/15 hover:border-primary/40 rounded px-3 py-2"
                    >
                      <s.icon className="w-3 h-3" />
                      {s.title}
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveSection("faq")}
                    className="flex items-center gap-2 text-xs font-mono text-white/50 hover:text-primary transition-colors border border-primary/15 hover:border-primary/40 rounded px-3 py-2"
                  >
                    FAQ
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </div>
  );
}
