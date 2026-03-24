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
    a: "ShadowNet is a privacy-focused Web3 access layer designed to reduce exposure when interacting with decentralized applications and the open web. It combines session isolation, browser fingerprint randomization, relay-based routing, and wallet tooling into a single environment.",
  },
  {
    q: "How does ShadowNet improve privacy?",
    a: "ShadowNet operates across multiple layers. It randomizes browser-identifiable properties (such as user-agent, screen configuration, and rendering signals), optionally routes traffic through relay infrastructure to mask IP addresses, and isolates sessions to prevent cross-session tracking. These techniques reduce tracking consistency but do not guarantee anonymity.",
  },
  {
    q: "How do I start a stealth session?",
    a: "Go to the Stealth Sessions page, enter a target URL, optionally select a relay node, and initiate the session. A new isolated browsing context will be created with a randomized fingerprint profile.",
  },
  {
    q: "Can I choose which relay node handles my traffic?",
    a: "Yes. Available relay nodes are listed with metadata such as location and latency. You can select a node before starting a session. Some nodes may be public or temporary during early-stage development.",
  },
  {
    q: "Are the Solana wallets safe to use?",
    a: "Wallets are generated during the request lifecycle and returned directly to the user. The system is designed to avoid persistence, but users should always treat generated keys as sensitive and store them securely.",
  },
  {
    q: "Does ShadowNet store user data?",
    a: "ShadowNet is designed to minimize data retention. Session data is handled in-memory where possible, and no long-term storage is intended. However, users should not assume absolute zero logging in all environments.",
  },
  {
    q: "What is the relay network?",
    a: "The relay network is a routing layer that allows traffic to pass through intermediary servers before reaching a destination. This can help mask a user's IP address. Current implementations may include a mix of temporary and developing infrastructure.",
  },
  {
    q: "Is ShadowNet a VPN?",
    a: "No. ShadowNet operates at the application level rather than system-wide. It focuses on browser-based privacy techniques such as session isolation and fingerprint randomization rather than full-device traffic tunneling.",
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
        body: "ShadowNet's architecture rests on three independent privacy mechanisms: (1) Stealth Sessions with randomized fingerprints and IP cloaking, (2) Anonymous Solana wallet generation with zero server-side retention, and (3) a curated network of relay nodes for traffic routing.",
      },
    ],
  },

{
  id: "stealth-sessions",
  title: "Stealth Sessions",
  icon: Shield,
  content: [
    {
      body: "A stealth session creates an isolated browsing context with a newly generated fingerprint profile. This reduces the ability for websites to correlate activity across sessions.",
    },
    {
      heading: "Fingerprint randomization",
      body: "ShadowNet randomizes browser-exposed attributes such as user-agent, screen resolution, timezone, and rendering signals. These values are designed to reduce tracking consistency rather than provide guaranteed anonymity.",
    },
    {
      heading: "Session isolation",
      body: "Each session is sandboxed, meaning cookies, storage, and cached data are not shared across sessions. This helps prevent cross-session tracking.",
    },
    {
      heading: "Optional relay routing",
      body: "Users can optionally route traffic through relay nodes to reduce direct IP exposure. This is an additional privacy layer but not a guarantee.",
    },
  ],
}

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
        body: "The ShadowNet relay network is a geographically distributed set of independent routing nodes that anonymize your traffic by acting as an intermediary between your browser and any destination.
      },
      {
       ,
      },
      {
        heading: "Choosing a node",
        body: "The Relay Network page displays every available node with its location, current latency (in milliseconds), load percentage, uptime and no-logs badge. For lowest latency, choose a node geographically close to you. For maximum jurisdictional distance from your target's hosting country, choose a node in a different legal jurisdiction.",
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
