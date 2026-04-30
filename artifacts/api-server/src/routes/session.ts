/**
 * Session + fingerprint generation.
 *
 * Fingerprints are built from atomic preset bundles where every surface
 * (UA ↔ platform ↔ WebGL ↔ fonts ↔ resolution) is internally consistent.
 * Region-coherent locale/timezone is layered on top: a US relay paired
 * with a Tokyo timezone is the kind of mismatch anti-bot flags instantly.
 *
 * The session's fingerprint is stored server-side keyed by sessionId so
 * the bare-server hook can align outgoing HTTP headers (Accept-Language,
 * sec-ch-ua-platform) with the page-side shim's spoofed surfaces.
 */
import { Router, type IRouter } from "express";
import { GetFingerprintProfileResponse, StartStealthSessionResponse } from "@workspace/api-zod";
import { getRegion, getRegions } from "../lib/regions";
import { putSession, type SessionFingerprint } from "../lib/sessionStore";
import { buildFingerprint, listPresets } from "../lib/fingerprintPresets";

const router: IRouter = Router();

interface BuiltProfile {
  profileId: string;
  fingerprint: SessionFingerprint;
}

function buildProfile(opts: { regionId?: string; presetId?: string; device?: "desktop" | "mobile" }): BuiltProfile {
  const region = (opts.regionId && getRegion(opts.regionId)) || getRegions()[0]!;
  const fingerprint = buildFingerprint({
    regionId: region.id,
    locale: region.locale,
    timezone: region.timezone,
    presetId: opts.presetId,
    device: opts.device,
  });
  const profileId = `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return { profileId, fingerprint };
}

router.get("/session/fingerprint", (req, res) => {
  const regionId = typeof req.query["region"] === "string" ? req.query["region"] : undefined;
  const presetId = typeof req.query["preset"] === "string" ? req.query["preset"] : undefined;
  const device = req.query["device"] === "mobile" ? "mobile" : req.query["device"] === "desktop" ? "desktop" : undefined;
  const { profileId, fingerprint } = buildProfile({ regionId, presetId, device });
  const data = GetFingerprintProfileResponse.parse({
    userAgent: fingerprint.userAgent,
    screenResolution: fingerprint.screenResolution,
    colorDepth: fingerprint.colorDepth,
    timezone: fingerprint.timezone,
    language: fingerprint.language,
    platform: fingerprint.platform,
    webglVendor: fingerprint.webglVendor,
    webglRenderer: fingerprint.webglRenderer,
    canvasHash: fingerprint.canvasNoise,
    audioHash: fingerprint.audioNoise,
    fonts: fingerprint.fonts,
    profileId,
  });
  res.json(data);
});

router.get("/session/presets", (_req, res) => {
  res.json({ presets: listPresets() });
});

router.post("/session/start", (req, res) => {
  const body = (req.body ?? {}) as { relayNodeId?: string; presetId?: string; device?: "desktop" | "mobile" };
  const { profileId, fingerprint } = buildProfile({ regionId: body.relayNodeId, presetId: body.presetId, device: body.device });
  const region = getRegion(fingerprint.regionId)!;
  const sessionId = `sn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  putSession(sessionId, fingerprint, expiresAt.getTime());

  const data = StartStealthSessionResponse.parse({
    sessionId,
    startedAt: now.toISOString(),
    fingerprintProfileId: profileId,
    relayNodeId: region.id,
    maskedIp: `${region.countryCode}-${region.id}`,
    status: "active",
    expiresAt: expiresAt.toISOString(),
  });
  res.json(data);
});

export default router;
