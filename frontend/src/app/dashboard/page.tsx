"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  // Auto-run gates when dashboard is opened with ?analyze=<addr>&chain=<id>.
  // Lets landing-page "Recent Findings" cards deep-link into a live pipeline
  // run. Guarded so it only fires once per mount.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("analyze");
    if (!token || !/^0x[a-fA-F0-9]{40}$/.test(token)) return;
    const chainParam = params.get("chain");
    const chain = chainParam ? Number.parseInt(chainParam, 10) : 1;
    if (!Number.isFinite(chain) || chain <= 0) return;
    autoRanRef.current = true;
    handleGates(token, chain);
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
    { id: "strike", label: "Strike", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { id: "ledger", label: "Ledger", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  ];

  return (
    <div className="landing-bg min-h-screen relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#0a0e1a]/80" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/95 backdrop-blur-md border-b border-white/10 shadow-lg shadow-zinc-900/40 animate-fade-in [animation-duration:500ms]">
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/musashi-logo.png" alt="MUSASHI" className="w-6 h-6" />
              <span className="text-white font-bold text-lg tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">MUSASHI <span className="font-light text-white/50 ml-1">武蔵</span></span>
            </Link>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <span className="text-sm font-semibold text-white/80 hidden sm:block uppercase tracking-wider">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main content - Expanding to 1400px max-width to accommodate side-by-side grid */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Main Interactive Workspace (Col Span 8) */}
          <div className="xl:col-span-8 space-y-8 flex flex-col">
            
            {/* Command Bar (Action Entry Point) */}
            <section className="animate-slide-up [animation-duration:600ms] [animation-fill-mode:backwards]">
              <CommandBar onSearch={handleSearch} onGates={handleGates} loading={loading} />
            </section>

            {/* Search Results Dropdown */}
            {showSearch && searchResults.length > 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 -mt-4 shadow-xl backdrop-blur-md animate-fade-in z-20">
                <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">Search Results</h4>
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.address}-${r.chain}`}
                      onClick={() => handleSelectFromSearch(r)}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{r.name}</span>
                        <span className="text-sm text-white/50 ml-2 font-mono">${r.symbol}</span>
                        <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5">{r.chain}</span>
                        <div className="text-xs font-mono text-white/40 mt-1">
                          {r.address.slice(0, 10)}...{r.address.slice(-6)}
                        </div>
                      </div>
                      <div className="text-right text-xs text-white/60 font-mono">
                        <div className="text-white font-bold">${r.price_usd}</div>
                        <div className="text-white/40 mt-0.5">Liq: ${(r.liquidity_usd || 0).toLocaleString()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Tabs Navigation */}
            <div className="flex justify-center sm:justify-start">
              <div className="flex overflow-x-auto sm:overflow-visible gap-2 bg-white/[0.02] border border-white/5 shadow-lg rounded-full p-1.5 w-max max-w-[95vw] backdrop-blur-md relative z-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-slide-up [animation-duration:600ms] [animation-delay:150ms] [animation-fill-mode:backwards]">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === t.id
                        ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/10"
                        : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Workspace Views */}
            <section className="animate-slide-up [animation-duration:600ms] [animation-delay:300ms] [animation-fill-mode:backwards] flex-grow">
              
              <div className={activeTab === "scanner" ? "animate-fade-in h-full" : "hidden"}>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-wide">Token Scanner</h2>
                      <p className="text-sm text-white/50">
                        Fetch, score, and rank token opportunities automatically.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <TokenScanner onSelectToken={handleSelectFromScanner} />
                  </div>
                </div>
              </div>

              {activeTab === "gates" && (
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md animate-fade-in min-h-[500px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Gate Analysis</h2>
                  </div>

                  {loading && (
                    <div className="flex flex-col items-center gap-4 text-white/60 py-24 justify-center">
                      <div className="w-8 h-8 rounded-full border-[3px] border-emerald-500/30 border-t-emerald-400 animate-spin" />
                      <span className="text-sm font-bold tracking-widest uppercase">Running elimination gates...</span>
                    </div>
                  )}

                  {gateError && !loading && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 shadow-inner">
                      <p className="text-sm font-bold text-rose-400">{gateError}</p>
                    </div>
                  )}

                  {gateResult && !loading && (
                    <>
                      <div className="mb-6 p-5 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="font-mono text-sm text-white/70 font-semibold truncate w-full sm:w-auto">
                          {gateResult.token}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs px-3 py-1 bg-white/10 text-white font-semibold rounded-full border border-white/10">
                            Chain: {gateResult.chain_id}
                          </span>
                          <button
                            onClick={() => handleStartDebate(gateResult.token, gateResult.chain_id)}
                            className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl px-4 py-2 hover:bg-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Run Debate
                          </button>
                          {gateResult.status === "PASS" && (
                            <button
                              onClick={() => setActiveTab("strike")}
                              className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl px-4 py-2 hover:bg-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer uppercase tracking-wider"
                            >
                              Publish STRIKE
                            </button>
                          )}
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
                    <div className="text-center py-20 bg-white/[0.01] rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-bold text-white/50 max-w-sm uppercase tracking-wide leading-relaxed">
                        Enter a token address above or select from the Scanner to run gate analysis.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className={activeTab === "debate" ? "animate-fade-in" : "hidden"}>
                {debateToken ? (
                  <DebateTerminal
                    token={debateToken}
                    chain={debateChain}
                    onComplete={handleDebateComplete}
                  />
                ) : (
                  <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md min-h-[500px]">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-wide">Multi-Agent Debate</h2>
                    </div>
                    <div className="text-center py-20 bg-white/[0.01] rounded-2xl border border-white/5">
                      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
                        <svg className="w-8 h-8 text-violet-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-bold text-white/50 max-w-md mx-auto uppercase tracking-wide leading-relaxed">
                        Run gate analysis on a token first, then click <span className="text-white/80">"Run Debate"</span> to launch
                        specialist AI agents and Opus Judge.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {activeTab === "ledger" && (
                <div className="animate-fade-in"><StrikeLedger /></div>
              )}

              {activeTab === "strike" && (
                <div className="animate-fade-in"><StrikePublisher
                  token={selectedToken ?? undefined}
                  chainId={selectedChain}
                  convergence={gateResult?.status === "PASS" ? 3 : undefined}
                /></div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: Sidebar (Context & Stats) (Col Span 4) */}
          <div className="xl:col-span-4 space-y-8 flex flex-col pt-8 xl:pt-0">
            {/* Reputation (Shifted to Sidebar, placed above INFT state) */}
            <section className="animate-slide-up [animation-duration:600ms] [animation-delay:450ms] [animation-fill-mode:backwards]">
              <div className="sticky top-[88px] space-y-8 pb-10">
                <ReputationPanel />
              </div>
            </section>
          </div>
          
          {/* BOTTOM COLUMN: Full Width / Span 12 */}
          <div className="xl:col-span-12 border-t border-white/5 pt-8 mt-4">
            <section className="animate-slide-up [animation-duration:600ms] [animation-delay:600ms] [animation-fill-mode:backwards]">
                <AgentIntelligencePanel tokenId={0} />
            </section>
          </div>
          
        </main>
      </div>
    </div>
  );
}
