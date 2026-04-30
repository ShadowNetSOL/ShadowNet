/**
 * Holder-tier wallet auth on the shell side.
 *
 * Talks to /api/auth/challenge + /api/auth/verify-holder to obtain a
 * server-signed entitlement claim. The shell isn't proxied, so a real
 * Phantom / Solflare extension can sign here directly.
 *
 *   getClaim()      → returns the cached, unexpired claim or null
 *   connectHolder() → runs the full auth flow, returns a claim or throws
 *   clearClaim()    → drops local state on logout / wallet switch
 */

import { deviceHash } from "./device-hash";

const STORAGE_KEY = "sn_holder_claim_v1";

export interface StoredClaim {
  wallet: string;
  claim: string;
  expiresAt: string;
}

export function getClaim(): StoredClaim | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as StoredClaim;
    if (!c.claim || !c.expiresAt) return null;
    if (new Date(c.expiresAt).getTime() < Date.now() + 30_000) return null;
    return c;
  } catch { return null; }
}

export function clearClaim(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem("sn_entitlement"); } catch { /* ignore */ }
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string; toString: () => string } }>;
      signMessage?: (msg: Uint8Array, encoding?: "utf8") => Promise<{ signature: Uint8Array }>;
      publicKey?: { toBase58: () => string };
    };
    phantom?: { solana?: Window["solana"] };
  }
}

function pickProvider(): NonNullable<Window["solana"]> | null {
  if (typeof window === "undefined") return null;
  const direct = window.solana;
  if (direct && typeof direct.connect === "function" && typeof direct.signMessage === "function") return direct;
  const ph = window.phantom?.solana;
  if (ph && typeof ph.connect === "function" && typeof ph.signMessage === "function") return ph;
  return null;
}

const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { const r = Number(n % 58n); s = ALPH[r]! + s; n /= 58n; }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) s = "1" + s;
  return s;
}

export async function connectHolder(): Promise<StoredClaim> {
  const provider = pickProvider();
  if (!provider) {
    throw new Error("No Solana wallet detected. Install Phantom or Solflare.");
  }

  const conn = await provider.connect!({ onlyIfTrusted: false });
  const wallet = conn.publicKey.toBase58();

  const base = (import.meta.env.BASE_URL as string) || "/";
  const challengeRes = await fetch(`${base}api/auth/challenge`);
  if (!challengeRes.ok) throw new Error("Server didn't issue a challenge");
  const { nonce, message } = (await challengeRes.json()) as { nonce: string; message: string };

  const signed = await provider.signMessage!(new TextEncoder().encode(message), "utf8");
  const signature = toBase58(signed.signature);

  const dh = await deviceHash();
  const verifyRes = await fetch(`${base}api/auth/verify-holder`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, nonce, signature, deviceHash: dh }),
  });
  if (!verifyRes.ok) {
    const data = await verifyRes.json().catch(() => ({})) as { reason?: string };
    const map: Record<string, string> = {
      bad_signature:               "Signature didn't verify. Try again.",
      bad_nonce:                   "Challenge expired. Try again.",
      insufficient_balance:        "Wallet doesn't hold enough of the gating token.",
      entitlement_not_configured:  "Holder tier isn't configured on this deployment.",
    };
    throw new Error(map[data.reason ?? ""] ?? `Verification failed (${verifyRes.status})`);
  }
  const data = (await verifyRes.json()) as { claim: string; expiresAt: string };
  const stored: StoredClaim = { wallet, claim: data.claim, expiresAt: data.expiresAt };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    localStorage.setItem("sn_entitlement", "holder");
  } catch { /* ignore */ }
  return stored;
}
