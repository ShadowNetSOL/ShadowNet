/**
 * Stable browser/device fingerprint hash.
 *
 * Used to bind holder-tier claims to the device they were issued on so
 * a leaked claim can't be replayed from another machine. Stored in
 * localStorage on first compute so the hash survives soft reloads
 * (the inputs don't, fully, on every browser).
 *
 * Inputs: a random per-install salt + UA + screen + timezone + a few
 * stable navigator surfaces. SHA-256 hex output.
 *
 * NOT a privacy-defeating identifier — it's per-install, per-browser,
 * regenerated if the user clears storage. The point is binding, not
 * tracking.
 */

const STORAGE_KEY = "sn_device_hash_v1";

export async function deviceHash(): Promise<string> {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && /^[a-f0-9]{64}$/.test(cached)) return cached;
  } catch { /* ignore */ }

  const salt = randomHex(16);
  const inputs = [
    salt,
    navigator.userAgent,
    navigator.language,
    navigator.platform || "",
    String(navigator.hardwareConcurrency || 0),
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  ].join("|");

  const bytes = new TextEncoder().encode(inputs);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem(STORAGE_KEY, hex); } catch { /* ignore */ }
  return hex;
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
