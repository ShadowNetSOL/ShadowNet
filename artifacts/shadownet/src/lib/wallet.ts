import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";
import * as ed from "@noble/ed25519";
import bs58 from "bs58";

export interface GeneratedWallet {
  publicKey: string;
  privateKey: string;
  mnemonic: string;
  derivationPath: string;
  createdAt: string;
}

const ED25519_CURVE_KEY = new TextEncoder().encode("ed25519 seed");
const HARDENED_OFFSET = 0x80000000;

interface DerivedKey {
  key: Uint8Array;
  chainCode: Uint8Array;
}

function masterKeyFromSeed(seed: Uint8Array): DerivedKey {
  const I = hmac(sha512, ED25519_CURVE_KEY, seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function ckdPriv(parent: DerivedKey, index: number): DerivedKey {
  const indexBytes = new Uint8Array(4);
  new DataView(indexBytes.buffer).setUint32(0, index >>> 0, false);
  const data = new Uint8Array(1 + 32 + 4);
  data[0] = 0x00;
  data.set(parent.key, 1);
  data.set(indexBytes, 33);
  const I = hmac(sha512, parent.chainCode, data);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
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
    key = ckdPriv(key, idx + HARDENED_OFFSET);
  }
  return key;
}

export async function generateAnonymousWallet(): Promise<GeneratedWallet> {
  const mnemonic = generateMnemonic(wordlist, 128);
  const seed = await mnemonicToSeed(mnemonic);
  const derivationPath = "m/44'/501'/0'/0'";
  const { key } = deriveSlip10Path(derivationPath, seed);

  const publicKey = await ed.getPublicKeyAsync(key);
  const secretKey = new Uint8Array(64);
  secretKey.set(key, 0);
  secretKey.set(publicKey, 32);

  return {
    publicKey: bs58.encode(publicKey),
    privateKey: bs58.encode(secretKey),
    mnemonic,
    derivationPath,
    createdAt: new Date().toISOString(),
  };
}

export function useGenerateWallet(): UseMutationResult<GeneratedWallet, Error, void> {
  return useMutation<GeneratedWallet, Error, void>({
    mutationKey: ["generate-wallet-local"],
    mutationFn: generateAnonymousWallet,
  });
}
