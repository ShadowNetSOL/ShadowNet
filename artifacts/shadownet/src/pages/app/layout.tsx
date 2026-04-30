import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, Key, LayoutDashboard, Radar, CandlestickChart, LineChart } from "lucide-react";
import { ConnectWalletPill } from "@/components/connect-wallet-pill";

const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const tabs = [
  { href: "/app/dashboard", label: "DASH", icon: LayoutDashboard },
  { href: "/app/trading", label: "DISCOVER", icon: CandlestickChart },
  { href: "/app/chart", label: "CHART", icon: LineChart },
  { href: "/app/sessions", label: "STEALTH", icon: Shield },
  { href: "/app/wallet", label: "WALLET", icon: Key },
  { href: "/app/intel", label: "INTEL", icon: Radar },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* TopBar */}
      <header className="shrink-0 flex items-center justify-between px-5 md:px-8 h-14 border-b border-white/6 bg-black/60 backdrop-blur z-30">
        <Link href="/">
          <span className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.jpg" alt="ShadowNet" className="w-6 h-6 rounded-sm object-cover ring-1 ring-primary/40" />
            <span className="text-xs font-mono font-bold text-primary tracking-widest">SHADOWNET<span className="text-white/30">_</span></span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ConnectWalletPill />
          <Link href="/docs">
            <span className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors cursor-pointer tracking-widest hidden sm:block">DOCS</span>
          </Link>
          <a href="https://x.com/shadownetsol?s=21" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
            <XLogo className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>

      {/* BottomNav */}
      <nav className="shrink-0 fixed bottom-0 left-0 right-0 z-30 flex border-t border-white/6 bg-black/90 backdrop-blur">
        {tabs.map(tab => {
          const isActive = location === tab.href || location.startsWith(tab.href + "/");
          return (
            <Link key={tab.href} href={tab.href}>
              <span className={`flex-1 flex flex-col items-center justify-center py-3 px-2 cursor-pointer transition-colors min-w-[80px] ${isActive ? "text-primary" : "text-white/30 hover:text-white/60"}`}>
                <tab.icon className={`w-5 h-5 mb-1 ${isActive ? "" : ""}`} />
                <span className={`text-[9px] font-mono tracking-widest ${isActive ? "text-primary" : ""}`}>{tab.label}</span>
                {isActive && <span className="absolute bottom-0 w-8 h-px bg-primary" />}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
