"use client";

import Link from "next/link";
import { GlassCard } from "./GlassCard";

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

// Findings captured 2026-04-13 during live MUSASHI runs against the top-trending
// CoinGecko candidates sitting inside the Music / Entertainment / Gaming narrative
// rotation. These are the tokens CT was chasing that day — MUSASHI flagged the
// structural risk inside each one before any retail bled out.
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
    narrativeBonus: "+323.84% / 24h (top rising category)",
    overall: "WARN",
    headline: "Narrative gold, community depth missing",
    summary:
      "MUSASHI's landscape layer detected a Music/Entertainment rotation (+323% / +177%) from raw CoinGecko category data — no hardcoded keywords. RAVE is the #1 trending token inside the #1 rising category with on-chain activity accelerating 2.41× baseline. Contract is clean, liquidity is real at scale, but Gate 4 flags mixed social depth: high telegram reach without organic CoinGecko community metrics. Verdict: WARN, not a conviction strike.",
    gates: [
      { num: 1, name: "Contract Safety", status: "PASS", note: "10,630 holders, 0% tax, clean" },
      { num: 2, name: "Liquidity Structure", status: "PASS", note: "$8M TVL, scale-mature LP" },
      { num: 3, name: "Wallet Behavior", status: "PASS", note: "activity_trend 2.41× ACCELERATING, 59% buys" },
      { num: 4, name: "Social Momentum", status: "WARN", note: "community depth shallow vs narrative velocity" },
      { num: 5, name: "Narrative Alignment", status: "PASS", note: "Music +323%, trending rank 1" },
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
      "Trending rank 10 on CoinGecko. Narrative alignment scored 8/10 — among the highest MUSASHI has ever recorded — hitting both the AI Agents and Gaming keyword buckets. 77,827 holders, healthy wallet distribution, no honeypot. But price is −4.54% on the day: narrative without momentum. Verdict: WARN — watch for reaccumulation before entry.",
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
    name: "Pudgy Penguins (ETH)",
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
      "Household name token, $402M market cap. Looks safe on the surface. MUSASHI ran the pipeline anyway. Gate 2 flagged only $94K of DEX liquidity on Ethereum (most of the real float lives on Solana) — thin structure for a token that size. Gate 3 caught the kill: 100% of last-hour trades were sells. Dump in progress. Verdict: FAIL, do not chase the CT hype.",
    gates: [
      { num: 1, name: "Contract Safety", status: "PASS" },
      { num: 2, name: "Liquidity Structure", status: "FAIL", note: "only $94K DEX liquidity on ETH" },
      { num: 3, name: "Wallet Behavior", status: "FAIL", note: "100% sells in last 1h — active dump" },
      { num: 4, name: "Social Momentum", status: "WARN" },
      { num: 5, name: "Narrative Alignment", status: "PASS" },
      { num: 6, name: "Market Timing", status: "PASS" },
      { num: 7, name: "Cross-Validation", status: "PASS" },
    ],
    analyzedAt: "2026-04-13",
  },
];

function verdictBadge(v: Verdict) {
  const cfg: Record<Verdict, { bg: string; text: string; label: string }> = {
    PASS: { bg: "bg-emerald-500/15 border-emerald-500/40", text: "text-emerald-300", label: "STRIKE CANDIDATE" },
    WARN: { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-300", label: "WARN — NO STRIKE" },
    FAIL: { bg: "bg-rose-500/15 border-rose-500/40", text: "text-rose-300", label: "FAIL — TRAP" },
  };
  const c = cfg[v];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${v === "FAIL" ? "bg-rose-400" : v === "WARN" ? "bg-amber-400" : "bg-emerald-400"}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${v === "FAIL" ? "bg-rose-400" : v === "WARN" ? "bg-amber-400" : "bg-emerald-400"}`} />
      </span>
      {c.label}
    </span>
  );
}

function gateIcon(status: GateSummary["status"]) {
  switch (status) {
    case "PASS":
      return <span className="text-emerald-400">✓</span>;
    case "FAIL":
      return <span className="text-rose-400">✗</span>;
    case "WARN":
      return <span className="text-amber-400">⚠</span>;
    default:
      return <span className="text-slate-500">?</span>;
  }
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function RecentFindings() {
  return (
    <section id="findings" className="relative py-28 px-6 overflow-hidden">
      <div className="mx-auto max-w-6xl relative">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 px-4 py-1.5 mb-5 font-mono text-[11px] uppercase tracking-wider text-amber-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            Live findings · 2026-04-13
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight">
            Three tokens CT was chasing. Three traps.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            MUSASHI ran live against the top trending candidates on the day. Every verdict below is reproducible — click any card and run the same analysis yourself.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {FINDINGS.map((f) => (
            <GlassCard
              key={f.address}
              hover
              className="flex flex-col p-6 min-h-[560px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                    {f.chain}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-white">{f.symbol}</h3>
                    <span className="text-sm text-slate-400">{f.name}</span>
                  </div>
                </div>
                {verdictBadge(f.overall)}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-0.5">Market cap</div>
                  <div className="text-white">{f.marketCap}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-0.5">24h change</div>
                  <div className={f.priceChange24h.startsWith("+") ? "text-emerald-300" : "text-rose-300"}>
                    {f.priceChange24h}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500 uppercase tracking-wider mb-0.5">Narrative</div>
                  <div className="text-amber-300">
                    {f.narrative} <span className="text-slate-500">· {f.narrativeBonus}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-semibold text-white mb-2">{f.headline}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{f.summary}</p>
              </div>

              <div className="mt-auto">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Gate pipeline
                </div>
                <div className="grid grid-cols-1 gap-1 mb-4">
                  {f.gates.map((g) => (
                    <div key={g.num} className="flex items-center gap-2 text-[11px] font-mono">
                      {gateIcon(g.status)}
                      <span className="text-slate-400 w-4">G{g.num}</span>
                      <span className="text-slate-300">{g.name}</span>
                      {g.note && <span className="text-slate-500 truncate">— {g.note}</span>}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <Link
                    href={`/dashboard?analyze=${f.address}&chain=${f.chainId}`}
                    className="text-[11px] font-mono text-amber-300 hover:text-amber-200 underline underline-offset-2"
                  >
                    Reproduce in dashboard →
                  </Link>
                  <span className="text-[10px] font-mono text-slate-600">
                    {shortAddress(f.address)}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs font-mono text-slate-500 max-w-2xl mx-auto">
            MUSASHI&apos;s landscape layer surfaced Music <span className="text-amber-300">+323.84%</span> and
            Entertainment <span className="text-amber-300">+177.80%</span> as the top rising narratives from raw
            CoinGecko category data — <em>no hardcoded keywords</em>. RAVE emerged as the #1 token inside the #1
            rising category with on-chain acceleration of <span className="text-amber-300">2.41×</span> baseline.
            None of the three candidates cleared all seven gates.
          </p>
        </div>
      </div>
    </section>
  );
}
