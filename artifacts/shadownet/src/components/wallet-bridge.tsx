/**
 * Wallet bridge overlay.
 *
 * Listens for `wallet-rpc` postMessages from any proxied tab the user
 * opened from this shell (the UV inject hook posts via window.opener,
 * window.parent, *and* a BroadcastChannel — we accept all three). When a
 * request lands, we show a full-screen overlay so the user knows a
 * signing prompt is active on their phone, then forward the call to the
 * WalletConnect v2 client.
 *
 * This component is intentionally renderless until a request is pending.
 * It mounts at the app root so it's always listening, regardless of
 * which page the user is on.
 *
 * Note on the WalletConnect side: the actual WC v2 client init is
 * gated by a real projectId and key. Until that's wired, we surface a
 * clear "wallet bridge offline" message and reject the rpc; the proxied
 * dApp gets a rejection it can handle. Better than a silent timeout.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, X, AlertTriangle, AlertCircle } from "lucide-react";
import { decodeTransaction, type DecodedPreview } from "@/lib/wallet-decode";

interface RpcRequest {
  id: string;
  method: string;
  params: unknown;
  origin?: string;
  receivedFrom: "opener" | "parent" | "broadcast";
  source: MessageEventSource | null;
}

const METHOD_LABELS: Record<string, string> = {
  connect: "Connect Wallet",
  disconnect: "Disconnect Wallet",
  signMessage: "Sign Message",
  signTransaction: "Sign Transaction",
  signAllTransactions: "Sign Multiple Transactions",
  signAndSendTransaction: "Sign & Send Transaction",
  request: "Wallet Request",
};

export function WalletBridge() {
  const [pending, setPending] = useState<RpcRequest | null>(null);
  const [bridgeOnline] = useState<boolean>(() => {
    // Becomes true once a real WalletConnect provider is wired. The env
    // var is read at build time; null means "no project id, bridge off".
    return Boolean(import.meta.env["VITE_WC_PROJECT_ID"]);
  });

  useEffect(() => {
    const bcast = (() => {
      try { return new BroadcastChannel("shadownet-wallet"); } catch { return null; }
    })();

    function reply(req: RpcRequest, payload: { result?: unknown; error?: string }) {
      const msg = { __shadownet: true, kind: "wallet-rpc-reply", id: req.id, ...payload };
      // Reply on every channel — the proxied tab listens on all three
      // and dedupes by id, so multiple deliveries are harmless.
      try { (req.source as Window | null)?.postMessage(msg, { targetOrigin: "*" } as WindowPostMessageOptions); } catch {}
      try { bcast?.postMessage(msg); } catch {}
    }

    function handle(ev: MessageEvent, kind: RpcRequest["receivedFrom"]) {
      const d = ev.data as { __shadownet?: boolean; kind?: string; id?: string; method?: string; params?: unknown; origin?: string };
      if (!d || d.__shadownet !== true || d.kind !== "wallet-rpc") return;
      if (!d.id || !d.method) return;
      const req: RpcRequest = {
        id: d.id, method: d.method, params: d.params, origin: d.origin,
        receivedFrom: kind,
        source: ev.source,
      };
      // If a request is already pending, reject the new one immediately —
      // the in-tab shim's single-flight queue should prevent this, but
      // belt-and-braces.
      if (pending) {
        reply(req, { error: "Another wallet request is already pending" });
        return;
      }
      setPending(req);
    }

    const onMessage = (ev: MessageEvent) => handle(ev, "parent");
    const onBcast = (ev: MessageEvent) => handle(ev, "broadcast");
    window.addEventListener("message", onMessage);
    bcast?.addEventListener("message", onBcast);

    return () => {
      window.removeEventListener("message", onMessage);
      bcast?.removeEventListener("message", onBcast);
      bcast?.close();
    };
  }, [pending]);

  function reject(reason: string) {
    if (!pending) return;
    const msg = { __shadownet: true, kind: "wallet-rpc-reply", id: pending.id, error: reason };
    try { (pending.source as Window | null)?.postMessage(msg, { targetOrigin: "*" } as WindowPostMessageOptions); } catch {}
    try { new BroadcastChannel("shadownet-wallet").postMessage(msg); } catch {}
    setPending(null);
  }

  // Decode the transaction (or transactions) inside the request so the
  // user sees what they're about to sign before tapping approve. Pure
  // client-side parser; never makes network calls.
  const preview = useMemo<DecodedPreview | DecodedPreview[] | null>(() => {
    if (!pending) return null;
    const p = pending.params as { transaction?: number[]; transactions?: number[][] } | undefined;
    if (!p) return null;
    if (p.transaction && Array.isArray(p.transaction)) {
      return decodeTransaction(p.transaction);
    }
    if (p.transactions && Array.isArray(p.transactions)) {
      return p.transactions.map((t) => decodeTransaction(t));
    }
    return null;
  }, [pending]);

  if (!pending) return null;

  const label = METHOD_LABELS[pending.method] ?? pending.method;
  const originHost = (() => {
    try { return pending.origin ? new URL(pending.origin).host : "unknown site"; } catch { return "unknown site"; }
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 space-y-5"
          style={{ boxShadow: "0 0 60px rgba(111,175,155,0.2)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Wallet Request</p>
              <p className="text-sm font-mono text-white">{label}</p>
            </div>
          </div>
          <div className="text-xs font-mono text-white/50">
            <span className="text-white/30">from</span> <span className="text-primary">{originHost}</span>
          </div>

          {preview && <TxPreview preview={preview} />}

          {!bridgeOnline ? (
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono uppercase tracking-widest">
                <AlertTriangle className="w-3.5 h-3.5" /> Bridge offline
              </div>
              <p className="text-[11px] font-mono text-white/50 leading-relaxed">
                The WalletConnect bridge isn't configured on this deployment yet.
                Set <code className="text-primary">VITE_WC_PROJECT_ID</code> at build time to enable
                signing on proxied dApps. Until then, this request will be rejected so the site
                falls back gracefully instead of hanging.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-mono text-primary tracking-widest uppercase">Approve on your phone</p>
              <p className="text-[11px] font-mono text-white/50 leading-relaxed">
                Open Phantom or Solflare on your mobile device. The signing prompt
                should appear within a few seconds. Don't close this window.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Waiting for wallet approval…
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => reject(bridgeOnline ? "User rejected the request" : "Wallet bridge not available")}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 text-xs font-mono tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-3.5 h-3.5" /> CANCEL
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TxPreview({ preview }: { preview: DecodedPreview | DecodedPreview[] }) {
  const list = Array.isArray(preview) ? preview : [preview];
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 divide-y divide-white/5 max-h-72 overflow-y-auto">
      {list.map((p, idx) => (
        <div key={idx} className="p-3 space-y-2">
          {list.length > 1 && (
            <p className="text-[9px] font-mono text-white/30 tracking-widest uppercase">
              Tx {idx + 1} / {list.length}
            </p>
          )}
          {!p.ok ? (
            <p className="text-[11px] font-mono text-yellow-400/80 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Couldn't decode transaction — verify in your wallet before approving.
            </p>
          ) : (
            <>
              {p.solOut !== undefined && (
                <div className="rounded-md bg-yellow-400/10 border border-yellow-400/25 px-2.5 py-1.5">
                  <p className="text-[10px] font-mono text-yellow-300/90 tracking-widest uppercase">SOL outflow</p>
                  <p className="text-sm font-mono text-yellow-200">{p.solOut.toFixed(6)} SOL</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {p.instructions.map((ix, i) => (
                  <li key={i} className="text-[11px] font-mono">
                    <div className="flex items-baseline gap-2">
                      <span className="text-primary">{p.instructions.length > 1 ? `${i + 1}.` : "›"}</span>
                      <span className="text-white/85">{ix.program}</span>
                    </div>
                    {ix.hint && <p className="text-white/55 pl-4">{ix.hint}</p>}
                    {ix.warn && (
                      <p className="text-yellow-300/80 pl-4 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> <span>{ix.warn}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {p.flags.length > 0 && (
                <ul className="space-y-1 pt-2 border-t border-white/5">
                  {p.flags.map((f, i) => (
                    <li key={i} className={`text-[10px] font-mono flex items-start gap-1.5 ${
                      f.level === "warn" ? "text-yellow-300/85" : "text-white/55"
                    }`}>
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{f.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
