/**
 * Holder-tier auth.
 *
 *   GET  /auth/challenge          → { nonce, message, expiresInSec }
 *   POST /auth/verify-holder      → { ok: true, claim, expiresAt } or { ok: false, reason }
 *
 * Flow: frontend gets a nonce, asks the user's wallet to signMessage,
 * posts the signature. We verify ed25519 against the claimed pubkey,
 * confirm SPL token balance via Helius, then HMAC-sign a claim token
 * the orchestrator can validate without further RPC calls.
 */
import { Router, type IRouter } from "express";
import { mintNonce, consumeNonce, issueClaim } from "../lib/holderClaim";
import { verifyHolder, isEntitlementConfigured } from "../lib/entitlement";
import { bump } from "../lib/metrics";
import * as ed from "@noble/ed25519";

const router: IRouter = Router();

// Decode base58 (Phantom returns the public key + signature this way).
const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fromBase58(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (let i = 0; i < s.length; i++) {
    const v = ALPH.indexOf(s[i]!);
    if (v < 0) return new Uint8Array(0);
    let c = v;
    for (let j = 0; j < bytes.length; j++) { c += bytes[j]! * 58; bytes[j] = c & 0xff; c >>= 8; }
    while (c) { bytes.push(c & 0xff); c >>= 8; }
  }
  for (let k = 0; k < s.length && s[k] === "1"; k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

function challengeMessage(nonce: string): string {
  return `Sign in to ShadowNet\n\nThis signature proves wallet ownership and is one-time use.\n\nnonce: ${nonce}`;
}

router.get("/auth/challenge", (_req, res) => {
  const nonce = mintNonce();
  res.json({ nonce, message: challengeMessage(nonce), expiresInSec: 300 });
});

interface VerifyBody {
  wallet?: string;
  nonce?: string;
  signature?: string;   // base58
  deviceHash?: string;  // SHA-256 hex of stable browser/device fingerprint
}

router.post("/auth/verify-holder", async (req, res) => {
  const { wallet, nonce, signature, deviceHash } = (req.body ?? {}) as VerifyBody;
  if (!wallet || !nonce || !signature || !deviceHash) {
    res.status(400).json({ ok: false, reason: "missing_fields" }); return;
  }
  if (!/^[a-f0-9]{32,128}$/i.test(deviceHash)) {
    res.status(400).json({ ok: false, reason: "bad_device_hash" }); return;
  }
  if (!consumeNonce(nonce)) {
    res.status(400).json({ ok: false, reason: "bad_nonce" }); return;
  }

  const pubkey = fromBase58(wallet);
  const sig = fromBase58(signature);
  if (pubkey.length !== 32 || sig.length !== 64) {
    res.status(400).json({ ok: false, reason: "malformed" }); return;
  }
  const msg = new TextEncoder().encode(challengeMessage(nonce));
  let valid = false;
  try { valid = await ed.verifyAsync(sig, msg, pubkey); } catch { valid = false; }
  if (!valid) { res.status(401).json({ ok: false, reason: "bad_signature" }); return; }

  if (!isEntitlementConfigured()) {
    res.status(503).json({ ok: false, reason: "entitlement_not_configured" }); return;
  }
  const ok = await verifyHolder(wallet);
  if (!ok) { res.status(403).json({ ok: false, reason: "insufficient_balance" }); return; }

  const claim = issueClaim(wallet, deviceHash);
  bump("holder_claims_issued");
  res.json({ ok: true, claim, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
});

export default router;
