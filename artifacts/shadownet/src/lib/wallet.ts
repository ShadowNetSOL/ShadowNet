import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";
import * as ed from "@noble/ed25519";
import bs58 from "bs58";

export interface GenerationProvenance {
  generatedClientSide: true;
  secureContext: boolean;
  entropySource: "crypto.getRandomValues";
  rngBits: 128;
  curve: "ed25519";
  derivationStandard: "SLIP-0010";
  mnemonicStandard: "BIP-39 (English, 12 words)";
  libraries: ReadonlyArray<string>;
  memoryWipedBestEffort: true;
}

export interface GeneratedWallet {
  publicKey: string;
  privateKey: string;
  mnemonic: string;
  derivationPath: string;
  createdAt: string;
  provenance: GenerationProvenance;
}

const ED25519_CURVE_KEY = new TextEncoder().encode("ed25519 seed");
const HARDENED_OFFSET = 0x80000000;

interface DerivedKey {
  key: Uint8Array;
  chainCode: Uint8Array;
}

function wipe(...arrays: Array<Uint8Array | null | undefined>): void {
  for (const a of arrays) {
    if (a && typeof a.fill === "function") {
      try { a.fill(0); } catch { /* ignore wipe errors */ }
    }
  }
}

function masterKeyFromSeed(seed: Uint8Array): DerivedKey {
  const I = hmac(sha512, ED25519_CURVE_KEY, seed);
  const key = I.slice(0, 32);
  const chainCode = I.slice(32);
  // Wipe the source HMAC buffer; the slices are independent copies.
  wipe(I);
  return { key, chainCode };
}

function ckdPriv(parent: DerivedKey, index: number): DerivedKey {
  const indexBytes = new Uint8Array(4);
  new DataView(indexBytes.buffer).setUint32(0, index >>> 0, false);
  const data = new Uint8Array(1 + 32 + 4);
  data[0] = 0x00;
  data.set(parent.key, 1);
  data.set(indexBytes, 33);
  const I = hmac(sha512, parent.chainCode, data);
  const key = I.slice(0, 32);
  const chainCode = I.slice(32);
  // Wipe intermediate buffers that briefly held key material.
  wipe(data, indexBytes, I);
  return { key, chainCode };
}

function deriveSlip10Path(path: string, seed: Uint8Array): DerivedKey {
  let key = masterKeyFromSeed(seed);
  const segments = path.replace(/^m\//, "").split("/").filter(Boolean);
  for (const segment of segments) {
    if (!segment.endsWith("'")) {
      throw new Error("ed25519 SLIP-0010 derivation requires hardened path segments");
    }
    const idx = parseInt(segment.slice(0, -1), 10);
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error(`Invalid path segment: ${segment}`);
    }
    const next = ckdPriv(key, idx + HARDENED_OFFSET);
    // Wipe the previous level's key + chain code now that we've descended past it.
    wipe(key.key, key.chainCode);
    key = next;
  }
  return key;
}

/**
 * Defense-in-depth pre-flight checks. Refuse to generate keys if the runtime
 * cannot supply OS-grade entropy or is not in a secure context.
 */
function assertSecureRuntime(): { secureContext: boolean } {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "WebCrypto getRandomValues is unavailable. Refusing to generate keys without an OS-grade RNG."
    );
  }
  // Smoke-test the RNG actually produces non-zero output.
  const probe = new Uint8Array(32);
  crypto.getRandomValues(probe);
  if (probe.every(b => b === 0)) {
    throw new Error("RNG returned all zeros. Refusing to generate keys.");
  }
  wipe(probe);

  // Browser-only: require HTTPS or localhost. In non-browser runtimes we skip this.
  const inBrowser = typeof window !== "undefined";
  const secureContext = inBrowser ? window.isSecureContext === true : true;
  if (inBrowser && !secureContext) {
    throw new Error(
      "Secure context required (HTTPS or localhost). Refusing to generate keys over plain HTTP."
    );
  }
  return { secureContext };
}

export async function generateAnonymousWallet(): Promise<GeneratedWallet> {
  const { secureContext } = assertSecureRuntime();

  const mnemonic = generateMnemonic(wordlist, 128);
  let seed: Uint8Array | null = null;
  let derived: DerivedKey | null = null;
  let secretKey: Uint8Array | null = null;

  try {
    seed = await mnemonicToSeed(mnemonic);
    const derivationPath = "m/44'/501'/0'/0'";
    derived = deriveSlip10Path(derivationPath, seed);

    const publicKey = await ed.getPublicKeyAsync(derived.key);
    secretKey = new Uint8Array(64);
    secretKey.set(derived.key, 0);
    secretKey.set(publicKey, 32);

    const wallet: GeneratedWallet = {
      publicKey: bs58.encode(publicKey),
      privateKey: bs58.encode(secretKey),
      mnemonic,
      derivationPath,
      createdAt: new Date().toISOString(),
      provenance: {
        generatedClientSide: true,
        secureContext,
        entropySource: "crypto.getRandomValues",
        rngBits: 128,
        curve: "ed25519",
        derivationStandard: "SLIP-0010",
        mnemonicStandard: "BIP-39 (English, 12 words)",
        libraries: [
          "@scure/bip39 (audited)",
          "@noble/hashes (audited)",
          "@noble/ed25519 (audited)",
          "bs58",
        ],
        memoryWipedBestEffort: true,
      },
    };

    return wallet;
  } finally {
    // Best-effort: clear all sensitive intermediate buffers from JS memory.
    // Note: the returned `mnemonic` and `privateKey` strings remain in the React
    // tree until the user navigates away; that exposure is unavoidable in JS.
    wipe(seed, secretKey);
    if (derived) wipe(derived.key, derived.chainCode);
  }
}

export function useGenerateWallet(): UseMutationResult<GeneratedWallet, Error, void> {
  return useMutation<GeneratedWallet, Error, void>({
    mutationKey: ["generate-wallet-local"],
    mutationFn: generateAnonymousWallet,
  });
}
