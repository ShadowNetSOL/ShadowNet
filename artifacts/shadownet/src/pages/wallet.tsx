import { useState } from "react";
import { useGenerateWallet } from "@workspace/api-client-react";
import type { GeneratedWallet } from "@workspace/api-client-react/src/generated/api.schemas";
import { TerminalBlock, TerminalLine } from "@/components/terminal-block";
import { Key, Eye, EyeOff, Copy, Check, AlertOctagon, Wallet as WalletIcon, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function HiddenField({ value, label, monospace = true }: { value: string, label: string, monospace?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setRevealed(!revealed)} className="hover:text-primary transition-colors flex items-center gap-1">
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? "HIDE" : "REVEAL"}
          </button>
          <button onClick={handleCopy} className="hover:text-primary transition-colors flex items-center gap-1">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      </div>
      <div className={`p-4 rounded-md border border-border bg-black/50 ${monospace ? 'font-mono' : ''} text-sm break-all relative overflow-hidden`}>
        {revealed ? (
          <span className="text-white relative z-10">{value}</span>
        ) : (
          <span className="text-muted-foreground tracking-[0.2em] relative z-10">
            {value.replace(/./g, '•')}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { mutate: generateWallet, isPending } = useGenerateWallet();
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);

  const handleGenerate = () => {
    generateWallet(undefined, {
      onSuccess: (data) => {
        setWallets(prev => [data, ...prev].slice(0, 4)); // Keep history of 4
      }
    });
  };

  const currentWallet = wallets[0];
  const historyWallets = wallets.slice(1);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="border-b border-secondary/20 pb-6 mb-8">
        <h1 className="text-3xl font-display text-white flex items-center gap-3">
          <Key className="text-secondary w-8 h-8" />
          ANONYMOUS WALLET GENERATOR
        </h1>
        <p className="text-muted-foreground font-mono mt-2">
          Generate local Ed25519 Solana keypairs. Keys are completely ephemeral and never logged.
        </p>
      </div>

      <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 justify-between box-glow-secondary">
        <div className="flex items-start gap-4">
          <AlertOctagon className="w-8 h-8 text-secondary shrink-0 mt-1" />
          <div>
            <h3 className="font-display font-bold text-white text-lg mb-1">ZERO RETENTION POLICY</h3>
            <p className="text-sm font-mono text-muted-foreground">
              These keys are generated in volatile memory. If you lose the private key or mnemonic, the wallet is unrecoverable. Save them immediately.
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="shrink-0 px-6 py-4 bg-secondary text-white font-display font-bold text-lg rounded hover:bg-secondary/90 transition-all hover:-translate-y-1 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? "COMPUTING KEYS..." : "GENERATE NEW KEYPAIR"}
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {currentWallet ? (
          <motion.div
            key={currentWallet.publicKey}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <WalletIcon className="w-5 h-5 text-secondary" />
                <h2 className="font-mono text-lg text-white font-bold">Active Generation Payload</h2>
                <span className="ml-auto text-xs text-secondary font-mono border border-secondary/30 px-2 py-1 rounded bg-secondary/10">ED25519_BASE58</span>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    <span>Public Key (Address)</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(currentWallet.publicKey);
                      }} 
                      className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> COPY
                    </button>
                  </div>
                  <div className="p-4 rounded-md border border-border bg-black/50 font-mono text-sm text-primary break-all">
                    {currentWallet.publicKey}
                  </div>
                </div>

                <HiddenField label="Private Key" value={currentWallet.privateKey} />
                
                <HiddenField label="Mnemonic Seed Phrase" value={currentWallet.mnemonic} monospace={false} />

                <div className="text-xs font-mono text-muted-foreground flex gap-4 border-t border-border pt-4">
                  <span>DERIVATION: <span className="text-white">{currentWallet.derivationPath}</span></span>
                  <span>TIMESTAMP: <span className="text-white">{new Date(currentWallet.createdAt).toISOString()}</span></span>
                </div>
              </div>
            </div>

            <TerminalBlock title="import_instructions.md" glowColor="none">
              <TerminalLine delay={0}>To import into Phantom Wallet:</TerminalLine>
              <TerminalLine delay={0.1}>1. Open Phantom browser extension</TerminalLine>
              <TerminalLine delay={0.2}>2. Click the menu icon (top left) → '+' Add / Connect Wallet</TerminalLine>
              <TerminalLine delay={0.3}>3. Select 'Import Private Key'</TerminalLine>
              <TerminalLine delay={0.4}>4. Name your wallet</TerminalLine>
              <TerminalLine delay={0.5}>5. Paste the Base58 <span className="text-secondary">Private Key</span> revealed above</TerminalLine>
              <TerminalLine delay={0.6}>6. Click 'Import'</TerminalLine>
            </TerminalBlock>
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-24 text-center border border-dashed border-border rounded-xl"
          >
            <Key className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-mono text-muted-foreground">No keys generated in current session.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {historyWallets.length > 0 && (
        <div className="pt-12">
          <h3 className="font-mono text-sm text-muted-foreground flex items-center gap-2 mb-4 uppercase tracking-widest">
            <ChevronDown className="w-4 h-4" /> Session History
          </h3>
          <div className="space-y-3">
            {historyWallets.map((w, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-border rounded bg-card/50 font-mono text-xs">
                <span className="text-muted-foreground">{w.publicKey.substring(0, 16)}...</span>
                <span className="text-secondary/50">{new Date(w.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
