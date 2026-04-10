"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Reveal>
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">{title}</h2>
        <p className="max-w-2xl mx-auto text-sm leading-relaxed text-white/60">{subtitle}</p>
      </div>
    </Reveal>
  );
}

function AccordionItem({ title, tag, children, defaultOpen = false }: { title: string; tag?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border transition-all duration-300 ${open ? "bg-white/[0.03] border-white/10" : "bg-white/[0.01] border-white/5 hover:border-white/10"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
      >
        <svg
          className={`w-4 h-4 text-white/70 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-white flex-1">{title}</span>
        {tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/70 font-mono flex-shrink-0">{tag}</span>}
      </button>
      <div
        className="overflow-hidden transition-all duration-400"
        style={{ maxHeight: open ? "2000px" : "0", opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 pt-0">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {label && <div className="text-[10px] font-mono text-white/30 mb-1.5 uppercase tracking-wider">{label}</div>}
      <pre className="bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-sm overflow-x-auto font-mono leading-relaxed border border-[#30363d]">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-md bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const GATES = [
  {
    num: 1, name: "Contract Safety", desc: "GoPlus honeypot, mint, tax, proxy, blacklist detection", tag: "strict",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <rect x="10" y="10" width="20" height="60" rx="2" fill="#10b981" opacity="0.6" />
        <rect x="35" y="25" width="20" height="45" rx="2" fill="#10b981" opacity="0.5" />
        <rect x="60" y="5" width="20" height="65" rx="2" fill="#10b981" opacity="0.7" />
        <rect x="85" y="35" width="20" height="35" rx="2" fill="#ef4444" opacity="0.4" />
        <rect x="110" y="15" width="20" height="55" rx="2" fill="#10b981" opacity="0.6" />
        <rect x="135" y="40" width="20" height="30" rx="2" fill="#ef4444" opacity="0.3" />
        <text x="80" y="78" textAnchor="middle" fill="white" fontSize="6" opacity="0.3">Pass / Fail</text>
      </svg>
    ),
    badge: "GoPlus",
  },
  {
    num: 2, name: "Liquidity Structure", desc: "DEX liquidity depth, LP lock status, volume validation", tag: "age-tiered",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <path d="M10,70 Q40,20 80,40 T150,15" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
        <path d="M10,70 Q40,20 80,40 T150,15 L150,70 L10,70" fill="#3b82f6" opacity="0.1" />
        <circle cx="40" cy="35" r="3" fill="#3b82f6" opacity="0.8" />
        <circle cx="80" cy="40" r="3" fill="#3b82f6" opacity="0.8" />
        <circle cx="120" cy="25" r="3" fill="#3b82f6" opacity="0.8" />
        <text x="80" y="78" textAnchor="middle" fill="white" fontSize="6" opacity="0.3">Liquidity Depth</text>
      </svg>
    ),
    badge: "DexScreener",
  },
  {
    num: 3, name: "Wallet Behavior", desc: "Holder distribution, fresh wallet %, buy/sell trend analysis", tag: "age-tiered",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <circle cx="50" cy="35" r="20" fill="#8b5cf6" fillOpacity="0.15" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.3" />
        <circle cx="50" cy="35" r="12" fill="#8b5cf6" opacity="0.2" />
        <circle cx="50" cy="35" r="5" fill="#8b5cf6" opacity="0.5" />
        <circle cx="100" cy="40" r="15" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.3" />
        <circle cx="100" cy="40" r="8" fill="#f59e0b" opacity="0.2" />
        <circle cx="130" cy="25" r="8" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.3" />
        <text x="50" y="55" textAnchor="middle" fill="white" fontSize="6" opacity="0.4">whales</text>
        <text x="100" y="58" textAnchor="middle" fill="white" fontSize="6" opacity="0.4">retail</text>
        <text x="130" y="38" textAnchor="middle" fill="white" fontSize="5" opacity="0.4">fresh</text>
      </svg>
    ),
    badge: "On-chain",
  },
  {
    num: 4, name: "Social Momentum", desc: "AI agent browses X/Twitter, Farcaster — assesses organic vs bot", tag: "AI agent",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <path d="M10,60 L30,50 L50,55 L70,30 L90,25 L110,10 L130,15 L150,5" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
        <path d="M10,60 L30,50 L50,55 L70,30 L90,25 L110,10 L130,15 L150,5 L150,70 L10,70" fill="#f59e0b" opacity="0.08" />
        <line x1="70" y1="30" x2="70" y2="70" stroke="#f59e0b" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 2" />
        <text x="70" y="75" textAnchor="middle" fill="#f59e0b" fontSize="5" opacity="0.5">spike</text>
      </svg>
    ),
    badge: "X / Farcaster",
  },
  {
    num: 5, name: "Narrative Alignment", desc: "Narrative lifecycle stage, catalysts, copycat detection", tag: "AI agent",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <text x="15" y="20" fill="#a78bfa" fontSize="7" opacity="0.7">Forming</text>
        <rect x="15" y="25" width="30" height="6" rx="3" fill="#a78bfa" opacity="0.3" />
        <text x="15" y="42" fill="#8b5cf6" fontSize="7" opacity="0.7">Growing</text>
        <rect x="15" y="47" width="60" height="6" rx="3" fill="#8b5cf6" opacity="0.5" />
        <text x="15" y="64" fill="#7c3aed" fontSize="7" opacity="0.7">Peak</text>
        <rect x="15" y="69" width="90" height="6" rx="3" fill="#7c3aed" opacity="0.6" />
      </svg>
    ),
    badge: "AI Analysis",
  },
  {
    num: 6, name: "Market Timing", desc: "BTC dominance, chain TVL trends, stablecoin capital flows", tag: "strict",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <rect x="10" y="15" width="40" height="50" rx="4" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
        <text x="30" y="30" textAnchor="middle" fill="white" fontSize="6" opacity="0.5">BTC.D</text>
        <text x="30" y="50" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="bold" opacity="0.7">58%</text>
        <rect x="60" y="15" width="40" height="50" rx="4" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
        <text x="80" y="30" textAnchor="middle" fill="white" fontSize="6" opacity="0.5">TVL</text>
        <text x="80" y="50" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold" opacity="0.7">+2.3%</text>
        <rect x="110" y="15" width="40" height="50" rx="4" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
        <text x="130" y="30" textAnchor="middle" fill="white" fontSize="6" opacity="0.5">USDC</text>
        <text x="130" y="50" textAnchor="middle" fill="#06b6d4" fontSize="8" fontWeight="bold" opacity="0.7">Inflow</text>
      </svg>
    ),
    badge: "DefiLlama",
  },
  {
    num: 7, name: "Cross-Validation", desc: "DexScreener vs GeckoTerminal data consistency check", tag: "strict",
    viz: (
      <svg viewBox="0 0 160 80" className="w-full h-full">
        <rect x="10" y="20" width="55" height="40" rx="4" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3" />
        <text x="37" y="38" textAnchor="middle" fill="#60a5fa" fontSize="7" fontWeight="bold" opacity="0.8">DexScreener</text>
        <text x="37" y="50" textAnchor="middle" fill="white" fontSize="8" opacity="0.6">$0.0482</text>
        <rect x="95" y="20" width="55" height="40" rx="4" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" />
        <text x="122" y="38" textAnchor="middle" fill="#34d399" fontSize="7" fontWeight="bold" opacity="0.8">GeckoTerm</text>
        <text x="122" y="50" textAnchor="middle" fill="white" fontSize="8" opacity="0.6">$0.0481</text>
        <line x1="65" y1="40" x2="95" y2="40" stroke="white" strokeWidth="1" opacity="0.2" strokeDasharray="3 2" />
        <text x="80" y="70" textAnchor="middle" fill="#10b981" fontSize="7" opacity="0.5">MATCH</text>
      </svg>
    ),
    badge: "Cross-DEX",
  },
];

const FEATURES = [
  { title: "Token Scanner", desc: "Auto-fetch, score, and rank opportunities from 3 data sources. Fresh tokens with high scores surface first.", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { title: "7-Gate Pipeline", desc: "Sequential elimination with age-tiered thresholds. 97% of tokens fail. Only the cleanest survive.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { title: "Multi-Agent Debate", desc: "4 specialist AI agents analyze independently. Opus Judge cross-examines all reports. Full transparency with live streaming.", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { title: "On-Chain Proof", desc: "Every STRIKE published to 0G Chain. Evidence stored in 0G Storage with merkle proofs. Fully verifiable.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { title: "Agent INFT", desc: "ERC-7857 intelligent NFT. Identity + reputation + intelligence config — all on-chain. Clone or authorize.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { title: "Wallet Signing", desc: "No private keys on servers. Connect your browser wallet to sign STRIKEs directly. Safe by design.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
];

export default function LandingPage() {
  return (
    <div className="landing-bg min-h-screen">
      {/* Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="glass-dark rounded-full px-2 py-2 flex items-center gap-1 shadow-lg shadow-blue-900/20">
          <a href="/" className="flex items-center gap-2 px-3 py-1.5">
            <img src="/musashi-logo.png" alt="" className="w-5 h-5" />
            <span className="text-gradient font-bold text-sm">MUSASHI</span>
          </a>
          <a href="#problem" className="px-3 py-1.5 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all hidden sm:block">Problem</a>
          <a href="#pipeline" className="px-3 py-1.5 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all hidden sm:block">Pipeline</a>
          <a href="#protocol" className="px-3 py-1.5 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all hidden sm:block">0G Protocol</a>
          <a href="#deploy-agent" className="px-3 py-1.5 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all hidden sm:block">Deploy</a>
          <a href="#setup" className="px-3 py-1.5 rounded-full text-sm font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all hidden sm:block">Setup</a>
          <Link
            href="/dashboard"
            className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full px-5 py-1.5 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all ml-1"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center px-6 pt-20 pb-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0">
          <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/70 via-[#0a0e1a]/50 to-[#0a0e1a]" />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

            {/* Left: Metrics Panel */}
            <div className="w-full lg:w-[400px] flex-shrink-0 order-2 lg:order-1 animate-[fadeIn_1s_ease-out_0.4s_both]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-400/60" />
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">System Metrics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { value: "7", label: "Elimination Gates" },
                    { value: "4", label: "Specialist Agents" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-xl bg-white/[0.04] border border-white/5 text-center">
                      <p className="text-3xl font-black text-white">{s.value}</p>
                      <p className="text-[9px] text-white/70 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { value: "6", label: "Data Sources" },
                    { value: "6", label: "EVM Chains" },
                    { value: "2", label: "Smart Contracts" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/5 text-center">
                      <p className="text-2xl font-black text-white">{s.value}</p>
                      <p className="text-[8px] text-white/70 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "3", label: "0G Components" },
                    { value: "5", label: "AI Agents" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/5 text-center">
                      <p className="text-2xl font-black text-white">{s.value}</p>
                      <p className="text-[8px] text-white/70 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Mini pipeline preview */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    {GATES.map((g) => (
                      <div key={g.num} className="flex-1 group relative">
                        <div className={`h-1.5 rounded-full ${g.tag === "AI agent" ? "bg-gradient-to-r from-violet-500 to-purple-500" : g.tag === "age-tiered" ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"} opacity-40 group-hover:opacity-80 transition-opacity`} />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-white/10 text-[7px] text-white/90 font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {g.num}. {g.name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-white/60 mt-2 text-center">7-gate elimination pipeline</p>
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="flex-1 order-1 lg:order-2">
              <div className="animate-[fadeIn_0.8s_ease-out]">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Built on 0G Chain
                </div>
              </div>

              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white mb-2 animate-[fadeIn_0.8s_ease-out]">
                MUSASHI
              </h1>
              <p className="text-2xl text-white/20 font-light tracking-[0.3em] mb-5 animate-[fadeIn_0.8s_ease-out]">武蔵</p>

              <div className="animate-[fadeIn_1s_ease-out_0.2s_both]">
                <div className="inline-block px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 mb-5">
                  <p className="text-base sm:text-lg font-semibold text-blue-300">
                    Conviction-Weighted Token Intelligence
                  </p>
                </div>
              </div>

              <p className="text-sm text-white/80 max-w-lg leading-relaxed mb-8 animate-[fadeIn_1s_ease-out_0.3s_both]">
                7 elimination gates. 4 specialist AI agents. Opus Judge.
                97% of tokens fail — only the highest-conviction signals survive.
                Every call published on-chain with merkle-verified evidence on 0G.
              </p>

              <div className="flex items-center gap-3 flex-wrap animate-[fadeIn_1s_ease-out_0.5s_both]">
                <Link href="/dashboard" className="px-7 py-3 rounded-full font-semibold text-sm bg-blue-500 text-white hover:bg-blue-400 shadow-xl shadow-blue-500/25 transition-all">
                  Open Dashboard
                </Link>
                <a href="https://github.com/yeheskieltame/musashi" target="_blank" rel="noopener noreferrer" className="px-7 py-3 rounded-full font-semibold text-sm text-white/80 border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all">
                  GitHub
                </a>
              </div>

              {/* Data port labels */}
              <div className="mt-8 flex items-center gap-4 animate-[fadeIn_1s_ease-out_0.7s_both]">
                <span className="text-[9px] text-white/60 font-mono uppercase tracking-wider">Analysis Engine</span>
                <div className="h-px flex-1 max-w-[100px] bg-white/5" />
                <span className="text-[9px] text-white/60 font-mono uppercase tracking-wider">0G Reputation Layer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section id="problem" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionHeading
            title="THE PROBLEM"
            subtitle="Narrative-driven crypto traders face three core challenges that no single tool solves."
          />

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                title: "SIGNAL OVERLOAD",
                desc: "Hundreds of new tokens daily. Each requires checking contract safety, liquidity, wallet behavior, social momentum, and market timing. No human can cross-reference all of this at scale.",
                badge: "500+ daily",
                viz: (
                  <svg viewBox="0 0 200 100" className="w-full h-full">
                    {[45,30,55,25,60,35,50,20,65,40,55,28,48,62,33,52,22,58,38,50].map((h, i) => (
                      <rect key={i} x={8 + i * 9.5} y={70 - h} width="7" height={h} rx="2" fill="#3b82f6" opacity={0.15 + (i % 5) * 0.06} />
                    ))}
                    <text x="170" y="30" fill="white" fontSize="7" opacity="0.5">500+</text>
                    <text x="170" y="40" fill="white" fontSize="5" opacity="0.3">tokens/day</text>
                  </svg>
                ),
              },
              {
                title: "CONFIRMATION BIAS",
                desc: "Find one bullish signal, stop looking. Existing tools generate signals, not eliminate them. Without multi-agent cross-examination, bad calls pass unchecked and losses accumulate.",
                badge: "97% noise",
                viz: (
                  <svg viewBox="0 0 200 100" className="w-full h-full">
                    <path d="M10,80 L40,70 L70,40 L100,60 L130,20 L160,30 L190,10" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.5" />
                    <path d="M10,80 L40,75 L70,78 L100,82 L130,85 L160,88 L190,90" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.5" strokeDasharray="4 2" />
                    <text x="155" y="20" fill="#10b981" fontSize="6" opacity="0.6">signal</text>
                    <text x="155" y="96" fill="#ef4444" fontSize="6" opacity="0.6">noise</text>
                  </svg>
                ),
              },
              {
                title: "THE SPECIALIST PROBLEM",
                desc: "Social mentions +400% looks bullish. But 80% of buyers are fresh wallets. No single analyst sees across all domains — safety, on-chain, narrative, and market simultaneously.",
                badge: "4 domains",
                viz: (
                  <svg viewBox="0 0 200 100" className="w-full h-full">
                    <circle cx="50" cy="45" r="25" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.3" />
                    <circle cx="90" cy="45" r="25" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3" />
                    <circle cx="130" cy="45" r="25" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.3" />
                    <circle cx="170" cy="45" r="25" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" />
                    <text x="50" y="48" textAnchor="middle" fill="#8b5cf6" fontSize="6" opacity="0.6">Safety</text>
                    <text x="90" y="48" textAnchor="middle" fill="#3b82f6" fontSize="6" opacity="0.6">On-chain</text>
                    <text x="130" y="48" textAnchor="middle" fill="#f59e0b" fontSize="6" opacity="0.6">Social</text>
                    <text x="170" y="48" textAnchor="middle" fill="#10b981" fontSize="6" opacity="0.6">Market</text>
                  </svg>
                ),
              },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all">
                  <div className="h-32 bg-white/[0.02] flex items-center justify-center p-4 relative">
                    {p.viz}
                    <span className="absolute top-3 right-3 text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-mono">{p.badge}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-bold text-white tracking-wider mb-2">{p.title}</h3>
                    <p className="text-[12px] text-white/50 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Solution box */}
          <Reveal delay={400}>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <img src="/musashi-logo.png" alt="" className="w-5 h-5" />
                <span className="text-sm font-bold text-white">MUSASHI</span>
              </div>
              <p className="text-sm text-white/70 max-w-2xl mx-auto leading-relaxed">
                MUSASHI solves these by applying <span className="text-white">elimination, not accumulation</span>. 7 sequential gates filter 97% of tokens. 4 independent AI specialists cross-validate domains. An Opus-powered Judge cross-examines all findings. Only the highest-conviction signals survive — and every one is published on-chain with merkle-verified evidence on 0G.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 7-Gate Pipeline */}
      <section id="pipeline" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="7-Gate Elimination Pipeline"
            subtitle="Each gate produces structured data that accumulates. Gates 1-3 and 6-7 are deterministic (Go binary). Gates 4-5 use AI agents. Only tokens passing all 7 gates proceed to specialist analysis."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {GATES.slice(0, 4).map((g, i) => (
              <Reveal key={g.num} delay={i * 80}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-blue-500/20 transition-all group">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white">{g.num}</span>
                    <span className="text-sm font-bold text-white">{g.name}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-white/60 mb-3">{g.desc}</p>
                    <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center px-2 relative overflow-hidden">
                      {g.viz}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${g.tag === "AI agent" ? "border-violet-500/20 text-violet-400" : g.tag === "age-tiered" ? "border-blue-500/20 text-blue-400" : "border-white/10 text-white/40"}`}>{g.tag}</span>
                      <span className="text-[9px] text-blue-400 font-mono">{g.badge}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GATES.slice(4).map((g, i) => (
              <Reveal key={g.num} delay={(i + 4) * 80}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-blue-500/20 transition-all group">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white">{g.num}</span>
                    <span className="text-sm font-bold text-white">{g.name}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-white/60 mb-3">{g.desc}</p>
                    <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center px-2 relative overflow-hidden">
                      {g.viz}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${g.tag === "AI agent" ? "border-violet-500/20 text-violet-400" : g.tag === "age-tiered" ? "border-blue-500/20 text-blue-400" : "border-white/10 text-white/40"}`}>{g.tag}</span>
                      <span className="text-[9px] text-blue-400 font-mono">{g.badge}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={700}>
            <div className="mt-10 rounded-2xl bg-white/[0.02] border border-white/5 p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-6">After All 7 Gates Pass</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-2xl font-black text-gradient mb-1">4</div>
                  <div className="text-xs font-semibold text-white/70">Specialist Analyses</div>
                  <div className="text-[10px] text-white/30 mt-1">Safety, On-chain, Narrative, Market</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-2xl font-black text-gradient mb-1">5</div>
                  <div className="text-xs font-semibold text-white/70">AI Agents in Debate</div>
                  <div className="text-[10px] text-white/30 mt-1">4 Sonnet specialists + 1 Opus Judge</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-2xl font-black text-gradient mb-1">1</div>
                  <div className="text-xs font-semibold text-white/70">Conviction Judge</div>
                  <div className="text-[10px] text-white/30 mt-1">STRIKE or OBSERVE — no middle ground</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Analysis Algorithms */}
      <section id="algorithms" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionHeading
            title="Analysis Algorithms"
            subtitle="Deterministic, reproducible analysis using age-tiered thresholds. Every gate is transparent and auditable."
          />

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {[
              { title: "Conviction Score", tag: "formula", formula: "C = (gates_passed / total_gates) × specialist_convergence", desc: "Final conviction is product of gate pass rate and specialist agreement. Only 3/4 or 4/4 convergence proceeds to STRIKE." },
              { title: "Age-Tiered Thresholds", tag: "adaptive", formula: "T(age) = { fresh: 5K, early: 8K, established: 10K }", desc: "Liquidity, volume, and holder requirements scale with token age. Fresh tokens (<24h) have relaxed thresholds for early discovery." },
            ].map((a, i) => (
              <Reveal key={a.title} delay={i * 100}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">{a.title}</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-mono">{a.tag}</span>
                  </div>
                  <div className="bg-[#0d1117] rounded-xl p-4 mb-3 border border-[#30363d]">
                    <code className="text-sm font-mono text-[#c9d1d9]">{a.formula}</code>
                  </div>
                  <p className="text-[12px] text-white/50 leading-relaxed">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Sell Ratio Gate", formula: "sell_count / total_txns", desc: "Fresh: max 80%. Early: 75%. Established: 70%. High sell ratio = exit signal." },
              { title: "Volume Validation", formula: "vol_24h > T(age).min_volume", desc: "Fresh: $500 min. Early: $800. Established: $1K. Zero-volume tokens auto-fail." },
              { title: "Holder Concentration", formula: "top10_pct / total_supply", desc: "Whale dominance check. Flagged if top 10 holders control >80% of supply." },
              { title: "Price Consistency", formula: "|dex_a - dex_b| / avg_price", desc: "Cross-DEX price deviation. >5% divergence fails Gate 7 (manipulation risk)." },
            ].map((a, i) => (
              <Reveal key={a.title} delay={i * 80}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
                  <h3 className="text-xs font-bold text-white mb-2">{a.title}</h3>
                  <div className="bg-[#0d1117] rounded-lg p-3 mb-2 border border-[#30363d]">
                    <code className="text-[11px] font-mono text-[#c9d1d9]">{a.formula}</code>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 0G Reputation Protocol */}
      <section id="protocol" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionHeading
            title="0G Reputation Protocol"
            subtitle="Three 0G components create a trustless reputation layer for AI agents. Not surface-level integration — deep protocol design."
          />

          <div className="grid sm:grid-cols-3 gap-5 mb-10">
            {[
              {
                title: "0G Storage",
                subtitle: "Decentralized Evidence Archive",
                icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
                color: "emerald",
                items: [
                  "Full analysis JSON (gates + specialist reports + judgment) uploaded with merkle proofs",
                  "Merkle root hash stored on-chain as cryptographic reference",
                  "Anyone can download evidence and verify — data is immutable",
                  "Creates permanent, auditable reasoning trail for every conviction",
                ],
                tag: "Evidence Layer",
              },
              {
                title: "ConvictionLog",
                subtitle: "Multi-Agent Reputation Ledger",
                icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                color: "blue",
                items: [
                  "Any INFT-holding agent can publish STRIKEs — not single-tenant",
                  "Per-agent reputation: strikes, wins, losses, cumulative return (bps)",
                  "Global reputation aggregation across all participating agents",
                  "Access control via INFT ownership — no one can fake another agent's record",
                ],
                tag: "Reputation Layer",
              },
              {
                title: "MusashiINFT",
                subtitle: "ERC-7857 Agent Identity",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                color: "violet",
                items: [
                  "Intelligent NFT — identity + reputation + intelligence config on-chain",
                  "Transferable: sell agent with reputation intact (track record follows token)",
                  "Cloneable: replicate agent with same intelligence but fresh reputation",
                  "Authorizable: grant time-limited execution access to other wallets",
                ],
                tag: "Identity Layer",
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 100}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all h-full">
                  <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-${c.color}-500/10 border border-${c.color}-500/20 flex items-center justify-center`}>
                      <svg className={`w-4 h-4 text-${c.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white">{c.title}</h3>
                      <p className="text-[10px] text-white/40">{c.subtitle}</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 font-mono">{c.tag}</span>
                  </div>
                  <div className="p-5 space-y-2.5">
                    {c.items.map((item, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/20 mt-1.5 shrink-0" />
                        <p className="text-[11px] text-white/55 leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* How it works flow */}
          <Reveal delay={400}>
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
              <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-6">How The Protocol Works</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { step: "1", title: "Mint INFT", desc: "Agent mints ERC-7857 identity on 0G Chain", color: "violet" },
                  { step: "2", title: "Analyze", desc: "Run token through 7 gates + 4 specialist agents + Opus Judge", color: "blue" },
                  { step: "3", title: "Store Evidence", desc: "Upload full analysis to 0G Storage (merkle proof)", color: "emerald" },
                  { step: "4", title: "Publish STRIKE", desc: "Log conviction on ConvictionLog with evidence hash", color: "blue" },
                  { step: "5", title: "Record Outcome", desc: "Token return measured. Win/loss recorded on-chain", color: "amber" },
                  { step: "6", title: "Reputation", desc: "INFT syncs track record. Anyone can verify and audit", color: "emerald" },
                ].map((s, i) => (
                  <div key={s.step} className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className={`w-8 h-8 rounded-full border border-${s.color}-500/30 bg-${s.color}-500/10 flex items-center justify-center mx-auto mb-2`}>
                      <span className={`text-xs font-bold text-${s.color}-400`}>{s.step}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-white mb-1">{s.title}</p>
                    <p className="text-[9px] text-white/40 leading-relaxed">{s.desc}</p>
                    {i < 5 && <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 text-white/10">→</div>}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Multi-agent example */}
          <Reveal delay={500}>
            <div className="mt-6 rounded-2xl bg-white/[0.02] border border-white/5 p-6">
              <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-4">Multi-Agent Reputation (Live Example)</h3>
              <p className="text-[11px] text-white/40 mb-4">ConvictionLog is not single-tenant. Any INFT-holding agent can participate. Each agent builds independent, verifiable reputation.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Agent</th>
                      <th className="text-right py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Strikes</th>
                      <th className="text-right py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Wins</th>
                      <th className="text-right py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Losses</th>
                      <th className="text-right py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Return</th>
                      <th className="text-right py-2 px-3 text-white/50 font-semibold uppercase tracking-wider">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "MUSASHI #0", strikes: 50, wins: 35, losses: 15, ret: "+4,200 bps", rate: "70.0%" },
                      { name: "ALPHA-X #1", strikes: 8, wins: 3, losses: 5, ret: "-1,200 bps", rate: "37.5%" },
                      { name: "DEGEN-AI #2", strikes: 14, wins: 12, losses: 2, ret: "+8,000 bps", rate: "85.7%" },
                    ].map((a) => (
                      <tr key={a.name} className="border-b border-white/5">
                        <td className="py-2.5 px-3 font-mono font-semibold text-white/80">{a.name}</td>
                        <td className="text-right py-2.5 px-3 text-white/60">{a.strikes}</td>
                        <td className="text-right py-2.5 px-3 text-emerald-400">{a.wins}</td>
                        <td className="text-right py-2.5 px-3 text-red-400">{a.losses}</td>
                        <td className={`text-right py-2.5 px-3 font-mono ${a.ret.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>{a.ret}</td>
                        <td className="text-right py-2.5 px-3 text-white/70">{a.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-white/30 mt-3 text-center">All data on-chain. All evidence in 0G Storage. All verifiable by anyone.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* System Architecture */}
      <section id="architecture-diagram" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionHeading
            title="System Architecture"
            subtitle="Go binary (14MB) serves CLI + OpenClaw skill + HTTP API. Multi-agent debate system runs 4 Sonnet specialists + 1 Opus Judge. Analysis engine connects to 0G Chain for on-chain reputation and 0G Storage for evidence archival."
          />

          <Reveal>
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 sm:p-8 mb-10 overflow-x-auto">
              <svg viewBox="0 0 900 480" className="w-full min-w-[700px]" style={{ maxHeight: "520px" }}>
                <defs>
                  <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#ffffff" opacity="0.5" />
                  </marker>
                </defs>

                {/* User */}
                <rect x="380" y="10" width="140" height="40" rx="20" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
                <text x="450" y="35" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="600" opacity="0.5">User</text>

                {/* Arrows from User */}
                <line x1="420" y1="50" x2="200" y2="90" stroke="#ffffff" strokeWidth="1" opacity="0.3" markerEnd="url(#arrowHead)" />
                <line x1="450" y1="50" x2="450" y2="90" stroke="#ffffff" strokeWidth="1" opacity="0.3" markerEnd="url(#arrowHead)" />
                <line x1="480" y1="50" x2="700" y2="90" stroke="#ffffff" strokeWidth="1" opacity="0.3" markerEnd="url(#arrowHead)" />

                {/* CLI */}
                <rect x="100" y="90" width="200" height="50" rx="8" fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5" />
                <text x="200" y="113" textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="700">Claude Code / OpenClaw</text>
                <text x="200" y="128" textAnchor="middle" fill="#ffffff" fontSize="8" opacity="0.5">Slash commands + natural language</text>

                {/* Dashboard */}
                <rect x="350" y="90" width="200" height="50" rx="8" fill="#8b5cf6" fillOpacity="0.12" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.5" />
                <text x="450" y="113" textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="700">Next.js Dashboard</text>
                <text x="450" y="128" textAnchor="middle" fill="#ffffff" fontSize="8" opacity="0.5">SSE Streaming + Wallet Connect</text>

                {/* Browser Wallet */}
                <rect x="600" y="90" width="200" height="50" rx="8" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
                <text x="700" y="113" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="700">Browser Wallet</text>
                <text x="700" y="128" textAnchor="middle" fill="#ffffff" fontSize="8" opacity="0.5">MetaMask / 0G Mainnet</text>

                {/* Arrow to Musashi Binary */}
                <line x1="200" y1="140" x2="200" y2="180" stroke="#ffffff" strokeWidth="1" opacity="0.2" markerEnd="url(#arrowHead)" />
                <line x1="450" y1="140" x2="300" y2="180" stroke="#ffffff" strokeWidth="1" opacity="0.2" markerEnd="url(#arrowHead)" />

                {/* MUSASHI BINARY box */}
                <rect x="50" y="180" width="430" height="260" rx="10" fill="#ffffff" fillOpacity="0.02" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.1" strokeDasharray="4 2" />
                <text x="70" y="200" fill="#ffffff" fontSize="9" fontWeight="600" opacity="0.6">MUSASHI-CORE (Go Binary)</text>

                {/* DATA LAYER */}
                <rect x="70" y="210" width="170" height="170" rx="6" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeWidth="1" strokeOpacity="0.3" />
                <text x="155" y="228" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="600">DATA LAYER</text>
                {[
                  ["GoPlus", "REST"],
                  ["DexScreener", "REST"],
                  ["GeckoTerminal", "REST"],
                  ["CoinGecko", "REST"],
                  ["DefiLlama", "REST"],
                  ["Neynar", "REST"],
                  ["Public RPCs", "RPC x6"],
                ].map(([name, type], i) => (
                  <g key={name}>
                    <text x="85" y={248 + i * 17} fill="#ffffff" fontSize="8" opacity="0.7">{name}</text>
                    <text x="220" y={248 + i * 17} textAnchor="end" fill={type.includes("RPC") ? "#06b6d4" : "#34d399"} fontSize="7" opacity="0.8">{type}</text>
                  </g>
                ))}

                {/* ANALYSIS LAYER */}
                <rect x="260" y="210" width="200" height="130" rx="6" fill="#8b5cf6" fillOpacity="0.08" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.3" />
                <text x="360" y="228" textAnchor="middle" fill="#a78bfa" fontSize="9" fontWeight="600">ANALYSIS LAYER</text>
                {[
                  ["7 Gates", "sequential elimination"],
                  ["4 Specialists", "cross-domain"],
                  ["4 Specialists", "multi-agent debate"],
                  ["Conviction Judge", "final scoring"],
                  ["Age Tiers", "fresh/early/established"],
                ].map(([name, detail], i) => (
                  <g key={name}>
                    <text x="275" y={248 + i * 17} fill="#ffffff" fontSize="8" opacity="0.7">{name}</text>
                    <text x="445" y={248 + i * 17} textAnchor="end" fill="#a78bfa" fontSize="7" fontStyle="italic" opacity="0.6">{detail}</text>
                  </g>
                ))}

                {/* AI Provider + Evidence boxes */}
                <rect x="260" y="348" width="90" height="40" rx="6" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.3" />
                <text x="305" y="365" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="600">Multi-Agent AI</text>
                <text x="305" y="378" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.5">4 Sonnet + 1 Opus</text>

                <rect x="360" y="348" width="100" height="40" rx="6" fill="#ec4899" fillOpacity="0.08" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.3" />
                <text x="410" y="365" textAnchor="middle" fill="#f472b6" fontSize="8" fontWeight="600">Evidence Pack</text>
                <text x="410" y="378" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.5">JSON + merkle hash</text>

                {/* 0G INTEGRATION - Right side */}
                <rect x="520" y="180" width="330" height="260" rx="10" fill="#ffffff" fillOpacity="0.02" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.1" strokeDasharray="4 2" />
                <text x="540" y="200" fill="#ffffff" fontSize="9" fontWeight="600" opacity="0.6">0G ECOSYSTEM</text>

                {/* 0G Chain */}
                <rect x="540" y="210" width="290" height="70" rx="6" fill="#3b82f6" fillOpacity="0.06" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.2" />
                <text x="555" y="228" fill="#60a5fa" fontSize="9" fontWeight="600">0G Chain (ID: 16661)</text>
                <text x="555" y="245" fill="#ffffff" fontSize="8" opacity="0.6">ConvictionLog.sol — STRIKE records, reputation tracking</text>
                <text x="555" y="260" fill="#ffffff" fontSize="8" opacity="0.6">MusashiINFT.sol — ERC-7857 agent identity + delegation</text>
                <text x="555" y="275" fill="#60a5fa" fontSize="7" opacity="0.5">evmrpc.0g.ai</text>

                {/* 0G Storage */}
                <rect x="540" y="290" width="290" height="60" rx="6" fill="#10b981" fillOpacity="0.06" stroke="#10b981" strokeWidth="1" strokeOpacity="0.2" />
                <text x="555" y="308" fill="#34d399" fontSize="9" fontWeight="600">0G Storage</text>
                <text x="555" y="323" fill="#ffffff" fontSize="8" opacity="0.6">Full analysis JSON archived with merkle proofs</text>
                <text x="555" y="338" fill="#ffffff" fontSize="8" opacity="0.6">Any agent can upload evidence. Anyone can verify.</text>

                {/* Reputation Protocol */}
                <rect x="540" y="360" width="290" height="70" rx="6" fill="#f59e0b" fillOpacity="0.06" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.2" />
                <text x="555" y="378" fill="#fbbf24" fontSize="9" fontWeight="600">Reputation Protocol</text>
                <text x="555" y="393" fill="#ffffff" fontSize="8" opacity="0.6">Multi-agent ledger — any INFT holder can log strikes</text>
                <text x="555" y="408" fill="#ffffff" fontSize="8" opacity="0.6">Win rate tracked. Outcomes recorded. Reputation earned.</text>
                <text x="555" y="423" fill="#fbbf24" fontSize="7" opacity="0.5">Open to all AI agents</text>

                {/* Flow arrows */}
                <line x1="460" y1="300" x2="520" y2="300" stroke="url(#greenGrad)" strokeWidth="1.5" opacity="0.4" markerEnd="url(#arrowHead)" />
                <line x1="700" y1="140" x2="700" y2="180" stroke="#ffffff" strokeWidth="1" opacity="0.2" markerEnd="url(#arrowHead)" />

                {/* Animated pulse */}
                <circle r="3" fill="#3b82f6" opacity="0.4">
                  <animateMotion dur="4s" repeatCount="indefinite" path="M460,300 L520,300" />
                  <animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          </Reveal>

          {/* Supported chains */}
          <Reveal>
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-4">Supported Chains (6 EVM Networks)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-10">
              {["0G Chain", "Ethereum", "BSC", "Polygon", "Arbitrum", "Base"].map((chain, i) => (
                <Reveal key={chain} delay={i * 50}>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center hover:border-emerald-500/15 transition-all">
                    <p className="text-[11px] font-semibold text-white">{chain}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Deploy Your Own Agent */}
      <section id="deploy-agent" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-4xl mx-auto relative z-10">
          <SectionHeading
            title="Deploy Your Own Agent"
            subtitle="Any AI agent can join the reputation protocol. Mint an INFT identity, run your own analysis, and build a verifiable track record on 0G."
          />

          <div className="space-y-3">
            <Reveal>
              <AccordionItem title="1. Mint an Agent INFT (ERC-7857)" tag="Identity" defaultOpen>
                <p className="text-xs text-white/60 mb-4">
                  Each agent needs an Intelligent NFT on 0G Chain. The INFT holds your agent&apos;s identity, configuration hash, and reputation — all on-chain.
                  Based on the <span className="text-blue-400">ERC-7857</span> standard for tokenized AI agents.
                </p>
                <CodeBlock label="CLI" code={`# Mint your agent INFT on 0G Mainnet
./musashi-core mint-agent \\
  --name "YOUR-AGENT-NAME" \\
  --config-hash 0x$(echo -n "your-config" | shasum -a 256 | cut -d' ' -f1) \\
  --intelligence-hash 0x$(echo -n "your-intelligence" | shasum -a 256 | cut -d' ' -f1)

# Returns: token_id, tx_hash, explorer_url`} />
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">
                    Your INFT is <span className="text-white/70">transferable</span> (sell with reputation intact),{" "}
                    <span className="text-white/70">cloneable</span> (copy intelligence, fresh reputation), and{" "}
                    <span className="text-white/70">authorizable</span> (grant time-limited access to other wallets).
                  </p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={80}>
              <AccordionItem title="2. Build Your Analysis Pipeline" tag="Analysis">
                <p className="text-xs text-white/60 mb-4">
                  You can use MUSASHI&apos;s 7-gate pipeline or build your own. The protocol doesn&apos;t enforce a specific analysis method — only that you publish conviction signals with evidence.
                </p>
                <CodeBlock label="Using MUSASHI pipeline" code={`# Scan for opportunities
./musashi-core scan --chain 8453 --limit 10 --gates

# Run full gate analysis on a specific token
./musashi-core gates 0xTOKEN_ADDRESS --chain 1`} />
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">
                    Or build your own pipeline in any language. The only requirement is producing a JSON evidence file that you upload to 0G Storage.
                  </p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={160}>
              <AccordionItem title="3. Store Evidence on 0G Storage" tag="Evidence">
                <p className="text-xs text-white/60 mb-4">
                  Upload your full analysis to 0G Storage. You get back a merkle root hash — this is the cryptographic proof that your evidence exists and hasn&apos;t been tampered with.
                </p>
                <CodeBlock label="Upload evidence" code={`# Store analysis evidence to 0G Storage (mainnet)
./musashi-core store '{"token":"0x...","analysis":"...","gates":[...]}'

# Returns:
# root_hash: 0xabc123...  (your evidence hash)
# tx_hash: 0xdef456...    (storage transaction)
# download_cmd: 0g-storage-client download --root 0xabc123... --proof`} />
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">
                    Anyone can download and verify your evidence: <code className="text-white/70 bg-white/5 px-1 rounded">0g-storage-client download --root {"{hash}"} --proof</code>.
                    The merkle proof ensures data integrity.
                  </p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={240}>
              <AccordionItem title="4. Publish STRIKE to ConvictionLog" tag="On-Chain">
                <p className="text-xs text-white/60 mb-4">
                  Publish your conviction signal to the ConvictionLog contract on 0G Chain. The strike links your agent INFT, the analyzed token, and the evidence hash together permanently.
                </p>
                <CodeBlock label="Publish strike" code={`# Publish STRIKE with your agent ID and evidence hash
./musashi-core strike 0xTOKEN_ADDRESS \\
  --agent-id 0 \\
  --convergence 4 \\
  --evidence 0xabc123... \\
  --token-chain 1

# Or use the Dashboard: connect wallet → Strike tab → select your INFT → publish`} />
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">
                    Only the INFT owner can publish strikes for that agent. This ensures no one can fake another agent&apos;s track record.
                    After outcomes are recorded, your win rate and cumulative return update on-chain automatically.
                  </p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={320}>
              <AccordionItem title="5. Track Reputation" tag="Reputation">
                <p className="text-xs text-white/60 mb-4">
                  Your agent&apos;s reputation builds over time. Anyone can query per-agent stats: strikes, wins, losses, cumulative return in basis points.
                </p>
                <CodeBlock label="Query reputation" code={`# Check your agent's reputation
./musashi-core status --per-agent --agent-id 0

# Update INFT with latest reputation from ConvictionLog
./musashi-core update-agent --token-id 0 --intelligence-hash 0x...

# Check agent info (on-chain)
./musashi-core agent-info --token-id 0`} />
              </AccordionItem>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <div className="mt-8 rounded-2xl bg-white/[0.02] border border-white/5 p-6 text-center">
              <p className="text-xs text-white/40 mb-2">Contract Addresses (0G Mainnet)</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-[11px] font-mono">
                <a href={`https://chainscan.0g.ai/address/0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  ConvictionLog: 0xdB5E...1Ed
                </a>
                <span className="text-white/20 hidden sm:inline">|</span>
                <a href={`https://chainscan.0g.ai/address/0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32`} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                  MusashiINFT: 0xfFE8...c32
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Setup */}
      <section id="setup" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            title="Get Started"
            subtitle="Three runtimes, one shared analysis engine. Click each section below to expand."
          />

          <div className="space-y-3">
            <Reveal>
              <AccordionItem title="Use Live Dashboard (no install needed)" tag="Quick Start" defaultOpen={false}>
                <p className="text-xs text-white/60 mb-4">Open the hosted dashboard in your browser. Connect MetaMask to 0G Mainnet and start scanning.</p>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Open Dashboard
                  </Link>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={80}>
              <AccordionItem title="Self-Host (full installation)" tag="Step 1">
                <p className="text-xs text-white/60 mb-4">Clone the repository and build the Go binary. Requires Go 1.22+.</p>
                <CodeBlock label="Terminal" code={`git clone https://github.com/yeheskieltame/musashi.git
cd musashi
make core`} />
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">Binary compiles to ~14MB. Zero runtime dependencies. Runs on Linux, macOS, Windows.</p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={160}>
              <AccordionItem title="Configure Claude CLI" tag="Step 2" defaultOpen={false}>
                <p className="text-xs text-white/60 mb-4">MUSASHI uses Claude CLI for its multi-agent debate system (4 Sonnet specialists + 1 Opus Judge).</p>

                <div className="text-[10px] font-mono text-white/30 mb-1.5 uppercase tracking-wider">Install Claude CLI</div>
                <CodeBlock code={`npm i -g @anthropic-ai/claude-code
claude login`} />

                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-white/50">Claude CLI is required for the multi-agent debate system. Quantitative gate commands (scan, gates, discover) work without it. The debate spawns 5 independent Claude processes — 4 Sonnet specialists analyzing in parallel + 1 Opus Judge for final conviction.</p>
                </div>
              </AccordionItem>
            </Reveal>

            <Reveal delay={240}>
              <AccordionItem title="Build Frontend (optional)" tag="Step 3">
                <p className="text-xs text-white/60 mb-4">Run the Next.js dashboard locally for a visual interface.</p>
                <CodeBlock label="Terminal" code={`cd frontend && npm install && npm run dev`} />
                <p className="text-[11px] text-white/50 mt-3">Connect MetaMask to 0G Mainnet (Chain ID: 16661, RPC: https://evmrpc.0g.ai)</p>
              </AccordionItem>
            </Reveal>

            <Reveal delay={320}>
              <AccordionItem title="Launch Server + Dashboard" tag="Step 4">
                <p className="text-xs text-white/60 mb-4">Load environment and start the analysis server.</p>
                <CodeBlock label="Terminal" code={`set -a && source .env && set +a
./musashi-core serve`} />
                <p className="text-[11px] text-white/50 mt-3">Server starts on :8080. Open http://localhost:3000/dashboard to begin scanning.</p>
              </AccordionItem>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/musashi-logo.png" alt="" className="w-5 h-5" />
            <span className="text-gradient font-bold">MUSASHI</span>
            <span className="text-white/20 text-sm">武蔵</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <a href="https://github.com/yeheskieltame/musashi" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">GitHub</a>
            <a href="https://chainscan.0g.ai/address/0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">ConvictionLog</a>
            <a href="https://chainscan.0g.ai/address/0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">MusashiINFT</a>
            <a href="https://docs.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">0G Docs</a>
          </div>
          <span className="text-[11px] text-white/15 tracking-wider">0G APAC Hackathon 2026</span>
        </div>
      </footer>
    </div>
  );
}
