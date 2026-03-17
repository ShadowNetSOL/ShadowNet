import { useState } from "react";
import { useGenerateWallet } from "@workspace/api-client-react";
import type { GeneratedWallet } from "@workspace/api-client-react/src/generated/api.schemas";
import { Key, Eye, EyeOff, Copy, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function CopyField({ label, value, hidden = false }: { label: string; value: string; hidden?: boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-white/30 uppercase tracking-widest">
        <span>{label}</span>
        <div className="flex items-center gap-3">
          {hidden && (
            <button onClick={() => setShow(!show)} className="flex items-center gap-1 hover:text-white transition-colors">
              {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {show ? "HIDE" : "REVEAL"}
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1 hover:text-primary transition-colors">
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      </div>
      <div className="p-3.5 rounded-lg border border-white/8 bg-black font-mono text-xs text-white/70 break-all min-h-[44px] flex items-center">
        {hidden && !show ? <span className="tracking-[0.2em] text-white/25">{value.replace(/./g, "•")}</span> : <span>{value}</span>}
      </div>
    </div>
  );
}

export default function AppWallet() {
  const { mutate: generateWallet, isPending } = useGenerateWallet();
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const current = wallets[0];
  const history = wallets.slice(1);

  const handleGenerate = () => {
    generateWallet(undefined, {
      onSuccess: data => {
        setWallets(p => [data, ...p].slice(0, 4));
        try { localStorage.setItem("sn_wallets", String((parseInt(localStorage.getItem("sn_wallets") ?? "0", 10)) + 1)); } catch {}
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-mono font-bold text-white mb-1">Wallet Generator</h1>
        <p className="text-xs font-mono text-white/35">Anonymous Ed25519 Solana keypairs. Zero retention.</p>
      </div>

      {/* Warning + Generate */}
      <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex gap-3 items-start">
          <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono font-bold text-white mb-1">ZERO RETENTION POLICY</p>
            <p className="text-[11px] font-mono text-white/35 leading-relaxed">Keys generated in volatile memory. Never stored. Save immediately.</p>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={isPending}
          className="shrink-0 px-5 py-3 bg-purple-500 text-white font-mono font-bold text-xs rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50 tracking-widest whitespace-nowrap"
          style={{ boxShadow: "0 0 20px rgba(139,92,246,0.25)" }}>
          {isPending ? "COMPUTING…" : "GENERATE KEYPAIR"}
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {current ? (
          <motion.div key={current.publicKey} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl border border-white/8 bg-white/[0.02] space-y-5">
            <div className="flex items-center justify-between border-b border-white/6 pb-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                <Key className="w-4 h-4 text-purple-400" />
                Active Generation Payload
              </div>
              <span className="text-[10px] font-mono text-purple-400 border border-purple-500/25 px-2 py-1 rounded bg-purple-500/8">ED25519_BASE58</span>
            </div>
            <CopyField label="Public Key (Address)" value={current.publicKey} />
            <CopyField label="Private Key" value={current.privateKey} hidden />
            <CopyField label="Mnemonic Seed Phrase" value={current.mnemonic} hidden />
            <div className="flex flex-wrap gap-4 text-[10px] font-mono text-white/25 border-t border-white/6 pt-4">
              <span>PATH: <span className="text-white/50">{current.derivationPath}</span></span>
              <span>GENERATED: <span className="text-white/50">{new Date(current.createdAt).toISOString()}</span></span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="py-20 flex flex-col items-center justify-center border border-dashed border-white/8 rounded-xl">
            <Key className="w-8 h-8 text-white/15 mb-3" />
            <p className="text-xs font-mono text-white/25">No keys generated in current session.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import instructions */}
      {current && (
        <div className="p-5 rounded-xl border border-white/6 bg-black/40 space-y-3">
          <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">How to import into Phantom</p>
          {["Open Phantom browser extension","Click avatar → Add/Connect Wallet → Import Private Key","Paste the Base58 Private Key revealed above","Click Import — done."].map((step, i) => (
            <div key={i} className="flex gap-3 text-xs font-mono text-white/40">
              <span className="text-primary/50 shrink-0">{i+1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-3">Session History</p>
          <div className="space-y-2">
            {history.map((w, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-white/6 rounded-lg text-[10px] font-mono">
                <span className="text-white/30">{w.publicKey.slice(0,20)}…</span>
                <span className="text-white/20">{new Date(w.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
