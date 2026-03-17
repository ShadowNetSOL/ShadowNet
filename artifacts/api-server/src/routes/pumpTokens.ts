import { Router } from "express";

const router = Router();

interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
  links?: Array<{ label?: string; type?: string; url: string }>;
}

interface DexPair {
  baseToken?: { address: string; symbol: string; name: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h6?: number; h24?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: { buys: number; sells: number } };
}

router.get("/pump-tokens", async (_req, res) => {
  try {
    const profilesRes = await fetch(
      "https://api.dexscreener.com/token-profiles/latest/v1",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ShadowNet/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!profilesRes.ok) {
      return res.status(502).json({ error: "Dexscreener unavailable", tokens: [] });
    }

    const profiles: TokenProfile[] = await profilesRes.json();

    const pumpProfiles = profiles
      .filter(
        (p) =>
          p.chainId === "solana" &&
          p.tokenAddress &&
          p.tokenAddress.toLowerCase().endsWith("pump")
      )
      .slice(0, 24);

    if (pumpProfiles.length === 0) {
      return res.json({ tokens: [] });
    }

    const addresses = pumpProfiles.map((p) => p.tokenAddress).join(",");
    const pairsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    let pairsMap: Record<string, DexPair> = {};
    if (pairsRes.ok) {
      const pairsData: { pairs?: DexPair[] } = await pairsRes.json();
      for (const pair of pairsData.pairs ?? []) {
        const addr = pair.baseToken?.address;
        if (addr && !pairsMap[addr]) pairsMap[addr] = pair;
      }
    }

    const tokens = pumpProfiles.map((profile) => {
      const pair = pairsMap[profile.tokenAddress];
      const twitter = profile.links?.find(
        (l) => l.type === "twitter" || l.label?.toLowerCase() === "twitter"
      );
      const website = profile.links?.find(
        (l) => l.label?.toLowerCase() === "website" || l.type === "website"
      );
      return {
        address: profile.tokenAddress,
        symbol: pair?.baseToken?.symbol ?? "???",
        name: pair?.baseToken?.name ?? profile.description?.split(" ").slice(0, 3).join(" ") ?? "Unknown",
        icon: profile.icon ?? null,
        description: profile.description ?? null,
        priceUsd: pair?.priceUsd ? parseFloat(pair.priceUsd) : null,
        priceChange1h: pair?.priceChange?.h1 ?? null,
        priceChange24h: pair?.priceChange?.h24 ?? null,
        marketCap: pair?.fdv ?? pair?.marketCap ?? null,
        volume24h: pair?.volume?.h24 ?? null,
        liquidity: pair?.liquidity?.usd ?? null,
        buys24h: pair?.txns?.h24?.buys ?? null,
        sells24h: pair?.txns?.h24?.sells ?? null,
        pumpUrl: `https://pump.fun/coin/${profile.tokenAddress}`,
        dexUrl: profile.url,
        twitter: twitter?.url ?? null,
        website: website?.url ?? null,
      };
    });

    res.json({ tokens, fetchedAt: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: msg, tokens: [] });
  }
});

export default router;
