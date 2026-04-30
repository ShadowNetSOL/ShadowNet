/**
 * Stall report + mid-session escalation bridge.
 *
 * Renderless. Listens for stall verdicts from proxied tabs, posts them
 * to /api/session/stall-report (feeds the orchestrator's host history),
 * and — if the user is a holder and the stall came with a state
 * snapshot — offers a one-click escalation that replays cookies +
 * localStorage into a fresh remote-browser session. The destination
 * doesn't see a clean-slate retry (which would re-trigger the same
 * Cloudflare challenge), it sees a "logged-in user reloading".
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getClaim } from "@/lib/holder-auth";

interface StallReport {
  __shadownet?: boolean;
  kind?: string;
  host?: string;
  verdict?: string;
  longTaskMs?: number;
  retried?: boolean;
  state?: {
    url: string;
    cookies: string;
    localStorage: Record<string, string>;
  };
}

export function StallListener() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, setLast] = useState<{ host: string; at: number } | null>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string) || "/";
    const seen = new Set<string>();

    async function escalate(state: NonNullable<StallReport["state"]>) {
      try {
        const res = await fetch(`${base}api/session/orchestrate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: state.url,
            entitlement: "holder",
            holderClaim: getClaim()?.claim,
            seedState: state, // pool replays cookies + localStorage
            precheck: { challenge: "soft_block", confidence: 0.9 },
          }),
        });
        const data = (await res.json()) as { type?: string; available?: boolean; sessionId?: string };
        if (data.type === "remote" && data.available && data.sessionId) {
          setLocation(`/app/remote?id=${encodeURIComponent(data.sessionId)}`);
        } else {
          toast({
            title: "Couldn't open secure session",
            description: "Pool unavailable — try again in a moment.",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Escalation failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    }

    function handle(d: StallReport) {
      if (!d || d.__shadownet !== true || d.kind !== "stall-report") return;
      if (!d.host || !d.verdict) return;
      const key = `${d.host}::${d.verdict}::${Math.floor(Date.now() / 5000)}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Always feed the orchestrator's host history, regardless of tier.
      try {
        void fetch(`${base}api/session/stall-report`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ host: d.host, verdict: d.verdict, longTaskMs: d.longTaskMs, retried: d.retried }),
          keepalive: true,
        });
      } catch { /* ignore */ }

      if (d.verdict === "ok") return;

      const claim = getClaim();
      const userIsHolder = !!claim;
      const hasState = !!(d.state && d.state.url);

      // Suppress repeated prompts on the same host within a short window.
      setLast((prev) => {
        if (prev && prev.host === d.host && Date.now() - prev.at < 30_000) return prev;
        // Show the escalation toast.
        if (userIsHolder && hasState) {
          toast({
            title: `${d.host} stalled — open in secure mode?`,
            description: "We'll replay your cookies + storage into a real Chromium so you don't lose your session.",
            action: (
              <ToastAction
                altText="Open in secure session"
                onClick={() => { void escalate(d.state!); }}
              >
                ESCALATE
              </ToastAction>
            ),
          });
        } else if (!userIsHolder) {
          toast({
            title: `${d.host} stalled`,
            description: "Standard session is blocked. Connect a holder wallet to open in secure mode.",
          });
        }
        return { host: d.host!, at: Date.now() };
      });
    }

    const onMsg = (ev: MessageEvent) => handle(ev.data as StallReport);
    const bcast = (() => { try { return new BroadcastChannel("shadownet-stall"); } catch { return null; } })();
    window.addEventListener("message", onMsg);
    bcast?.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      bcast?.removeEventListener("message", onMsg);
      bcast?.close();
    };
  }, [setLocation, toast]);

  return null;
}
