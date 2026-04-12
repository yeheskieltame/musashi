"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { CommandBar } from "@/components/CommandBar";
import { GatePipeline } from "@/components/GatePipeline";
import { TokenScanner } from "@/components/TokenScanner";
import { ReputationPanel } from "@/components/ReputationPanel";
import { AgentIntelligencePanel } from "@/components/AgentIntelligencePanel";
import { StrikePublisher } from "@/components/StrikePublisher";
import { StrikeLedger } from "@/components/StrikeLedger";
import { DebateTerminal } from "@/components/DebateTerminal";
import { GlassCard } from "@/components/GlassCard";
import type { PipelineResult, SearchResult, DebateVerdict } from "@/types";

type Tab = "scanner" | "gates" | "debate" | "ledger" | "strike";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("scanner");
  const [loading, setLoading] = useState(false);

  // Gate results
  const [gateResult, setGateResult] = useState<PipelineResult | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  // Search results
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Selected token for strike
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<number>(1);

  // Debate
  const [debateToken, setDebateToken] = useState<string | null>(null);
  const [debateChain, setDebateChain] = useState<number>(1);
  const [debateVerdict, setDebateVerdict] = useState<DebateVerdict | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setShowSearch(true);
    setGateResult(null);
    setGateError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setSearchResults([]);
      setGateError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGates = useCallback(async (token: string, chain: number) => {
    setLoading(true);
    setShowSearch(false);
    setGateResult(null);
    setGateError(null);
    setSelectedToken(token);
    setSelectedChain(chain);
    setActiveTab("gates");
    try {
      const res = await fetch(`/api/gates?token=${token}&chain=${chain}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGateResult(data);
    } catch (e: unknown) {
      setGateError(e instanceof Error ? e.message : "Gate check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectFromScanner = useCallback((address: string, chainId: number) => {
    handleGates(address, chainId);
  }, [handleGates]);

  const handleSelectFromSearch = useCallback((result: SearchResult) => {
    setShowSearch(false);
    const chainMap: Record<string, number> = {
      ethereum: 1, bsc: 56, polygon: 137, arbitrum: 42161, base: 8453,
    };
    const chain = chainMap[result.chain] || 1;
    handleGates(result.address, chain);
  }, [handleGates]);

  const handleStartDebate = useCallback((token: string, chain: number) => {
    setDebateToken(token);
    setDebateChain(chain);
    setDebateVerdict(null);
    setActiveTab("debate");
  }, []);

  const handleDebateComplete = useCallback((result: DebateVerdict) => {
    setDebateVerdict(result);
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "scanner", label: "Scanner", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
    { id: "gates", label: "Gates", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { id: "debate", label: "Debate", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { id: "ledger", label: "Ledger", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { id: "strike", label: "Strike", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  ];

  return (
    <div className="dashboard-bg min-h-screen grid-bg-dark glow-top glow-bottom relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-20 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/70 via-[#030303]/80 to-[#030303]" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-white/5">
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/musashi-logo.png" alt="MUSASHI" className="w-5 h-5" />
              <span className="text-white font-bold text-lg tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">MUSASHI <span className="font-light text-white/50 ml-1">武蔵</span></span>
            </Link>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <span className="text-sm font-medium text-slate-400 hidden sm:block">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
        <main className="space-y-6">
          {/* ERC-7857 Intelligence state (encrypted storage + sealed key + oracle) */}
          <section>
            <AgentIntelligencePanel tokenId={0} />
          </section>

          {/* Reputation */}
          <section>
            <ReputationPanel />
          </section>

          {/* Command Bar */}
          <section>
            <CommandBar onSearch={handleSearch} onGates={handleGates} loading={loading} />
          </section>

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <GlassCard strong className="p-5 -mt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Search Results</h4>
              <div className="space-y-1">
                {searchResults.map((r) => (
                  <button
                    key={`${r.address}-${r.chain}`}
                    onClick={() => handleSelectFromSearch(r)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{r.name}</span>
                      <span className="text-sm text-slate-400 ml-2">${r.symbol}</span>
                      <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{r.chain}</span>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {r.address.slice(0, 10)}...{r.address.slice(-6)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 font-mono">
                      <div>${r.price_usd}</div>
                      <div className="text-slate-400">Liq: ${(r.liquidity_usd || 0).toLocaleString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Tabs */}
          <div className="flex overflow-x-auto sm:overflow-visible gap-1 glass-strong rounded-full p-1.5 w-fit max-w-[95vw] sm:max-w-full mx-auto border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.1)] relative z-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content — all tabs stay mounted, hidden via CSS to preserve state */}
          <section>
            <div className={activeTab === "scanner" ? "" : "hidden"}>
              <GlassCard strong className="p-7">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/20 flex items-center justify-center border border-zinc-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white tracking-wide">Token Scanner</h2>
                    <p className="text-sm text-slate-400">
                      Fetch, score, and rank token opportunities automatically.
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <TokenScanner onSelectToken={handleSelectFromScanner} />
                </div>
              </GlassCard>
            </div>

            {activeTab === "gates" && (
              <GlassCard strong className="p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/20 flex items-center justify-center border border-zinc-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-white tracking-wide">Gate Analysis</h2>
                </div>

                {loading && (
                  <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                    <span className="text-sm">Running elimination gates...</span>
                  </div>
                )}

                {gateError && !loading && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <p className="text-sm text-amber-400">{gateError}</p>
                  </div>
                )}

                {gateResult && !loading && (
                  <>
                    <div className="mb-5 p-4 glass rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm text-slate-600 truncate">
                          {gateResult.token}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                            Chain: {gateResult.chain_id}
                          </span>
                          <button
                            onClick={() => handleStartDebate(gateResult.token, gateResult.chain_id)}
                            className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1.5 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all cursor-pointer font-medium"
                          >
                            Run Debate
                          </button>
                          {gateResult.status === "PASS" && (
                            <button
                              onClick={() => setActiveTab("strike")}
                              className="text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 rounded-lg px-3 py-1.5 hover:bg-zinc-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer font-medium"
                            >
                              Publish STRIKE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <GatePipeline
                      gates={gateResult.gates}
                      tokenAge={gateResult.token_age}
                      overallStatus={gateResult.status}
                    />
                  </>
                )}

                {!gateResult && !loading && !gateError && (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                      <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400">
                      Enter a token address above or select from the Scanner to run gate analysis.
                    </p>
                  </div>
                )}
              </GlassCard>
            )}

            <div className={activeTab === "debate" ? "" : "hidden"}>
              {debateToken ? (
                <DebateTerminal
                  token={debateToken}
                  chain={debateChain}
                  onComplete={handleDebateComplete}
                />
              ) : (
                <GlassCard strong className="p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white tracking-wide">Multi-Agent Debate</h2>
                  </div>
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                      <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Run gate analysis on a token first, then click "Run Debate" to launch
                      4 specialist AI agents (Sonnet) + 1 Opus Judge for full conviction analysis.
                    </p>
                  </div>
                </GlassCard>
              )}
            </div>

            {activeTab === "ledger" && (
              <StrikeLedger />
            )}

            {activeTab === "strike" && (
              <StrikePublisher
                token={selectedToken ?? undefined}
                chainId={selectedChain}
                convergence={gateResult?.status === "PASS" ? 3 : undefined}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
