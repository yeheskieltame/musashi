"use client";

import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { CHAIN_NAMES } from "@/types";
import type { ScanToken } from "@/types";

interface Props {
  onSelectToken: (address: string, chainId: number) => void;
}

export function TokenScanner({ onSelectToken }: Props) {
  const [chain, setChain] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<ScanToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [withGates, setWithGates] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  async function handleScan() {
    setLoading(true);
    setTokens([]);
    setError(null);
    try {
      const params = new URLSearchParams({
        chain: String(chain),
        limit: "10",
        gates: String(withGates),
      });
      const res = await fetch(`/api/scan?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTokens(data.top_picks || []);
      setTotalFound(data.total_found || 0);
    } catch (e: unknown) {
      setTokens([]);
      setError(e instanceof Error ? e.message : "Scan failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function scoreColor(score: number) {
    if (score >= 70) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={chain}
          onChange={(e) => setChain(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer hover:bg-white/10 transition-colors focus:border-purple-500/50 appearance-none pr-8 relative"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23a1a1aa\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
        >
          {Object.entries(CHAIN_NAMES).map(([id, name]) => (
            <option key={id} value={id} className="bg-slate-900 text-white">
              {name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={withGates}
            onChange={(e) => setWithGates(e.target.checked)}
            className="rounded accent-purple-500 border-white/20 bg-white/5"
          />
          Auto-gates top 5
        </label>

        <button
          onClick={handleScan}
          disabled={loading}
          className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all disabled:opacity-50 cursor-pointer"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </span>
            ) : (
              "Scan"
            )}
          </span>
        </button>

        {totalFound > 0 && (
          <span className="text-xs text-slate-400">
            {totalFound} found, showing top {tokens.length}
          </span>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.map((t, i) => (
            <GlassCard key={`${t.address}-${t.chain_id}`} hover className="p-4 bg-white/[0.02]">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                    <span className="font-semibold text-white tracking-wide truncate">
                      {t.name}
                    </span>
                    <span className="text-sm text-slate-400">${t.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/5">
                      {t.chain}
                    </span>
                    {t.token_age && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t.token_age}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                    <span>Price: ${t.price_usd}</span>
                    <span>Liq: ${(t.liquidity_usd || 0).toLocaleString()}</span>
                    <span>Vol: ${(t.volume_24h || 0).toLocaleString()}</span>
                    <span>MCap: ${(t.market_cap || 0).toLocaleString()}</span>
                    {t.holder_count && <span>Holders: {t.holder_count}</span>}
                  </div>

                  {t.score_breakdown && (
                    <div className="mt-1 text-xs text-slate-500 font-mono">
                      {t.score_breakdown}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className={`text-xl font-bold ${scoreColor(t.score)} shadow-sm`}>
                      {t.score.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">score</div>
                  </div>

                  <button
                    onClick={() => onSelectToken(t.address, t.chain_id)}
                    className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-2 hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all cursor-pointer whitespace-nowrap font-medium"
                  >
                    Run Gates
                  </button>
                </div>
              </div>

              {t.gate_result && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span
                    className={`text-xs font-bold ${
                      t.gate_result === "PASS"
                        ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : t.gate_result === "FAIL"
                          ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                          : "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    }`}
                  >
                    Gates: {t.gate_result}
                  </span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
