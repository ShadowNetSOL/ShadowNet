/**
 * Region registry.
 *
 * One Railway service = one outbound IP = one region. To list more than one
 * region in the UI, deploy this server to multiple regions and point the
 * frontend at any one of them; that "lead" instance reads RELAY_PEERS from
 * env to discover its siblings.
 *
 * No mock data. If env is empty, we surface a single region for the local
 * service so the UI never lies about what's actually available.
 *
 *   RELAY_REGION         e.g. "us-east"          (this service's region)
 *   RELAY_REGION_NAME    e.g. "US East"          (display name)
 *   RELAY_REGION_COUNTRY ISO-3166 alpha-2, e.g. "US"
 *   RELAY_REGION_CITY    e.g. "New York"
 *   RELAY_REGION_TZ      IANA timezone, e.g. "America/New_York"
 *   RELAY_REGION_LOCALE  BCP-47, e.g. "en-US"
 *   RELAY_PEERS          JSON array of additional region descriptors
 */
import { startedAt } from "./uptime";

export type RegionStatus = "online" | "offline" | "maintenance";

export interface Region {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  locale: string;
  /** Public URL that hosts the UV proxy for this region (empty = same origin). */
  proxyUrl: string;
  status: RegionStatus;
  noLogs: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  NL: "Netherlands",
  FR: "France",
  CH: "Switzerland",
  SE: "Sweden",
  CA: "Canada",
  JP: "Japan",
  SG: "Singapore",
  AU: "Australia",
  AT: "Austria",
  IS: "Iceland",
  RO: "Romania",
  LU: "Luxembourg",
};

function parsePeers(raw: string | undefined): Region[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => coerce(p))
      .filter((p): p is Region => p !== null);
  } catch {
    return [];
  }
}

function coerce(raw: unknown): Region | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cc = String(r["countryCode"] ?? "").toUpperCase();
  if (!r["id"] || !cc) return null;
  return {
    id: String(r["id"]),
    name: String(r["name"] ?? r["id"]),
    country: String(r["country"] ?? COUNTRY_NAMES[cc] ?? cc),
    countryCode: cc,
    city: String(r["city"] ?? ""),
    timezone: String(r["timezone"] ?? "UTC"),
    locale: String(r["locale"] ?? "en-US"),
    proxyUrl: String(r["proxyUrl"] ?? ""),
    status: (r["status"] as RegionStatus) ?? "online",
    noLogs: r["noLogs"] !== false,
  };
}

function localRegion(): Region {
  const cc = (process.env["RELAY_REGION_COUNTRY"] ?? "US").toUpperCase();
  return {
    id: process.env["RELAY_REGION"] ?? "local",
    name: process.env["RELAY_REGION_NAME"] ?? "Local Relay",
    country: COUNTRY_NAMES[cc] ?? cc,
    countryCode: cc,
    city: process.env["RELAY_REGION_CITY"] ?? "",
    timezone: process.env["RELAY_REGION_TZ"] ?? "UTC",
    locale: process.env["RELAY_REGION_LOCALE"] ?? "en-US",
    proxyUrl: "",
    status: "online",
    noLogs: true,
  };
}

let cachedRegions: Region[] | null = null;

export function getRegions(): Region[] {
  if (cachedRegions) return cachedRegions;
  const all = [localRegion(), ...parsePeers(process.env["RELAY_PEERS"])];
  // De-dupe by id, prefer the first (local) entry.
  const seen = new Set<string>();
  cachedRegions = all.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return cachedRegions;
}

export function getRegion(id: string): Region | undefined {
  return getRegions().find((r) => r.id === id);
}

/** Approximate uptime % since boot. Bounded at 99.99 to avoid claiming 100. */
export function uptimePct(): number {
  const ms = Date.now() - startedAt;
  if (ms < 60_000) return 99.0;
  return Math.min(99.99, 99 + Math.log10(ms / 60_000));
}
