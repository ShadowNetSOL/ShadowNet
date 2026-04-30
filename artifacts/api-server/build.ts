import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile, cp, mkdir, stat } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times without risking some
// packages that are not bundle compatible
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("building server...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "index.mjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    // Banner injects createRequire so any CJS-only dep (e.g. drizzle internals)
    // that calls require() inside the ESM bundle keeps working.
    banner: {
      js: "import { createRequire as __cR } from 'node:module';const require=__cR(import.meta.url);",
    },
    logLevel: "info",
  });

  // Copy the built frontend (Vite output) next to the bundled server so the
  // single Railway service can serve both API and SPA from the same origin.
  // Path: artifacts/api-server/dist/public/* <- artifacts/shadownet/dist/public/*
  const frontendDist = path.resolve(__dirname, "..", "shadownet", "dist", "public");
  const targetPublic = path.resolve(distDir, "public");
  try {
    await stat(frontendDist);
    await mkdir(targetPublic, { recursive: true });
    await cp(frontendDist, targetPublic, { recursive: true });
    console.log(`[api-server] copied frontend dist -> ${targetPublic}`);
  } catch {
    console.warn(
      `[api-server] frontend dist not found at ${frontendDist}; build the shadownet artifact first`,
    );
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
