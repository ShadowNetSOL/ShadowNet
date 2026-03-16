import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, Key, Network, LayoutDashboard, Twitter, Radar } from "lucide-react";

const tabs = [
  { href: "/app/dashboard", label: "DASH", icon: LayoutDashboard },
  { href: "/app/sessions", label: "STEALTH", icon: Shield },
  { href: "/app/wallet", label: "WALLET", icon: Key },
  { href: "/app/relay", label: "RELAY", icon: Network },
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
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="text-xs font-mono font-bold text-primary tracking-widest">SHADOWNET</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs">
            <span className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors cursor-pointer tracking-widest hidden sm:block">DOCS</span>
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/35">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            SECURE
          </div>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
            <Twitter className="w-3.5 h-3.5" />
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
