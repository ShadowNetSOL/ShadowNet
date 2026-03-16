import { Router, type IRouter } from "express";
import { GetFingerprintProfileResponse, StartStealthSessionResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
];

const RESOLUTIONS = ["1920x1080", "2560x1440", "1366x768", "1440x900", "1280x800", "1680x1050", "3840x2160", "1920x1200"];
const TIMEZONES = ["America/New_York", "Europe/London", "Asia/Tokyo", "Europe/Berlin", "America/Los_Angeles", "Asia/Singapore", "Europe/Paris", "America/Chicago"];
const LANGUAGES = ["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "es-ES", "zh-CN", "pt-BR"];
const PLATFORMS = ["Win32", "MacIntel", "Linux x86_64", "Linux aarch64"];
const WEBGL_VENDORS = ["Google Inc. (NVIDIA)", "Google Inc. (AMD)", "Intel Inc.", "Apple Inc.", "Google Inc. (Intel)"];
const WEBGL_RENDERERS = [
  "ANGLE (NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)",
  "Intel(R) Iris(R) Xe Graphics (0x000046A6)",
  "Apple M2",
  "ANGLE (NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)",
];
const FONT_POOLS = [
  ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana", "Trebuchet MS"],
  ["Arial", "Segoe UI", "Calibri", "Cambria", "Times New Roman", "Consolas", "Tahoma"],
  ["San Francisco", "Helvetica Neue", "Arial", "Menlo", "Georgia", "Courier", "Geneva"],
  ["Ubuntu", "Liberation Sans", "DejaVu Sans", "FreeSerif", "Courier 10 Pitch", "Arial"],
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomHash(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

router.get("/session/fingerprint", (_req, res) => {
  const profileId = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const data = GetFingerprintProfileResponse.parse({
    userAgent: randomFrom(USER_AGENTS),
    screenResolution: randomFrom(RESOLUTIONS),
    colorDepth: randomFrom([24, 30, 48]),
    timezone: randomFrom(TIMEZONES),
    language: randomFrom(LANGUAGES),
    platform: randomFrom(PLATFORMS),
    webglVendor: randomFrom(WEBGL_VENDORS),
    webglRenderer: randomFrom(WEBGL_RENDERERS),
    canvasHash: randomHash(),
    audioHash: randomHash(),
    fonts: randomFrom(FONT_POOLS),
    profileId,
  });
  res.json(data);
});

router.post("/session/start", (req, res) => {
  const { relayNodeId, fingerprintProfileId } = req.body ?? {};
  const sessionId = `sn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const maskedOctets = [
    Math.floor(Math.random() * 200) + 10,
    Math.floor(Math.random() * 254) + 1,
    Math.floor(Math.random() * 254) + 1,
    Math.floor(Math.random() * 254) + 1,
  ];

  const data = StartStealthSessionResponse.parse({
    sessionId,
    startedAt: now.toISOString(),
    fingerprintProfileId: fingerprintProfileId ?? `fp_${Math.random().toString(36).slice(2, 10)}`,
    relayNodeId: relayNodeId ?? undefined,
    maskedIp: maskedOctets.join("."),
    status: "active",
    expiresAt: expiresAt.toISOString(),
  });

  res.json(data);
});

export default router;
