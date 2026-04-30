/**
 * Fingerprint preset bundles.
 *
 * Anti-bot systems don't just check values — they check relationships.
 * UA = Windows + WebGL = Apple M1 + fonts = Linux is an instant flag.
 * So we generate fingerprints as atomic bundles where every surface is
 * already consistent with every other surface.
 *
 * A preset locks together:
 *   userAgent ↔ platform ↔ uaPlatform ↔ webgl{vendor,renderer} ↔ fonts ↔ resolution
 *
 * Region-coherent locale/timezone is layered on top by the session
 * builder; the preset itself is region-agnostic so any preset can run
 * from any region.
 */

import type { SessionFingerprint } from "./sessionStore";

export interface Preset {
  id: string;
  os: "Windows" | "macOS" | "Linux" | "Android" | "iOS";
  device: "desktop" | "mobile";
  userAgent: string;
  platform: string;
  uaPlatform: string;
  webglVendor: string;
  webglRenderer: string;
  fonts: string[];
  resolutions: string[];
  // Realistic CPU / memory profile for this device class. Bound to the
  // preset so presets stay internally consistent; per-session jitter
  // happens client-side via the seeded mulberry32 in the inject hook.
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
}

const WIN_FONTS = ["Arial", "Segoe UI", "Calibri", "Cambria", "Times New Roman", "Consolas", "Tahoma", "Verdana"];
const MAC_FONTS = ["San Francisco", "Helvetica Neue", "Arial", "Menlo", "Georgia", "Courier", "Geneva", "Lucida Grande"];
const LIN_FONTS = ["DejaVu Sans", "Liberation Sans", "Arial", "Ubuntu", "FreeSerif", "Courier 10 Pitch", "Noto Sans"];
const AND_FONTS = ["Roboto", "Noto Sans", "Droid Sans", "Arial", "sans-serif"];
const IOS_FONTS = ["San Francisco", "Helvetica Neue", "Avenir", "Georgia", "Times New Roman"];

export const PRESETS: Preset[] = [
  {
    id: "WIN_DESKTOP_CHROME_NV",
    os: "Windows", device: "desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "Win32", uaPlatform: "Windows",
    webglVendor: "Google Inc. (NVIDIA)",
    webglRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    fonts: WIN_FONTS,
    resolutions: ["1920x1080", "2560x1440", "1366x768"],
    hardwareConcurrency: 12, deviceMemory: 16, maxTouchPoints: 0,
  },
  {
    id: "WIN_DESKTOP_CHROME_INTEL",
    os: "Windows", device: "desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "Win32", uaPlatform: "Windows",
    webglVendor: "Google Inc. (Intel)",
    webglRenderer: "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
    fonts: WIN_FONTS,
    resolutions: ["1920x1080", "1366x768", "1536x864"],
    hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0,
  },
  {
    id: "WIN_DESKTOP_FIREFOX",
    os: "Windows", device: "desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    platform: "Win32", uaPlatform: "Windows",
    webglVendor: "Google Inc. (NVIDIA)",
    webglRenderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    fonts: WIN_FONTS,
    resolutions: ["1920x1080", "2560x1440"],
    hardwareConcurrency: 8, deviceMemory: 16, maxTouchPoints: 0,
  },
  {
    id: "MAC_DESKTOP_CHROME_M2",
    os: "macOS", device: "desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "MacIntel", uaPlatform: "macOS",
    webglVendor: "Apple Inc.",
    webglRenderer: "Apple M2",
    fonts: MAC_FONTS,
    resolutions: ["2560x1600", "1920x1200", "2880x1800"],
    hardwareConcurrency: 10, deviceMemory: 16, maxTouchPoints: 0,
  },
  {
    id: "MAC_DESKTOP_SAFARI",
    os: "macOS", device: "desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    platform: "MacIntel", uaPlatform: "macOS",
    webglVendor: "Apple Inc.",
    webglRenderer: "Apple M1 Pro",
    fonts: MAC_FONTS,
    resolutions: ["2560x1600", "3024x1964"],
    hardwareConcurrency: 10, deviceMemory: 16, maxTouchPoints: 0,
  },
  {
    id: "LINUX_DESKTOP_CHROME",
    os: "Linux", device: "desktop",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "Linux x86_64", uaPlatform: "Linux",
    webglVendor: "Google Inc. (Intel)",
    webglRenderer: "ANGLE (Intel, Mesa Intel(R) UHD Graphics, OpenGL 4.6)",
    fonts: LIN_FONTS,
    resolutions: ["1920x1080", "2560x1440"],
    hardwareConcurrency: 8, deviceMemory: 16, maxTouchPoints: 0,
  },
  {
    id: "ANDROID_MOBILE_CHROME",
    os: "Android", device: "mobile",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    platform: "Linux armv8l", uaPlatform: "Android",
    webglVendor: "Google Inc. (Qualcomm)",
    webglRenderer: "ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)",
    fonts: AND_FONTS,
    resolutions: ["412x915", "393x873"],
    hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 5,
  },
  {
    id: "IOS_MOBILE_SAFARI",
    os: "iOS", device: "mobile",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    platform: "iPhone", uaPlatform: "iOS",
    webglVendor: "Apple Inc.",
    webglRenderer: "Apple GPU",
    fonts: IOS_FONTS,
    resolutions: ["390x844", "430x932"],
    hardwareConcurrency: 6, deviceMemory: 6, maxTouchPoints: 5,
  },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function rand16Hex(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

interface BuildOpts {
  regionId: string;
  locale: string;
  timezone: string;
  /** Force a specific preset (debug / testing). */
  presetId?: string;
  /** "desktop" | "mobile" filter. */
  device?: "desktop" | "mobile";
}

export function buildFingerprint(opts: BuildOpts): SessionFingerprint {
  let pool = PRESETS;
  if (opts.device) pool = pool.filter((p) => p.device === opts.device);
  if (opts.presetId) pool = pool.filter((p) => p.id === opts.presetId);
  if (pool.length === 0) pool = PRESETS;

  const preset = pick(pool);
  const resolution = pick(preset.resolutions);

  return {
    regionId: opts.regionId,
    userAgent: preset.userAgent,
    platform: preset.platform,
    uaPlatform: preset.uaPlatform,
    language: opts.locale,
    languages: [opts.locale, opts.locale.split("-")[0] ?? "en"],
    timezone: opts.timezone,
    screenResolution: resolution,
    colorDepth: 24,
    webglVendor: preset.webglVendor,
    webglRenderer: preset.webglRenderer,
    canvasNoise: rand16Hex(),
    audioNoise: rand16Hex(),
    fonts: preset.fonts,
    hardwareConcurrency: preset.hardwareConcurrency,
    deviceMemory: preset.deviceMemory,
    maxTouchPoints: preset.maxTouchPoints,
  };
}

export function listPresets(): Array<Pick<Preset, "id" | "os" | "device">> {
  return PRESETS.map((p) => ({ id: p.id, os: p.os, device: p.device }));
}
