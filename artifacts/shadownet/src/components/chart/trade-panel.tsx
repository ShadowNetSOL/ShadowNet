/**
 * Trade panel — BUY/SELL with Jupiter Ultra via the ShadowNet api-server.
 *
 * Flow (all server-routed so the RPC + Jupiter keys never reach the bundle):
 *   1. fetchQuote()  → server proxies https://api.jup.ag/ultra/v1/order
 *      The server attaches feeAccount + platformFeeBps so Jupiter routes
 *      our 1% (configurable via PLATFORM_FEE_BPS) directly into our fee
 *      account inside the SAME tx — zero post-trade reconciliation.
 *   2. Phantom signs the base64 versioned tx that came back.
 *   3. executeSwap() POST → server proxies Jupiter /execute, which lands
 *      the tx and atomically deposits the platform fee.
 *
 * @solana/web3.js is loaded from a CDN on first mount so we don't have to
 * add it as a real dep (Alice ships it the same way). The IIFE bundle
 * exposes `window.solanaWeb3.VersionedTransaction`.
 */

import { useEffect, useState } from "react";
import { Wallet, Loader2, ExternalLink } from "lucide-react";
import { fetchQuote, executeSwap, fetchSolBalance, fetchTokenBalance, type SwapQuote } from "@/lib/trading-api";
import { useToast } from "@/hooks/use-toast";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const WEB3_CDN = "https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js";

declare global {
  interface Window {
    solanaWeb3?: {
      VersionedTransaction: { deserialize: (b: Uint8Array) => { serialize: () => Uint8Array } };
    };
  }
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signTransaction: <T>(tx: T) => Promise<T>;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { solana?: PhantomProvider; phantom?: { solana?: PhantomProvider } };
  if (w.solana?.isPhantom) return w.solana;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  return null;
}

function ensureWeb3Loaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.solanaWeb3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-sn-web3="1"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("solana web3 cdn load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = WEB3_CDN;
    s.async = true;
    s.dataset.snWeb3 = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("solana web3 cdn load failed"));
    document.head.appendChild(s);
  });
}

function uint8ToBase64(arr: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < arr.byteLength; i++) bin += String.fromCharCode(arr[i]!);
  return btoa(bin);
}
function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface SelectedToken {
  ca: string;
  symbol: string;
  priceUsd: number;
  liquidity: number;
  marketCap: number;
  volume24h: number;
  buys24h: number;
  sells24h: number;
}

type Mode = "buy" | "sell";

interface Props {
  token: SelectedToken | null;
  solPrice: number;
}

export function TradePanel({ token, solPrice }: Props) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [mode, setMode] = useState<Mode>("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [lastSig, setLastSig] = useState<string | null>(null);

  // Reset amount when token changes
  useEffect(() => { setAmount(""); }, [token?.ca]);

  // Refresh SOL balance on connect
  useEffect(() => {
    if (!wallet) return;
    fetchSolBalance(wallet).then(b => setSolBalance(b.balance)).catch(() => { /* non-fatal */ });
  }, [wallet]);

  // Refresh SPL balance when (wallet, token) pair changes
  useEffect(() => {
    if (!wallet || !token?.ca) { setTokenBalance(0); return; }
    fetchTokenBalance({ wallet, mint: token.ca })
      .then(b => { setTokenBalance(b.balance); setTokenDecimals(b.decimals); })
      .catch(() => { setTokenBalance(0); });
  }, [wallet, token?.ca]);

  async function connect() {
    const p = getPhantom();
    if (!p) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
      } else {
        window.open("https://phantom.app/", "_blank");
        toast({ title: "Install Phantom", description: "No Phantom extension detected", variant: "destructive" });
      }
      return;
    }
    try {
      const r = await p.connect();
      setWallet(r.publicKey.toString());
      toast({ title: "Wallet connected", description: `${r.publicKey.toString().slice(0,4)}…${r.publicKey.toString().slice(-4)}` });
    } catch (e) {
      toast({ title: "Connect failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }
  async function disconnect() {
    const p = getPhantom();
    try { await p?.disconnect(); } catch { /* ignore */ }
    setWallet(null); setSolBalance(0); setTokenBalance(0);
  }

  // Output preview — what the user will receive (best-effort estimate based
  // on the displayed pair price; the real number comes from the Jupiter quote
  // at execute time).
  const amountNum = parseFloat(amount) || 0;
  const feeBps = 100; // mirrors PLATFORM_FEE_BPS default; surfaced for clarity
  let outputPreview = "0";
  let outputSym = mode === "buy" ? token?.symbol ?? "TOKEN" : "SOL";
  let rateLine = "-";
  if (token && amountNum > 0) {
    if (mode === "buy" && token.priceUsd > 0) {
      const usdIn = amountNum * solPrice;
      const usdAfterFee = usdIn * (1 - feeBps / 10000);
      const tokensOut = usdAfterFee / token.priceUsd;
      outputPreview = tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 });
      rateLine = `1 SOL ≈ ${(solPrice / token.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}`;
    } else if (mode === "sell" && token.priceUsd > 0 && solPrice > 0) {
      const usdOut = amountNum * token.priceUsd;
      const usdAfterFee = usdOut * (1 - feeBps / 10000);
      const solOut = usdAfterFee / solPrice;
      outputPreview = solOut.toFixed(4);
      rateLine = `1 ${token.symbol} ≈ ${(token.priceUsd / solPrice).toExponential(2)} SOL`;
    }
  }

  async function execute() {
    if (!wallet) { toast({ title: "Connect wallet", variant: "destructive" }); return; }
    if (!token?.ca) { toast({ title: "Select a token", variant: "destructive" }); return; }
    if (!amountNum || amountNum <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }

    setBusy(true);
    try {
      setStatus("Loading wallet bridge…");
      await ensureWeb3Loaded();
      if (!window.solanaWeb3) throw new Error("solana web3 unavailable");

      const phantom = getPhantom();
      if (!phantom) throw new Error("Phantom disappeared");

      // Resolve atomic input amount
      let inputMint: string, outputMint: string, atomicAmount: string;
      if (mode === "buy") {
        inputMint = SOL_MINT;
        outputMint = token.ca;
        atomicAmount = String(Math.floor(amountNum * 1e9));
      } else {
        inputMint = token.ca;
        outputMint = SOL_MINT;
        atomicAmount = String(Math.floor(amountNum * Math.pow(10, tokenDecimals)));
      }

      setStatus("Fetching Jupiter quote…");
      const quote: SwapQuote = await fetchQuote({ inputMint, outputMint, amount: atomicAmount, slippageBps: 100 });
      if (!quote.transaction || !quote.requestId) {
        throw new Error("Jupiter quote returned no transaction");
      }

      setStatus("Confirm in Phantom…");
      const txBytes = base64ToUint8(quote.transaction);
      const tx = window.solanaWeb3.VersionedTransaction.deserialize(txBytes);
      const signed = await phantom.signTransaction(tx);

      setStatus("Submitting on-chain…");
      const result = await executeSwap({
        signedTransaction: uint8ToBase64(signed.serialize()),
        requestId: quote.requestId,
      });

      if (result.signature) {
        setLastSig(result.signature);
        toast({ title: "Swap landed", description: `${result.signature.slice(0,8)}…` });
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        toast({ title: "Swap submitted", description: result.status ?? "see Solscan" });
      }

      // Refresh balances after a successful swap
      fetchSolBalance(wallet).then(b => setSolBalance(b.balance)).catch(() => {});
      if (token.ca) {
        fetchTokenBalance({ wallet, mint: token.ca })
          .then(b => { setTokenBalance(b.balance); setTokenDecimals(b.decimals); })
          .catch(() => {});
      }
      setAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user denied")) {
        toast({ title: "Cancelled", description: "Transaction rejected" });
      } else {
        toast({ title: "Swap failed", description: msg, variant: "destructive" });
      }
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const balLine = mode === "buy"
    ? `Bal: ${solBalance.toFixed(4)} SOL`
    : `Bal: ${tokenBalance > 1e6 ? (tokenBalance/1e6).toFixed(2)+"M" : tokenBalance > 1e3 ? (tokenBalance/1e3).toFixed(2)+"K" : tokenBalance.toFixed(2)} ${token?.symbol ?? ""}`;

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPercents = [25, 50, 75, 100];

  return (
    <div className="flex flex-col gap-3 bg-[#0d0d10] border border-white/8 rounded-md p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono tracking-[0.2em] text-primary uppercase">Execute Trade</div>
        {wallet ? (
          <button onClick={disconnect} className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono tracking-widest text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 rounded hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400 transition-colors">
            <Wallet className="w-3 h-3" />
            {wallet.slice(0,4)}…{wallet.slice(-4)}
            <span className="opacity-50">✕</span>
          </button>
        ) : (
          <button onClick={connect} className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono tracking-widest text-primary border border-primary/40 bg-primary/10 rounded hover:bg-primary/20 transition-colors">
            <Wallet className="w-3 h-3" /> CONNECT
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setMode("buy")}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-md transition-all ${mode === "buy" ? "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)]" : "bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/20 hover:bg-emerald-500/20"}`}>BUY</button>
        <button onClick={() => setMode("sell")}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-md transition-all ${mode === "sell" ? "bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]" : "bg-rose-500/10 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500/20"}`}>SELL</button>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-white/50 mb-1.5">
          <span>You Pay</span>
          <span className="font-mono">{balLine}</span>
        </div>
        <div className="flex items-center bg-[#111116] border border-white/8 rounded-md px-3 py-2.5 focus-within:border-primary">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent border-0 outline-none text-white text-base font-mono font-semibold"
          />
          <span className="text-xs text-white/50 font-semibold">{mode === "buy" ? "SOL" : (token?.symbol ?? "TOKEN")}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {mode === "buy"
          ? quickBuyAmounts.map(a => (
              <button key={a} onClick={() => setAmount(String(a))}
                className="py-1.5 text-[11px] font-semibold text-white/70 bg-amber-500/5 border border-amber-500/15 rounded hover:bg-amber-500/15 hover:text-amber-300 transition-colors">{a}</button>
            ))
          : quickSellPercents.map(p => (
              <button key={p} onClick={() => {
                if (tokenBalance <= 0) { toast({ title: "No balance" }); return; }
                const v = (tokenBalance * p / 100);
                setAmount(v.toFixed(tokenDecimals > 6 ? 2 : tokenDecimals));
              }}
                className="py-1.5 text-[11px] font-semibold text-white/70 bg-amber-500/5 border border-amber-500/15 rounded hover:bg-amber-500/15 hover:text-amber-300 transition-colors">{p === 100 ? "MAX" : `${p}%`}</button>
            ))}
      </div>

      <div className="bg-[#111116] rounded-md px-3 py-2">
        <div className="text-[10px] text-white/50 mb-0.5">You Receive (est.)</div>
        <div className="font-mono text-sm font-semibold">{outputPreview} <span className="text-white/50">{outputSym}</span></div>
      </div>

      <div className="flex flex-col gap-1 text-[11px] font-mono">
        <div className="flex justify-between"><span className="text-white/50">Rate</span><span className="text-white/80">{rateLine}</span></div>
        <div className="flex justify-between"><span className="text-white/50">Slippage</span><span className="text-white/80">1%</span></div>
        <div className="flex justify-between"><span className="text-white/50">Platform Fee</span><span className="text-white/80">{(feeBps/100).toFixed(2)}%</span></div>
        <div className="flex justify-between"><span className="text-white/50">Route</span><span className="text-white/80">Jupiter Ultra</span></div>
      </div>

      <button onClick={execute} disabled={busy || !token || !amountNum}
        className={`relative w-full py-3.5 text-sm font-bold tracking-[0.15em] uppercase rounded-md transition-all overflow-hidden ${
          mode === "buy"
            ? "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 text-black shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:translate-y-[-1px]"
            : "bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 text-white shadow-[0_4px_20px_rgba(244,63,94,0.35)] hover:translate-y-[-1px]"
        } disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0`}>
        {busy ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {status || "Working…"}</span> : `${mode.toUpperCase()} ${token?.symbol ?? "TOKEN"}`}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/40 py-1.5 bg-[#19FB9B]/5 border border-[#19FB9B]/15 rounded">
        <span>Swaps powered by</span>
        <img src="/jupiter-logo.png" alt="Jupiter" className="w-[14px] h-[14px]"
             onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <span className="text-[#19FB9B] font-semibold">Jupiter</span>
      </div>

      {lastSig && (
        <a href={`https://solscan.io/tx/${lastSig}`} target="_blank" rel="noreferrer"
           className="flex items-center justify-center gap-1.5 text-[10px] text-primary hover:text-primary/80 font-mono">
          <ExternalLink className="w-3 h-3" /> Last tx: {lastSig.slice(0,8)}…
        </a>
      )}
    </div>
  );
}
