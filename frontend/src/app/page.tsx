"use client";

import { useState, useEffect, useRef } from "react";
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

function Section({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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

const GATES = [
  { num: 1, name: "Contract Safety", desc: "GoPlus honeypot, mint, tax, proxy, blacklist detection", strict: true },
  { num: 2, name: "Liquidity Structure", desc: "DEX liquidity depth, LP lock status, volume validation", strict: false },
  { num: 3, name: "Wallet Behavior", desc: "Holder distribution, fresh wallet %, buy/sell trend analysis", strict: false },
  { num: 4, name: "Social Momentum", desc: "AI agent browses X/Twitter, Farcaster — assesses organic vs bot", strict: false },
  { num: 5, name: "Narrative Alignment", desc: "Narrative lifecycle stage, catalysts, copycat detection", strict: false },
  { num: 6, name: "Market Timing", desc: "BTC dominance, chain TVL trends, stablecoin capital flows", strict: true },
  { num: 7, name: "Cross-Validation", desc: "DexScreener vs GeckoTerminal data consistency check", strict: true },
];

const FEATURES = [
  { title: "Token Scanner", desc: "Auto-fetch, score, and rank opportunities from 3 data sources. Fresh tokens with high scores surface first.", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { title: "7-Gate Pipeline", desc: "Sequential elimination with age-tiered thresholds. 97% of tokens fail. Only the cleanest survive.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { title: "Adversarial Debate", desc: "Bull and Bear researchers argue with live evidence. Two rounds. Only highest conviction passes.", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { title: "On-Chain Proof", desc: "Every STRIKE published to 0G Chain. Evidence stored in 0G Storage with merkle proofs. Fully verifiable.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { title: "Agent INFT", desc: "ERC-7857 intelligent NFT. Identity + reputation + intelligence config — all on-chain. Clone or authorize.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { title: "Wallet Signing", desc: "No private keys on servers. Connect your browser wallet to sign STRIKEs directly. Safe by design.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
];

const INSTALL_STEPS = [
  {
    title: "OpenClaw",
    steps: [
      { cmd: "openclaw skills install musashi", desc: "Install the skill" },
      { cmd: "# Configure env in openclaw.json (see docs)", desc: "Set 0G RPC + contract addresses" },
      { cmd: '"Analyze token 0x... on Base"', desc: "Start analyzing" },
    ],
  },
  {
    title: "Claude Code",
    steps: [
      { cmd: "git clone https://github.com/yeheskieltame/musashi.git && cd musashi", desc: "Clone repo" },
      { cmd: "make core && set -a && source .env && set +a", desc: "Build binary + load env" },
      { cmd: "/analyze 0x... on Base", desc: "Use slash commands" },
    ],
  },
  {
    title: "Frontend",
    steps: [
      { cmd: "cd frontend && pnpm install && pnpm dev", desc: "Start the dashboard" },
      { cmd: "# Connect MetaMask to 0G Mainnet", desc: "Add network: Chain ID 16661" },
      { cmd: "# Open http://localhost:3000/dashboard", desc: "Scan, analyze, publish" },
    ],
  },
];

export default function LandingPage() {
  const [activeInstall, setActiveInstall] = useState(0);

  return (
    <div className="landing-bg min-h-screen">
      {/* Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-dark rounded-full px-6 py-3 flex items-center gap-6">
        <span className="text-gradient font-bold text-lg">MUSASHI</span>
        <a href="#problem" className="text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block">Problem</a>
        <a href="#pipeline" className="text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block">Pipeline</a>
        <a href="#features" className="text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block">Features</a>
        <a href="#install" className="text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block">Install</a>
        <Link
          href="/dashboard"
          className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all"
        >
          Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 max-w-5xl mx-auto text-center">
        <Section>
          <div className="inline-block mb-6">
            <span className="text-6xl sm:text-8xl font-bold text-gradient">MUSASHI</span>
            <span className="block text-2xl sm:text-3xl text-white/40 font-light mt-2">武蔵</span>
          </div>
        </Section>

        <Section delay={100}>
          <p className="text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Conviction-weighted token intelligence.
            <br />
            <span className="text-white/90 font-medium">Find early, strike with conviction.</span>
          </p>
        </Section>

        <Section delay={200}>
          <p className="text-sm text-white/40 max-w-xl mx-auto mt-6">
            7 elimination gates. 4 specialist analyses. Adversarial debate.
            Every conviction signal on-chain. Every evidence verifiable.
          </p>
        </Section>

        {/* Metrics */}
        <Section delay={300}>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-12">
            {[
              { label: "Gates", value: "7" },
              { label: "Specialists", value: "4" },
              { label: "0G Components", value: "3" },
            ].map((m) => (
              <div key={m.label} className="glass-dark rounded-2xl p-4">
                <div className="text-2xl font-bold text-gradient">{m.value}</div>
                <div className="text-xs text-white/40 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section delay={400}>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link
              href="/dashboard"
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full px-8 py-3.5 font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5"
            >
              Open Dashboard
            </Link>
            <a
              href="https://github.com/yeheskieltame/musashi"
              target="_blank"
              rel="noopener noreferrer"
              className="glass-dark rounded-full px-8 py-3.5 text-white/70 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </Section>
      </section>

      {/* Problem */}
      <section id="problem" className="py-20 px-6 max-w-5xl mx-auto">
        <Section>
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-gradient">The Problem</span>
          </h2>
          <p className="text-center text-white/50 mb-12 max-w-xl mx-auto">
            Narrative-driven crypto traders face four critical problems
          </p>
        </Section>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: "Signal Overload", desc: "Hundreds of new tokens daily. No human cross-references contract safety, wallet behavior, social momentum, and market timing simultaneously." },
            { title: "Confirmation Bias", desc: "Find one bullish signal, stop looking. Existing tools generate signals, not eliminate them." },
            { title: "No Framework", desc: "Stock traders have P/E ratios. Meme traders have vibes and Telegram alpha calls." },
            { title: "The Specialist Problem", desc: "Social mentions +400% looks bullish. But 80% of buyers are fresh wallets. No single analyst catches this." },
          ].map((p, i) => (
            <Section key={p.title} delay={i * 100}>
              <div className="glass-dark rounded-2xl p-6 h-full">
                <h3 className="font-semibold text-white/90 mb-2">{p.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{p.desc}</p>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="py-20 px-6 max-w-5xl mx-auto">
        <Section>
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-gradient">7-Gate Pipeline</span>
          </h2>
          <p className="text-center text-white/50 mb-12 max-w-xl mx-auto">
            Sequential elimination. 97% of tokens fail. Age-tiered thresholds for early-stage discovery.
          </p>
        </Section>

        <div className="space-y-3 max-w-2xl mx-auto">
          {GATES.map((g, i) => (
            <Section key={g.num} delay={i * 75}>
              <div className="glass-dark rounded-xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-white/70 shrink-0">
                  {g.num}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white/90">{g.name}</span>
                    {!g.strict && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        age-tiered
                      </span>
                    )}
                    {g.num <= 3 || g.num >= 6 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                        Go binary
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                        AI agent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50 mt-1">{g.desc}</p>
                </div>
              </div>
            </Section>
          ))}
        </div>

        <Section delay={600}>
          <div className="max-w-2xl mx-auto mt-8 glass-dark-strong rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wider">After Gates Pass</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="glass-dark rounded-xl p-3">
                <div className="text-lg font-bold text-gradient">4</div>
                <div className="text-xs text-white/40">Specialist Analyses</div>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <div className="text-lg font-bold text-gradient">2</div>
                <div className="text-xs text-white/40">Debate Rounds</div>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <div className="text-lg font-bold text-gradient">1</div>
                <div className="text-xs text-white/40">Final Judge</div>
              </div>
            </div>
            <p className="text-xs text-white/40 text-center mt-3">
              Hesitation = FAIL. Only convergence 3/4 or 4/4 proceeds to STRIKE.
            </p>
          </div>
        </Section>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 max-w-5xl mx-auto">
        <Section>
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="text-gradient">Features</span>
          </h2>
        </Section>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Section key={f.title} delay={i * 75}>
              <div className="glass-dark rounded-2xl p-6 h-full hover:-translate-y-1 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-white/90 mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* 0G Integration */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <Section>
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-gradient">Built on 0G</span>
          </h2>
          <p className="text-center text-white/50 mb-12 max-w-xl mx-auto">
            3 core 0G components — deep integration, not surface-level
          </p>
        </Section>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              title: "0G Chain",
              subtitle: "ConvictionLog + MusashiINFT",
              desc: "STRIKE records, per-agent reputation, agent INFT identity — all on 0G Mainnet.",
              tag: "Chain ID: 16661",
            },
            {
              title: "0G Storage",
              subtitle: "Evidence Archive",
              desc: "Full analysis JSON uploaded with merkle proofs. Anyone can download and verify evidence hasn't been tampered.",
              tag: "Merkle verified",
            },
            {
              title: "INFT (ERC-7857)",
              subtitle: "Agent Identity",
              desc: "MUSASHI tokenized as Intelligent NFT. Identity + reputation + intelligence config. Clone or authorize.",
              tag: "Token #0",
            },
          ].map((c, i) => (
            <Section key={c.title} delay={i * 100}>
              <div className="glass-dark-strong rounded-2xl p-6 h-full">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white/90">{c.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    {c.tag}
                  </span>
                </div>
                <p className="text-xs text-white/40 mb-3">{c.subtitle}</p>
                <p className="text-sm text-white/50 leading-relaxed">{c.desc}</p>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* Install */}
      <section id="install" className="py-20 px-6 max-w-5xl mx-auto">
        <Section>
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-gradient">Get Started</span>
          </h2>
          <p className="text-center text-white/50 mb-8 max-w-xl mx-auto">
            Three ways to run MUSASHI — choose your runtime
          </p>
        </Section>

        <Section delay={100}>
          <div className="max-w-2xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 glass-dark rounded-full p-1 w-fit mx-auto">
              {INSTALL_STEPS.map((s, i) => (
                <button
                  key={s.title}
                  onClick={() => setActiveInstall(i)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer ${
                    activeInstall === i
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="glass-dark-strong rounded-2xl p-6 space-y-4">
              {INSTALL_STEPS[activeInstall].steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <code className="block text-sm font-mono text-white/80 bg-white/5 rounded-lg px-3 py-2">
                      {s.cmd}
                    </code>
                    <p className="text-xs text-white/40 mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gradient font-bold">MUSASHI</span>
            <span className="text-white/30 text-sm">武蔵</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="https://github.com/yeheskieltame/musashi" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">GitHub</a>
            <a href="https://chainscan.0g.ai/address/0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">ConvictionLog</a>
            <a href="https://chainscan.0g.ai/address/0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">MusashiINFT</a>
            <a href="https://docs.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">0G Docs</a>
          </div>
          <span className="text-xs text-white/20">0G APAC Hackathon 2026</span>
        </div>
      </footer>
    </div>
  );
}
