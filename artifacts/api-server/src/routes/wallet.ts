import { Router, type IRouter } from "express";
import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import bs58pkg from "bs58";
import { GenerateWalletResponse } from "@workspace/api-zod";

// bs58 v6 is pure ESM; when bundled as CJS the default export gets double-wrapped.
// This shim resolves encode correctly in both dev (ESM) and prod (CJS bundle).
const bs58encode: (data: Uint8Array) => string =
  typeof (bs58pkg as any).encode === "function"
    ? (bs58pkg as any).encode
    : (bs58pkg as any).default.encode;

const router: IRouter = Router();

router.post("/wallet/generate", (_req, res) => {
  const mnemonic = bip39.generateMnemonic(128);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivationPath = "m/44'/501'/0'/0'";
  const derived = derivePath(derivationPath, seed.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);

  const publicKey = keypair.publicKey.toBase58();
  const privateKey = bs58encode(keypair.secretKey);

  const data = GenerateWalletResponse.parse({
    publicKey,
    privateKey,
    mnemonic,
    derivationPath,
    createdAt: new Date().toISOString(),
  });

  res.json(data);
});

export default router;
