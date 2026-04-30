/**
 * Solana transaction preview decoder.
 *
 * Inspects a serialized (legacy or v0) Solana transaction enough to show
 * the user "what am I about to sign?" before they tap approve on their
 * phone. We resolve known program ids to friendly labels (System,
 * Token, Token-2022, Memo, ATA, Compute Budget, plus the major DEXes:
 * Raydium, Orca, Jupiter, Meteora, pump.fun) and pull SOL transfer
 * amounts where the instruction shape lets us.
 *
 * What we can't do without RPC: resolve token mints to symbols, look up
 * account balances, simulate the tx. For those we'd need to call the
 * connection — out of scope for the shim. The preview is intentionally
 * conservative: when we can't be sure, we say so.
 */

const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111":             "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA":  "Token Program",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb":  "Token-2022",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL":  "Associated Token Account",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr":  "Memo",
  "ComputeBudget111111111111111111111111111111":  "Compute Budget",

  // DEXes / aggregators
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CLMM",
  "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q": "Raydium Stable",
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": "Orca",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc":  "Orca Whirlpool",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4":  "Jupiter v6",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB":  "Jupiter v4",
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K":  "Meteora DLMM",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB": "Meteora Pools",

  // pump.fun
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P":  "pump.fun",
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA":  "pump.fun AMM",

  // Wallet-routing common helpers
  "WrapnSnoknBzC1AUw3rWgAQDugfChU65jGFDHKfbZcr":  "Wrapped SOL",
};

export interface DecodedInstruction {
  program: string;            // friendly name, e.g. "Raydium AMM v4"
  programId: string;          // base58
  hint?: string;              // human-readable summary of what it does
  warn?: string;              // safety note (e.g. "transfers SOL from your account")
}

export type RiskFlag =
  | { level: "warn"; code: "unknown_program";   message: string }
  | { level: "warn"; code: "complex_tx";        message: string }
  | { level: "warn"; code: "high_sol_outflow";  message: string }
  | { level: "warn"; code: "drains_account";    message: string }
  | { level: "info"; code: "wallet_init";       message: string }
  | { level: "warn"; code: "close_account";     message: string }
  | { level: "warn"; code: "burn_tokens";       message: string };

export interface DecodedPreview {
  ok: boolean;
  feePayer?: string;
  recentBlockhash?: string;
  instructions: DecodedInstruction[];
  // If we found a System.Transfer, surface the lamports total.
  solOut?: number;            // SOL amount leaving the signer
  hasUnknownProgram: boolean;
  /** Aggregated risk flags computed across all instructions. UI uses
   *  these to render warning chips alongside the per-ix list. */
  flags: RiskFlag[];
  raw: string;                // base64 of the bytes we decoded — debug only
}

/** Decode a serialized tx (Uint8Array or number[]) into a preview. */
export function decodeTransaction(input: Uint8Array | number[]): DecodedPreview {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  const out: DecodedPreview = {
    ok: false,
    instructions: [],
    hasUnknownProgram: false,
    flags: [],
    raw: btoa(String.fromCharCode(...bytes.slice(0, 80))),
  };

  try {
    const r = new Reader(bytes);
    // Signatures: shortvec u8 → N × 64-byte signatures (skip).
    const sigCount = r.shortvec();
    r.skip(sigCount * 64);

    // Message header: detect v0 by the leading "0x80 | version" byte.
    const first = r.peek();
    let _version = "legacy";
    if ((first & 0x80) !== 0) {
      _version = `v${first & 0x7f}`;
      r.u8(); // consume version byte
    }
    /* numRequiredSignatures   */ r.u8();
    /* numReadonlySigned       */ r.u8();
    /* numReadonlyUnsigned     */ r.u8();

    const accountCount = r.shortvec();
    const accounts: Uint8Array[] = [];
    for (let i = 0; i < accountCount; i++) accounts.push(r.bytes(32));
    if (accounts.length === 0) return out;

    out.feePayer = base58Encode(accounts[0]!);
    out.recentBlockhash = base58Encode(r.bytes(32));

    const instrCount = r.shortvec();
    let solOut = 0;
    for (let i = 0; i < instrCount; i++) {
      const programIdx = r.u8();
      const accIdxLen = r.shortvec();
      const accIdxs = r.bytes(accIdxLen);
      const dataLen = r.shortvec();
      const data = r.bytes(dataLen);

      const programIdBytes = accounts[programIdx];
      if (!programIdBytes) continue;
      const programId = base58Encode(programIdBytes);
      const program = KNOWN_PROGRAMS[programId] ?? "Unknown program";
      if (!KNOWN_PROGRAMS[programId]) out.hasUnknownProgram = true;

      const decoded: DecodedInstruction = { program, programId };

      // System.Transfer: instruction 2, u32 LE
      if (programId === "11111111111111111111111111111111" && data.length >= 4) {
        const ix = (new DataView(data.buffer, data.byteOffset, data.byteLength)).getUint32(0, true);
        if (ix === 2 && data.length >= 12) {
          const lamports = readU64LE(data, 4);
          const lamportsN = Number(lamports);
          const sol = lamportsN / 1e9;
          decoded.hint = `Transfer ${sol.toFixed(6)} SOL`;
          decoded.warn = "Transfers SOL out of your wallet";
          solOut += sol;
        } else if (ix === 0) {
          decoded.hint = "Create account";
        }
      } else if (programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" || programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
        // SPL Token: ix 3 = Transfer (u64 amount), ix 12 = TransferChecked
        // (u64 amount + u8 decimals), ix 7 = MintTo, ix 8 = Burn, ix 9 = CloseAccount.
        // Without RPC we can't resolve mint → symbol, but we can at
        // least show a numeric amount so users see "Transfer 1,200,000"
        // instead of just "SPL token transfer". Surface raw integer +
        // an approximation if decimals are in the tx (TransferChecked).
        const ix = data[0];
        if (ix === 3 && data.length >= 9) {
          const raw = readU64LE(data, 1);
          decoded.hint = `Transfer ${raw.toLocaleString()} (raw token units)`;
        } else if (ix === 12 && data.length >= 10) {
          const raw = readU64LE(data, 1);
          const decimals = data[9] ?? 0;
          const ui = Number(raw) / Math.pow(10, decimals);
          decoded.hint = `Transfer ${ui.toLocaleString(undefined, { maximumFractionDigits: decimals })} tokens`;
        } else if (ix === 7)  decoded.hint = "Mint to account";
        else if (ix === 8 && data.length >= 9) {
          const raw = readU64LE(data, 1);
          decoded.hint = `Burn ${raw.toLocaleString()} (raw)`;
          decoded.warn = "Burns tokens — irreversible";
        }
        else if (ix === 9)  decoded.hint = "Close token account";
      } else if (programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") {
        decoded.hint = "Create associated token account";
      } else if (programId.startsWith("JUP")) {
        decoded.hint = "Token swap routed via Jupiter";
        decoded.warn = "Approves swap; verify input/output amounts";
      } else if (programId === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" || programId === "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK") {
        decoded.hint = "Raydium swap or LP action";
        decoded.warn = "Approves swap; verify input/output amounts";
      } else if (programId === "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" || programId === "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA") {
        decoded.hint = "pump.fun trade";
        decoded.warn = "Approves token buy/sell on pump.fun";
      } else if (programId === "ComputeBudget111111111111111111111111111111") {
        decoded.hint = "Set compute units / priority fee";
      }

      // Mark unused for noUnusedLocals environments.
      void accIdxs; void _version;
      out.instructions.push(decoded);
    }

    if (solOut > 0) out.solOut = solOut;
    out.ok = true;
  } catch {
    // Best-effort decoder; never throw from a wallet preview path.
  }

  // Aggregate risk flags after decode. Heuristic-only; no RPC required.
  if (out.hasUnknownProgram) {
    out.flags.push({ level: "warn", code: "unknown_program", message: "Includes a program ShadowNet doesn't recognise — review carefully." });
  }
  if (out.instructions.length >= 5) {
    out.flags.push({ level: "warn", code: "complex_tx", message: `Complex transaction (${out.instructions.length} instructions) — verify each step.` });
  }
  if (typeof out.solOut === "number" && out.solOut >= 1) {
    out.flags.push({ level: "warn", code: "high_sol_outflow", message: `Sends ${out.solOut.toFixed(3)} SOL out of your wallet.` });
  }
  if (typeof out.solOut === "number" && out.solOut >= 5) {
    out.flags.push({ level: "warn", code: "drains_account", message: "Large SOL outflow — confirm the recipient address." });
  }
  if (out.instructions.some((ix) => ix.hint === "Close token account")) {
    out.flags.push({ level: "warn", code: "close_account", message: "Closes a token account — refunds rent but ends that token's history." });
  }
  if (out.instructions.some((ix) => ix.hint === "Burn tokens")) {
    out.flags.push({ level: "warn", code: "burn_tokens", message: "Burns tokens — irreversible." });
  }
  if (out.instructions.some((ix) => ix.hint === "Create associated token account")) {
    out.flags.push({ level: "info", code: "wallet_init", message: "Creates a token account (small SOL rent fee)." });
  }

  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────

class Reader {
  private i = 0;
  constructor(private buf: Uint8Array) {}
  peek(): number { return this.buf[this.i] ?? 0; }
  u8(): number { return this.buf[this.i++] ?? 0; }
  bytes(n: number): Uint8Array { const s = this.buf.subarray(this.i, this.i + n); this.i += n; return s; }
  skip(n: number): void { this.i += n; }
  shortvec(): number {
    // Compact-u16: 1-3 bytes, 7 bits per byte, little-endian, MSB = continue.
    let v = 0, shift = 0;
    for (let n = 0; n < 3; n++) {
      const b = this.u8();
      v |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return v;
      shift += 7;
    }
    return v;
  }
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) v |= BigInt(data[offset + i] ?? 0) << BigInt(i * 8);
  return v;
}

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Convert to BigInt for arithmetic.
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    const r = Number(n % 58n);
    s = B58_ALPHABET[r]! + s;
    n /= 58n;
  }
  for (let i = 0; i < zeros; i++) s = "1" + s;
  return s;
}
