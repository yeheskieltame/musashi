"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

type Verdict = "FAIL" | "WARN" | "PASS";

interface GateSummary {
  num: number;
  name: string;
  status: Verdict | "DATA_INSUFFICIENT";
  note?: string;
}

interface Finding {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  chainId: number;
  marketCap: string;
  priceChange24h: string;
  narrative: string;
  narrativeBonus: string;
  overall: Verdict;
  headline: string;
  summary: string;
  gates: GateSummary[];
  analyzedAt: string;
}

const FINDINGS: Finding[] = [
  {
    symbol: "RAVE",
    name: "RaveDAO",
    address: "0x17205fab260a7a6383a81452ce6315a39370db97",
    chain: "Ethereum",
    chainId: 1,
    marketCap: "$2.27B",
    priceChange24h: "+224.98%",
    narrative: "Music",
    narrativeBonus: "+323.84% / 24h (top rising)",
    overall: "WARN",
    headline: "Narrative gold, community depth missing",
    summary:
      "MUSASHI's landscape layer detected a Music/Entertainment rotation (+323% / +177%) from raw category data. RAVE is the #1 trending token. Contract is clean, liquidity is real, but Gate 4 flags mixed social depth: high telegram reach without organic community metrics. Verdict: WARN, not a conviction strike.",
    gates: [
      { num: 1, name: "Contract Safety", status: "PASS", note: "10k holders, 0% tax, clean" },
      { num: 2, name: "Liquidity Structure", status: "PASS", note: "$8M TVL, scale-mature LP" },
      { num: 3, name: "Wallet Behavior", status: "PASS", note: "activity 2.41× ACCELERATING" },
      { num: 4, name: "Social Momentum", status: "WARN", note: "community depth shallow" },
      { num: 5, name: "Narrative Alignment", status: "PASS", note: "Music +323%, rank 1" },
      { num: 6, name: "Market Timing", status: "PASS" },
      { num: 7, name: "Cross-Validation", status: "PASS" },
    ],
    analyzedAt: "2026-04-13",
  },
  {
    symbol: "ARIA",
    name: "Aria.AI",
    address: "0x5d3a12c42e5372b2cc3264ab3cdcf660a1555238",
    chain: "BNB Chain",
    chainId: 56,
    marketCap: "$156M",
    priceChange24h: "−4.54%",
    narrative: "AI Gaming",
    narrativeBonus: "Gate 5 score 8/10",
    overall: "WARN",
    headline: "Strongest narrative match of the day",
    summary:
      "Trending rank 10 on CoinGecko. Narrative alignment scored 8/10 — among the highest MUSASHI has ever recorded — hitting both the AI Agents and Gaming keyword buckets. 77,827 holders, healthy wallet distribution. But price is −4.54% on the day: narrative without momentum. Verdict: WARN — watch for reaccumulation.",
    gates: [
      { num: 1, name: "Contract Safety", status: "PASS", note: "77,827 holders" },
      { num: 2, name: "Liquidity Structure", status: "PASS", note: "scale-mature LP" },
      { num: 3, name: "Wallet Behavior", status: "PASS", note: "sell_ratio 55% (elevated)" },
      { num: 4, name: "Social Momentum", status: "WARN" },
      { num: 5, name: "Narrative Alignment", status: "PASS", note: "AI Gaming 8/10" },
      { num: 6, name: "Market Timing", status: "PASS" },
      { num: 7, name: "Cross-Validation", status: "PASS" },
    ],
    analyzedAt: "2026-04-13",
  },
  {
    symbol: "PENGU",
    name: "Pudgy Penguins",
    address: "0x6418c0dd099a9fda397c766304cdd918233e8847",
    chain: "Ethereum",
    chainId: 1,
    marketCap: "$402M",
    priceChange24h: "−3.12%",
    narrative: "Meme",
    narrativeBonus: "Gate 5 score 6/10",
    overall: "FAIL",
    headline: "Active dump caught on-chain",
    summary:
      "Household name token, $402M market cap. Looks safe on the surface. Gate 2 flagged only $94K of DEX liquidity on Ethereum (most float on Solana) — extremely thin structure. Gate 3 caught the kill: 100% of last-hour trades were sells. Verdict: FAIL, do not chase the CT hype.",
    gates: [
      { num: 1, name: "Contract Safety", status: "PASS" },
      { num: 2, name: "Liquidity Structure", status: "FAIL", note: "$94K DEX liquidity on ETH" },
      { num: 3, name: "Wallet Behavior", status: "FAIL", note: "100% sells last 1h — active dump" },
      { num: 4, name: "Social Momentum", status: "WARN" },
      { num: 5, name: "Narrative Alignment", status: "PASS" },
      { num: 6, name: "Market Timing", status: "PASS" },
      { num: 7, name: "Cross-Validation", status: "PASS" },
    ],
    analyzedAt: "2026-04-13",
  },
];

function verdictBadge(v: Verdict) {
  const cfg = {
    PASS: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "STRIKE CANDIDATE", ping: "bg-emerald-400", dot: "bg-emerald-500" },
    WARN: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", label: "WARN — NO STRIKE", ping: "bg-amber-400", dot: "bg-amber-500" },
    FAIL: { bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-400", label: "FAIL — TRAP", ping: "bg-rose-400", dot: "bg-rose-500" },
  };
  const c = cfg[v];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${c.ping}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}

function gateIcon(status: GateSummary["status"]) {
  switch (status) {
    case "PASS": return <span className="text-emerald-500 font-bold text-[10px]">✓</span>;
    case "FAIL": return <span className="text-rose-500 font-bold text-[10px]">✗</span>;
    case "WARN": return <span className="text-amber-500 font-bold text-[10px]">⚠</span>;
    default: return <span className="text-white/30 font-bold text-[10px]">?</span>;
  }
}

// Hook for scroll animations
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
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

export function RecentFindings() {
  return (
    <section id="findings" className="relative py-28 px-6 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="max-w-6xl mx-auto relative z-10">
        
        <Reveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-3 py-1 mb-6 font-mono text-[10px] uppercase tracking-wider text-white/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live findings · 2026-04-13
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Three tokens CT was chasing. Three traps.</h2>
            <p className="max-w-2xl mx-auto text-sm leading-relaxed text-white/60">
              MUSASHI ran live against the top trending candidates on the day. Every verdict below is reproducible — click any card and run the same analysis yourself.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3 mb-10">
          {FINDINGS.map((f, i) => (
            <Reveal key={f.address} delay={i * 100}>
              <Link href={`/dashboard?analyze=${f.address}&chain=${f.chainId}`} className="block h-full group">
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all h-full flex flex-col p-5 relative">
                  
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1">
                        {f.chain}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-lg font-bold text-white">{f.symbol}</h3>
                        <span className="text-[10px] text-white/40">{f.name}</span>
                      </div>
                    </div>
                    {verdictBadge(f.overall)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
                      <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Market cap</div>
                      <div className="text-[11px] font-mono text-[#c9d1d9]">{f.marketCap}</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
                      <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">24h change</div>
                      <div className={`text-[11px] font-mono ${f.priceChange24h.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>
                        {f.priceChange24h}
                      </div>
                    </div>
                    <div className="col-span-2 bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
                      <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Narrative</div>
                      <div className="text-[11px] font-mono text-amber-500/90 truncate">
                        {f.narrative} <span className="text-white/30">· {f.narrativeBonus}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 flex-1">
                    <div className="text-xs font-bold text-white/90 mb-2">{f.headline}</div>
                    <p className="text-[11px] text-white/50 leading-relaxed">{f.summary}</p>
                  </div>

                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Gate pipeline</div>
                      <div className="text-[8px] font-mono text-white/30 group-hover:text-amber-400/80 transition-colors">Reproduce Analysis →</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-2 space-y-1">
                      {f.gates.map((g) => (
                        <div key={g.num} className="flex items-center gap-2 text-[9px] font-mono">
                          {gateIcon(g.status)}
                          <span className="text-white/30 w-3">G{g.num}</span>
                          <span className="text-white/70 flex-shrink-0">{g.name}</span>
                          {g.note && <span className="text-white/40 truncate">— {g.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={400}>
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 sm:p-8 text-center max-w-4xl mx-auto">
            <p className="text-xs text-white/50 leading-relaxed">
              MUSASHI&apos;s landscape layer surfaced Music <span className="text-white/90">+323.84%</span> and
              Entertainment <span className="text-white/90">+177.80%</span> as the top rising narratives from raw
              CoinGecko category data — <span className="italic text-white/70">no hardcoded keywords</span>. RAVE emerged as the #1 token inside the #1
              rising category with on-chain acceleration of <span className="text-emerald-400">2.41×</span> baseline.
              None of the three candidates cleared all seven gates.
            </p>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

