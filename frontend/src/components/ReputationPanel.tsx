"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import type { ReputationResult, AgentInfo } from "@/types";

export function ReputationPanel() {
  const [rep, setRep] = useState<ReputationResult | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [repRes, agentRes] = await Promise.all([
          fetch("/api/status"),
          fetch("/api/agent-info?tokenId=0"),
        ]);
        const repData = await repRes.json();
        const agentData = await agentRes.json();
        if (!repData.error) setRep(repData);
        if (!agentData.error) setAgent(agentData);
        if (repData.error && agentData.error) {
          setError("Could not load reputation data. The backend may be unreachable.");
        }
      } catch {
        setError("Failed to connect to the API. Check that the backend is running.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading reputation...
      </div>
    );
  }

  if (error && !rep && !agent) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
        {error}
      </div>
    );
  }

  const winRate = rep && rep.total_filled > 0
    ? ((rep.wins / rep.total_filled) * 100).toFixed(1)
    : "0.0";

  const totalReturnPct = rep
    ? (rep.total_return_bps / 100).toFixed(2)
    : "0.00";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <GlassCard strong className="p-4 text-center">
        <div className="text-2xl font-bold text-slate-800">
          {rep?.strike_count ?? 0}
        </div>
        <div className="text-xs text-slate-500 mt-1">Total Strikes</div>
      </GlassCard>

      <GlassCard strong className="p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600">
          {rep?.wins ?? 0}
          <span className="text-red-500 text-lg">/{rep?.losses ?? 0}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">W / L</div>
      </GlassCard>

      <GlassCard strong className="p-4 text-center">
        <div className="text-2xl font-bold text-blue-600">{winRate}%</div>
        <div className="text-xs text-slate-500 mt-1">Win Rate</div>
      </GlassCard>

      <GlassCard strong className="p-4 text-center">
        <div
          className={`text-2xl font-bold ${
            Number(totalReturnPct) >= 0 ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {Number(totalReturnPct) >= 0 ? "+" : ""}
          {totalReturnPct}%
        </div>
        <div className="text-xs text-slate-500 mt-1">Total Return</div>
      </GlassCard>

      {agent && (
        <GlassCard strong className="col-span-2 sm:col-span-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                {agent.name?.[0] || "M"}
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  {agent.name || "MUSASHI"}
                  {agent.active && (
                    <span className="ml-2 text-xs text-emerald-500">Active</span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Token #{agent.token_id} &middot; {agent.total_strikes} strikes
                </div>
              </div>
            </div>
            {agent.explorer_url && (
              <a
                href={agent.explorer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                View on Explorer
              </a>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
