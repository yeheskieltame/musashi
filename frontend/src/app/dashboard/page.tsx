"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { CommandBar } from "@/components/CommandBar";
import { GatePipeline } from "@/components/GatePipeline";
import { TokenScanner } from "@/components/TokenScanner";
import { ReputationPanel } from "@/components/ReputationPanel";
import { StrikePublisher } from "@/components/StrikePublisher";
import { AgentChat } from "@/components/AgentChat";
import { GlassCard } from "@/components/GlassCard";
import type { PipelineResult, SearchResult } from "@/types";

type Tab = "scanner" | "gates" | "strike";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("scanner");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Gate results
  const [gateResult, setGateResult] = useState<PipelineResult | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  // Search results
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Selected token for strike
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<number>(1);

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "scanner", label: "Scanner" },
    { id: "gates", label: "Gates" },
    { id: "strike", label: "Strike" },
  ];

  return (
    <div className="dashboard-bg min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gradient font-bold text-lg hover:opacity-80 transition-opacity">
              MUSASHI
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-500">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                chatOpen
                  ? "bg-blue-600 text-white shadow-md"
                  : "glass text-slate-600 hover:bg-blue-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Agent
            </button>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main layout: content + chat panel */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Left: Dashboard content */}
        <main className={`space-y-6 min-w-0 transition-all duration-300 ${chatOpen ? "flex-1" : "w-full"}`}>
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
            <GlassCard strong className="p-4 -mt-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Search Results</h4>
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <button
                    key={`${r.address}-${r.chain}`}
                    onClick={() => handleSelectFromSearch(r)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{r.name}</span>
                      <span className="text-sm text-slate-500 ml-2">${r.symbol}</span>
                      <span className="text-xs text-slate-400 ml-2">{r.chain}</span>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {r.address.slice(0, 10)}...{r.address.slice(-6)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 font-mono">
                      <div>${r.price_usd}</div>
                      <div>Liq: ${(r.liquidity_usd || 0).toLocaleString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Tabs */}
          <div className="flex gap-1 glass rounded-full p-1 w-fit">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-600 hover:bg-blue-50/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <section>
            {activeTab === "scanner" && (
              <GlassCard strong className="p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Token Scanner</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Fetch, score, and rank token opportunities automatically. Select a token to run gate analysis.
                </p>
                <TokenScanner onSelectToken={handleSelectFromScanner} />
              </GlassCard>
            )}

            {activeTab === "gates" && (
              <GlassCard strong className="p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Gate Analysis</h2>
                {loading && (
                  <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running gates...
                  </div>
                )}

                {gateError && !loading && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-600">{gateError}</p>
                  </div>
                )}

                {gateResult && !loading && (
                  <>
                    <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm text-slate-700 truncate">
                          {gateResult.token}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            Chain: {gateResult.chain_id}
                          </span>
                          {gateResult.status === "PASS" && (
                            <button
                              onClick={() => setActiveTab("strike")}
                              className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors cursor-pointer"
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
                  <p className="text-sm text-slate-400 text-center py-8">
                    Enter a token address above or select from the Scanner to run gate analysis.
                  </p>
                )}
              </GlassCard>
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

        {/* Right: Agent Chat Panel */}
        {chatOpen && (
          <aside className="w-[420px] shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <GlassCard strong className="p-5 h-[calc(100vh-6rem)] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-slate-800">Agent Chat</h2>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <AgentChat />
              </GlassCard>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
