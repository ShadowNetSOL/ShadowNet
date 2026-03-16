import { Link } from "wouter";
import { TerminalSquare, AlertTriangle } from "lucide-react";
import { TerminalBlock, TerminalLine } from "@/components/terminal-block";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-6xl font-display text-white text-glow font-bold tracking-tighter">404</h1>
        <h2 className="text-xl font-mono text-muted-foreground uppercase tracking-widest">Sector Not Found</h2>
      </div>

      <div className="w-full max-w-lg">
        <TerminalBlock title="error.log" glowColor="none" className="border-destructive/30">
          <TerminalLine delay={0} className="text-destructive">ERR_CONNECTION_REFUSED: Target sector is unmapped.</TerminalLine>
          <TerminalLine delay={0.2}>Attempting autonomous trace...</TerminalLine>
          <TerminalLine delay={0.6}>Trace failed. Data stream dissolved into the void.</TerminalLine>
          <TerminalLine delay={1.0}>Recommendation: Return to secure perimeter.</TerminalLine>
        </TerminalBlock>
      </div>

      <Link href="/">
        <span className="inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary font-mono hover:bg-primary/10 transition-colors rounded cursor-pointer">
          <TerminalSquare className="w-4 h-4" />
          RETURN TO HOME
        </span>
      </Link>
    </div>
  );
}
