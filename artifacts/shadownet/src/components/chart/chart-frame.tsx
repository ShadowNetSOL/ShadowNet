import { useState } from "react";

export type ChartProvider = "geckoterminal" | "birdeye" | "dexscreener";

const FALLBACK_LOGO = "/logo.jpg";

function srcFor(provider: ChartProvider, ca: string): string {
  switch (provider) {
    case "geckoterminal":
      return `https://www.geckoterminal.com/solana/pools/${ca}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0`;
    case "birdeye":
      return `https://birdeye.so/tv-widget/${ca}?chain=solana&viewMode=pair&chartInterval=15m&chartType=CANDLE&chartLeftToolbar=show&theme=dark`;
    case "dexscreener":
      return `https://dexscreener.com/solana/${ca}?embed=1&loadChartSettings=0&trades=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
  }
}

interface Props {
  ca: string | null;
}

export function ChartFrame({ ca }: Props) {
  const [provider, setProvider] = useState<ChartProvider>("geckoterminal");

  const providers: { id: ChartProvider; label: string; logo: string }[] = [
    { id: "geckoterminal", label: "GeckoTerminal", logo: "/gecko-logo.png" },
    { id: "birdeye",       label: "Birdeye",       logo: "/birdeye-logo.png" },
    { id: "dexscreener",   label: "DexScreener",   logo: "/dexscreener-logo.png" },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-y border-white/8">
        <div className="flex gap-1 bg-white/3 p-0.5 rounded-md">
          {providers.map(p => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                title={p.label}
                className={`p-1.5 rounded transition-all ${active ? "bg-primary/20 ring-1 ring-primary/50" : "hover:bg-white/5 opacity-50 hover:opacity-90"}`}
              >
                <img
                  src={p.logo}
                  alt={p.label}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO; }}
                  className="w-[18px] h-[18px] object-contain"
                />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {ca && (
            <>
              <a href={`https://dexscreener.com/solana/${ca}`} target="_blank" rel="noreferrer"
                 className="px-2.5 py-1.5 text-[10px] font-mono tracking-wider text-white/50 border border-white/10 rounded hover:text-primary hover:border-primary/60 transition-colors">DEX</a>
              <a href={`https://gmgn.ai/sol/token/${ca}`} target="_blank" rel="noreferrer"
                 className="px-2.5 py-1.5 text-[10px] font-mono tracking-wider text-white/50 border border-white/10 rounded hover:text-primary hover:border-primary/60 transition-colors">GMGN</a>
              <a href={`https://app.bubblemaps.io/sol/token/${ca}`} target="_blank" rel="noreferrer"
                 className="px-2.5 py-1.5 text-[10px] font-mono tracking-wider text-black bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 rounded shadow-[0_0_12px_rgba(245,166,35,0.35)]">Bubble</a>
            </>
          )}
        </div>
      </div>
      <div className="relative w-full bg-gradient-to-b from-[#0a0a12] to-[#06060a] border border-primary/10" style={{ height: 480 }}>
        {ca ? (
          <iframe
            key={`${provider}-${ca}`}
            src={srcFor(provider, ca)}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            allow="clipboard-write"
            allowFullScreen
            style={{ background: "#0a0a0f" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm font-mono tracking-wider">
            SELECT A TOKEN TO VIEW CHART
          </div>
        )}
      </div>
    </div>
  );
}
