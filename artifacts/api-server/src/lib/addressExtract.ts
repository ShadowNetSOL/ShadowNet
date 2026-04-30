/**
 * Multi-chain address extraction.
 *
 * Front Run Pro / Alpha Gate-grade scanner: every chain you'd realistically
 * see in a crypto-Twitter post gets its own pattern + validator. The
 * tagged-chain output lets the UI render badges so users instantly
 * see whether a posted address is a Solana CA, an ETH contract, a TON
 * wallet, etc — instead of a blob of base58 strings.
 *
 * Patterns intentionally err toward higher precision than recall on
 * Solana — the 32-44 base58 range overlaps with random hashes and
 * gibberish. Heuristics: must contain at least one digit AND at least
 * one letter, must not be all-uppercase or all-lowercase, blacklist
 * trivial values.
 */

export type Chain = "sol" | "eth" | "btc" | "tron" | "ton";

export interface ExtractedAddress {
  chain: Chain;
  address: string;
  /** Heuristic: does this look like a token CA vs an EOA wallet?
   *  EVM CAs typically appear in dexscreener/etherscan-style URLs;
   *  Solana SPL token mints often have specific ending patterns; for
   *  ambiguous matches we leave it as "unknown" and let the UI label
   *  it as "address" without forcing a category. */
  kind: "ca" | "wallet" | "unknown";
}

interface PatternConfig {
  chain: Chain;
  re: RegExp;
  validate: (addr: string) => boolean;
}

const PATTERNS: PatternConfig[] = [
  // Ethereum + EVM-compatible (Base, Arbitrum, Optimism, Polygon, BSC).
  {
    chain: "eth",
    re: /\b0x[a-fA-F0-9]{40}\b/g,
    validate: (a) => a.length === 42 && /^0x[a-fA-F0-9]{40}$/.test(a),
  },
  // TRON: T + 33 base58.
  {
    chain: "tron",
    re: /\bT[1-9A-HJ-NP-Za-km-z]{33}\b/g,
    validate: (a) => a.length === 34,
  },
  // Bitcoin bech32 (bc1...) + legacy P2PKH/P2SH (1.../3...).
  {
    chain: "btc",
    re: /\b(?:bc1[ac-hj-np-z02-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
    validate: (a) => {
      if (a.startsWith("bc1")) return a.length >= 14;
      return a.length >= 26 && a.length <= 35;
    },
  },
  // TON: EQ... / UQ... base64-url 48 chars, or raw -1:hex.
  {
    chain: "ton",
    re: /\b(?:EQ|UQ)[A-Za-z0-9_-]{46}\b/g,
    validate: (a) => a.length === 48,
  },
  // Solana — base58, 32-44 chars. Most ambiguous, last so longer-prefix
  // chains capture first. Strict heuristics applied in validate().
  {
    chain: "sol",
    re: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
    validate: isLikelySolanaAddress,
  },
];

const TRIVIAL_BLACKLIST = new Set([
  "11111111111111111111111111111111", // SystemProgram
  "So11111111111111111111111111111111111111112", // wSOL — useful but never a "shilled CA"
]);

function isLikelySolanaAddress(addr: string): boolean {
  if (addr.length < 32 || addr.length > 44) return false;
  if (TRIVIAL_BLACKLIST.has(addr)) return false;
  // Must mix digits + letters and have casing variation; reduces false
  // positives from random bursts of all-letter tweets.
  if (!/[0-9]/.test(addr)) return false;
  if (!/[a-zA-Z]/.test(addr)) return false;
  if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) return false;
  return true;
}

/**
 * Extract every chain-tagged address from a text blob. Order-stable;
 * deduplicates within the same blob.
 */
export function extractAddresses(text: string): ExtractedAddress[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: ExtractedAddress[] = [];
  for (const { chain, re, validate } of PATTERNS) {
    // Reset regex state — global regexes carry lastIndex between calls.
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const addr = m[0];
      if (!validate(addr)) continue;
      const key = `${chain}:${addr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ chain, address: addr, kind: classifyKind(chain, addr, text) });
    }
  }
  return out;
}

function classifyKind(chain: Chain, addr: string, _context: string): ExtractedAddress["kind"] {
  // EVM 0x addresses can be either; without an RPC call we can't tell
  // contract from EOA. Default unknown so the UI can render a neutral
  // "address" badge. Solana same. Mark Bitcoin / TRON / TON as wallet
  // by convention — token contracts on those chains are uncommon.
  if (chain === "btc" || chain === "tron" || chain === "ton") return "wallet";
  return "unknown";
}
