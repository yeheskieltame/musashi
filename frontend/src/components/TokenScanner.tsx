"use client";

import { useState } from "react";
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
    if (score >= 50) return "text-blue-400";
    return "text-white/60";
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={chain}
          onChange={(e) => setChain(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-xl px-5 py-2.5 text-sm font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors focus:border-blue-500/50 appearance-none pr-10 shadow-inner"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23ffffff\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
        >
          {Object.entries(CHAIN_NAMES).map(([id, name]) => (
            <option key={id} value={id} className="bg-[#0a0e1a] text-white font-semibold">
              {name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm font-semibold text-white/70 cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={withGates}
            onChange={(e) => setWithGates(e.target.checked)}
            className="rounded accent-blue-500 w-4 h-4 border-white/20 bg-white/5 cursor-pointer"
          />
          Auto-gates top 5
        </label>

        <button
          onClick={handleScan}
          disabled={loading}
          className="relative group overflow-hidden rounded-xl bg-blue-600 border border-blue-500 backdrop-blur px-8 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:bg-blue-500 transition-all disabled:opacity-50 cursor-pointer"
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
              "Scan Now"
            )}
          </span>
        </button>

        {totalFound > 0 && (
          <span className="text-xs font-bold text-white/50 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            {totalFound} found, showing top {tokens.length}
          </span>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 shadow-inner">
          <p className="text-sm font-bold text-rose-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {tokens.length > 0 && (
        <div className="space-y-3">
          {tokens.map((t, i) => (
            <div key={`${t.address}-${t.chain_id}`} className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-black text-white/30 bg-white/10 px-2 py-0.5 rounded-md">#{i + 1}</span>
                    <span className="text-lg font-bold text-white tracking-wide truncate group-hover:text-blue-400 transition-colors">
                      {t.name}
                    </span>
                    <span className="text-sm font-semibold text-white/50">${t.symbol}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-semibold border border-white/10">
                      {t.chain}
                    </span>
                    {t.token_age && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                        {t.token_age}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/60 font-mono">
                    <span className="flex items-center gap-1"><span className="text-white/30">Price:</span> <span className="text-white">${t.price_usd}</span></span>
                    <span className="flex items-center gap-1"><span className="text-white/30">Liq:</span> <span className="text-white">${(t.liquidity_usd || 0).toLocaleString()}</span></span>
                    <span className="flex items-center gap-1"><span className="text-white/30">Vol:</span> <span className="text-white">${(t.volume_24h || 0).toLocaleString()}</span></span>
                    <span className="flex items-center gap-1"><span className="text-white/30">MCap:</span> <span className="text-white">${(t.market_cap || 0).toLocaleString()}</span></span>
                    {t.holder_count && <span className="flex items-center gap-1"><span className="text-white/30">Holders:</span> <span className="text-white">{t.holder_count}</span></span>}
                  </div>

                  {t.score_breakdown && (
                    <div className="mt-2 text-[10px] text-white/40 font-mono uppercase tracking-wider">
                      {t.score_breakdown}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-5 ml-4">
                  <div className="text-right bg-[#0a0e1a]/50 px-4 py-2 rounded-xl border border-white/5">
                    <div className={`text-2xl font-black ${scoreColor(t.score)} shadow-sm`}>
                      {t.score.toFixed(0)}
                    </div>
                    <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">score</div>
                  </div>

                  <button
                    onClick={() => onSelectToken(t.address, t.chain_id)}
                    className="text-sm font-bold bg-white/10 text-white border border-white/20 rounded-xl px-5 py-2.5 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all cursor-pointer whitespace-nowrap"
                  >
                    Run Gates
                  </button>
                </div>
              </div>

              {t.gate_result && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                      t.gate_result === "PASS"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : t.gate_result === "FAIL"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    Gates: {t.gate_result}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
