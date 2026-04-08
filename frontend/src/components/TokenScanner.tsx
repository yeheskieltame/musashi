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
  const [withGates, setWithGates] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  async function handleScan() {
    setLoading(true);
    setTokens([]);
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
    } catch {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }

  function scoreColor(score: number) {
    if (score >= 70) return "text-emerald-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-500";
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={chain}
          onChange={(e) => setChain(Number(e.target.value))}
          className="glass-strong rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none cursor-pointer"
        >
          {Object.entries(CHAIN_NAMES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={withGates}
            onChange={(e) => setWithGates(e.target.checked)}
            className="rounded accent-blue-600"
          />
          Auto-gates top 5
        </label>

        <button
          onClick={handleScan}
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 cursor-pointer"
        >
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
        </button>

        {totalFound > 0 && (
          <span className="text-xs text-slate-500">
            {totalFound} found, showing top {tokens.length}
          </span>
        )}
      </div>

      {/* Results */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.map((t, i) => (
            <GlassCard key={`${t.address}-${t.chain_id}`} hover className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                    <span className="font-semibold text-slate-800 truncate">
                      {t.name}
                    </span>
                    <span className="text-sm text-slate-500">${t.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {t.chain}
                    </span>
                    {t.token_age && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {t.token_age}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                    <span>Price: ${t.price_usd}</span>
                    <span>Liq: ${(t.liquidity_usd || 0).toLocaleString()}</span>
                    <span>Vol: ${(t.volume_24h || 0).toLocaleString()}</span>
                    <span>MCap: ${(t.market_cap || 0).toLocaleString()}</span>
                    {t.holder_count && <span>Holders: {t.holder_count}</span>}
                  </div>

                  {t.score_breakdown && (
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      {t.score_breakdown}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className={`text-xl font-bold ${scoreColor(t.score)}`}>
                      {t.score.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase">score</div>
                  </div>

                  <button
                    onClick={() => onSelectToken(t.address, t.chain_id)}
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Run Gates
                  </button>
                </div>
              </div>

              {t.gate_result && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span
                    className={`text-xs font-bold ${
                      t.gate_result === "PASS"
                        ? "text-emerald-600"
                        : t.gate_result === "FAIL"
                          ? "text-red-500"
                          : "text-amber-500"
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
