import { Router, type IRouter } from "express";
import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import bs58 from "bs58";
import { GenerateWalletResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/wallet/generate", (_req, res) => {
  const mnemonic = bip39.generateMnemonic(128);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivationPath = "m/44'/501'/0'/0'";
  const derived = derivePath(derivationPath, seed.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);

  const publicKey = keypair.publicKey.toBase58();
  const privateKeyBytes = keypair.secretKey.slice(0, 32);
  const privateKey = bs58.encode(privateKeyBytes);

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
