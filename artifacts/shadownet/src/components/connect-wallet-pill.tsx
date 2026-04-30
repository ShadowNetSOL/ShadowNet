/**
 * Connect-wallet pill.
 *
 * Sits in the app topbar. Connected = pubkey + tier label. Disconnected
 * = "CONNECT" button that triggers the holder-auth flow (Phantom signs
 * a one-time nonce, server verifies + checks SPL balance via Helius,
 * issues an HMAC claim).
 */
import { useEffect, useState } from "react";
import { Wallet, Loader2, LogOut } from "lucide-react";
import { connectHolder, getClaim, clearClaim, type StoredClaim } from "@/lib/holder-auth";
import { useToast } from "@/hooks/use-toast";

export function ConnectWalletPill() {
  const { toast } = useToast();
  const [claim, setClaim] = useState<StoredClaim | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setClaim(getClaim()); }, []);

  async function connect() {
    setBusy(true);
    try {
      const c = await connectHolder();
      setClaim(c);
      toast({ title: "Holder verified", description: `${c.wallet.slice(0, 4)}…${c.wallet.slice(-4)} · secure tier unlocked` });
    } catch (err) {
      toast({ title: "Connect failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  }
  function disconnect() {
    clearClaim(); setClaim(null);
    toast({ title: "Disconnected" });
  }

  if (claim) {
    const short = `${claim.wallet.slice(0, 4)}…${claim.wallet.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-accent/30 bg-accent/10">
          <Wallet className="w-3 h-3 text-accent" />
          <span className="text-[10px] font-mono text-jade tracking-widest">{short}</span>
          <span className="text-[8px] font-mono text-accent tracking-[0.25em] border-l border-white/15 pl-2 ml-1">HOLDER</span>
        </div>
        <button onClick={disconnect} title="Disconnect" className="text-white/35 hover:text-white/70">
          <LogOut className="w-3 h-3" />
        </button>
      </div>
    );
  }
  return (
    <button onClick={connect} disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 text-jade text-[10px] font-mono tracking-widest disabled:opacity-50 transition-colors">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
      {busy ? "VERIFYING" : "CONNECT"}
    </button>
  );
}
