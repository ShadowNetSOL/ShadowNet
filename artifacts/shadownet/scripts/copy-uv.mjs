/**
 * Copies Ultraviolet's runtime bundle from node_modules into public/uv/ so
 * Vite ships them as static assets. Run automatically before `vite build`
 * and on `pnpm install` via postinstall.
 *
 * No identifying telemetry — this script is the only thing that touches the
 * UV runtime. We do not modify or fingerprint it.
 */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const PUBLIC_UV = resolve(__dirname, "..", "public", "uv");

const UV_FILES = [
  "uv.bundle.js",
  "uv.client.js",
  "uv.handler.js",
  "uv.sw.js",
];

function findUVDist() {
  // Resolve the package's package.json, then point at its dist dir.
  try {
    const pkgPath = require.resolve("@titaniumnetwork-dev/ultraviolet/package.json");
    return join(dirname(pkgPath), "dist");
  } catch (e) {
    return null;
  }
}

function main() {
  const distDir = findUVDist();
  if (!distDir) {
    console.warn("[copy-uv] @titaniumnetwork-dev/ultraviolet not installed yet — skipping.");
    return;
  }

  mkdirSync(PUBLIC_UV, { recursive: true });

  let copied = 0;
  for (const f of UV_FILES) {
    const src = join(distDir, f);
    if (!existsSync(src)) {
      console.warn(`[copy-uv] missing ${f} in ${distDir}`);
      continue;
    }
    copyFileSync(src, join(PUBLIC_UV, f));
    copied++;
  }
  console.log(`[copy-uv] copied ${copied}/${UV_FILES.length} runtime files`);
}

main();
