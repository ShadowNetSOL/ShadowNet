/**
 * Holder-claim issuance + verification.
 *
 * The flow:
 *   1. Frontend asks /api/auth/challenge for a one-time nonce.
 *   2. User signs the nonce with their Solana wallet (Phantom etc).
 *   3. Frontend posts { wallet, nonce, signature } to /api/auth/verify-holder.
 *   4. Server verifies the signature with the wallet's public key, then
 *      calls Helius via verifyHolder() to confirm SPL balance.
 *   5. On success, server returns an HMAC-signed claim token. The
 *      orchestrator validates this token (no RPC) on every subsequent
 *      request — fast path.
 *
 * Tokens are short-lived (1h) so a wallet that drops below the holder
 * threshold mid-session loses access at most one hour later. Renewal is
 * a single sign-and-post — handled silently by the frontend.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// Short TTL — architect's "5–15 min" rule. A wallet that drops below
// the holder threshold mid-session loses access at most this long
// later. The frontend silently re-signs near expiry.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function secret(): Buffer {
  // CLAIM_SIGNING_KEY is required in production. In dev we generate a
  // process-lifetime key on first call so signed claims work locally
  // without operator setup; they just don't survive a restart.
  const env = process.env["CLAIM_SIGNING_KEY"];
  if (env && env.length >= 16) return Buffer.from(env);
  return DEV_KEY;
}
const DEV_KEY = randomBytes(32);

interface ClaimPayload {
  w: string;     // wallet pubkey
  d: string;     // device-fingerprint hash (binds the claim to the device)
  e: number;     // expiry (ms epoch)
  v: 2;          // version
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function issueClaim(wallet: string, deviceHash: string): string {
  const payload: ClaimPayload = { w: wallet, d: deviceHash, e: Date.now() + TOKEN_TTL_MS, v: 2 };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Verify a claim. If `deviceHash` is provided, the claim is rejected
 * unless the embedded device hash matches — prevents claim replay
 * across devices. Pass undefined when the caller doesn't have the
 * binding context (legacy callers, tests).
 */
export function verifyClaim(token: string, deviceHash?: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, sig] = parts as [string, string];
  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(body).digest();
  } catch { return false; }
  let received: Buffer;
  try { received = fromB64url(sig); } catch { return false; }
  if (received.length !== expected.length) return false;
  if (!timingSafeEqual(received, expected)) return false;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as ClaimPayload;
    if (payload.v !== 2) return false;
    if (typeof payload.e !== "number" || payload.e < Date.now()) return false;
    if (deviceHash !== undefined && payload.d !== deviceHash) return false;
    return true;
  } catch { return false; }
}

/** Wallet a verified claim refers to, or null if invalid. */
export function walletFromClaim(token: string): string | null {
  if (!verifyClaim(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const body = parts[0]!;
  try {
    return (JSON.parse(fromB64url(body).toString("utf8")) as ClaimPayload).w;
  } catch { return null; }
}

// ── one-shot nonce store (replay protection) ─────────────────────────────

interface NonceEntry { issuedAt: number; consumed: boolean }
const nonces = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [n, e] of nonces) if (now - e.issuedAt > NONCE_TTL_MS) nonces.delete(n);
}, 60_000).unref?.();

export function mintNonce(): string {
  const n = randomBytes(24).toString("hex");
  nonces.set(n, { issuedAt: Date.now(), consumed: false });
  return n;
}

export function consumeNonce(n: string): boolean {
  const e = nonces.get(n);
  if (!e) return false;
  if (e.consumed) return false;
  if (Date.now() - e.issuedAt > NONCE_TTL_MS) { nonces.delete(n); return false; }
  e.consumed = true;
  return true;
}
