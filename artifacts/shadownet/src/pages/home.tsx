import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Key, Network, ChevronRight, Activity, Globe, Cpu } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

const features = [
  {
    id: "stealth",
    title: "Stealth Sessions",
    description: "Launch sandboxed browsing environments with aggressive fingerprint randomization and integrated IP cloaking.",
    icon: Shield,
    href: "/sessions",
    color: "primary"
  },
  {
    id: "wallet",
    title: "Anonymous Wallets",
    description: "Generate cryptographically secure Ed25519 keypairs locally. Base58 encoded and Phantom-importable.",
    icon: Key,
    href: "/wallet",
    color: "secondary"
  },
  {
    id: "relay",
    title: "Relay Network",
    icon: Network,
    href: "/relay",
    color: "accent"
  }
];

export default function Home() {
  const { data: health } = useHealthCheck();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative rounded-2xl overflow-hidden border border-primary/20 min-h-[60vh] flex items-center box-glow">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/cyber-bg.png`}
            alt="Cyberpunk grid"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>

        <div className="relative z-10 p-8 md:p-16 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold mb-6 tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              System Online {health?.status === "ok" ? "• Core Connected" : ""}
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-none">
              ENTER THE SHADOW.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">
                OWN YOUR PRIVACY.
              </span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-10 font-mono max-w-2xl">
              RelayForge architecture detected. Initiating zero-knowledge protocols.
              Your connection to the decentralized web is now secured against surveillance capitalism.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/sessions">
                <span className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md bg-primary text-primary-foreground font-bold font-mono tracking-wider hover:bg-primary/90 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] cursor-pointer">
                  <Shield className="w-5 h-5" />
                  INITIATE STEALTH
                </span>
              </Link>
              <Link href="/wallet">
                <span className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md bg-card border border-primary/50 text-primary font-bold font-mono tracking-wider hover:bg-primary/10 transition-all hover:-translate-y-1 cursor-pointer">
                  <Key className="w-5 h-5" />
                  GENERATE KEYS
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Active Relay Nodes", value: "1,024", icon: Globe, color: "text-primary" },
            { label: "Wallets Generated", value: "84.2K", icon: Cpu, color: "text-secondary" },
            { label: "Network Load", value: "34%", icon: Activity, color: "text-white" },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="bg-card border border-border p-6 rounded-xl flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className={`p-4 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section>
        <div className="mb-8">
          <h2 className="text-2xl font-display text-white inline-flex items-center gap-2">
            <span className="w-4 h-4 bg-primary rounded-sm inline-block" />
            CORE DIRECTIVES
          </h2>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.id} variants={item}>
              <Link href={feature.href}>
                <span className="block h-full bg-card border border-border hover:border-primary/50 p-8 rounded-xl transition-all duration-300 hover:-translate-y-2 group cursor-pointer relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <feature.icon className={`w-10 h-10 mb-6 transition-transform group-hover:scale-110 ${
                    feature.color === 'primary' ? 'text-primary' : 
                    feature.color === 'secondary' ? 'text-secondary' : 'text-accent'
                  }`} />
                  
                  <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-muted-foreground font-mono text-sm leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  
                  <div className="flex items-center text-xs font-mono font-bold text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
                    ACCESS MODULE <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
