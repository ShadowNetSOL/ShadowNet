import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalSquare, Key, Network, Shield, Menu, X, ChevronRight, BookOpen } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: "/", label: "SYS_INIT", icon: TerminalSquare, exact: true },
  { href: "/sessions", label: "STEALTH_SESS", icon: Shield },
  { href: "/wallet", label: "GEN_WALLET", icon: Key },
  { href: "/relay", label: "RELAY_NET", icon: Network },
  { href: "/docs", label: "DOCS", icon: BookOpen },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background w-full">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-primary/20 bg-background/95 backdrop-blur z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <img 
            src={`${import.meta.env.BASE_URL}images/logo-mark.png`} 
            alt="ShadowNet" 
            className="w-8 h-8 object-contain"
          />
          <span className="font-display font-bold text-lg text-primary text-glow">SHADOWNET</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-primary hover:bg-primary/10 p-2 rounded"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {(isMobileMenuOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={cn(
              "fixed md:sticky top-0 left-0 h-screen w-64 border-r border-primary/20 bg-card z-40 flex flex-col overflow-hidden",
              "md:translate-x-0",
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="p-6 hidden md:flex items-center gap-3 border-b border-primary/20">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo-mark.png`} 
                alt="ShadowNet" 
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]"
              />
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl text-primary text-glow tracking-widest">SHADOWNET</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">v1.0.4_BETA</span>
              </div>
            </div>

            <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = item.exact ? location === item.href : location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <span 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-sm cursor-pointer transition-all duration-200 group relative overflow-hidden",
                        isActive 
                          ? "bg-primary/10 text-primary border-l-2 border-primary box-glow" 
                          : "text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                      )}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="nav-indicator"
                          className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent -z-10"
                        />
                      )}
                      <item.icon className={cn("w-5 h-5", isActive ? "animate-pulse" : "group-hover:text-primary")} />
                      <span className="font-mono text-sm uppercase tracking-wider">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-primary/20 bg-background">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>STATUS:</span>
                <span className="text-primary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow block" />
                  SECURE
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 relative min-w-0">
        {/* Subtle scanline overlay */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
        
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
