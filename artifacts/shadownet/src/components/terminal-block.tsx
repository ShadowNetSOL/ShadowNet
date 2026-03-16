import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Copy, Check } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TerminalBlockProps {
  title?: string;
  children: React.ReactNode;
  allowCopy?: string;
  className?: string;
  glowColor?: "primary" | "secondary" | "none";
}

export function TerminalBlock({ title = "tty1", children, allowCopy, className, glowColor = "primary" }: TerminalBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (allowCopy) {
      navigator.clipboard.writeText(allowCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const glowClass = glowColor === "primary" ? "border-primary/30 box-glow" : 
                    glowColor === "secondary" ? "border-secondary/30 box-glow-secondary" : 
                    "border-border";

  return (
    <div className={cn("rounded-md overflow-hidden border bg-black/80 backdrop-blur font-mono text-sm", glowClass, className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-inherit">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span className="uppercase text-xs tracking-wider">{title}</span>
        </div>
        {allowCopy && (
          <button 
            onClick={handleCopy}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs"
          >
            {copied ? <><Check className="w-3 h-3 text-primary"/> COPIED</> : <><Copy className="w-3 h-3"/> COPY</>}
          </button>
        )}
      </div>
      <div className="p-4 overflow-x-auto text-muted-foreground selection:bg-primary/30 selection:text-primary">
        {children}
      </div>
    </div>
  );
}

export function TerminalLine({ children, delay = 0, className }: { children: React.ReactNode, delay?: number, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay }}
      className={cn("flex items-start gap-3 py-0.5", className)}
    >
      <span className="text-primary/50 select-none opacity-50">{'>'}</span>
      <div className="flex-1 break-words">{children}</div>
    </motion.div>
  );
}
