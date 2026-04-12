"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { GlassCard } from "./GlassCard";
import {
  CONVICTION_LOG_ADDRESS,
  CONVICTION_LOG_ABI,
  OG_RPC,
  OG_EXPLORER,
  OG_CHAIN_ID,
} from "@/lib/contracts";
import type { AgentInfo } from "@/types";

const ogChain = {
  id: OG_CHAIN_ID,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "A0GI", decimals: 18 },
  rpcUrls: { default: { http: [OG_RPC] } },
} as const;

const client = createPublicClient({
  chain: ogChain,
  transport: http(OG_RPC),
});

interface Strike {
  id: number;
  token: string;
  convergence: number;
  outcomeFilled: boolean;
  outcomeBps: number;
  timestamp: number;
  chainId: number;
}

interface RepData {
  strikeCount: number;
  totalFilled: number;
  wins: number;
  losses: number;
  totalReturnBps: number;
}

function calibrationStatus(winRate: number, totalFilled: number): { label: string; color: string; desc: string } {
  if (totalFilled < 3) return { label: "Calibrating", color: "text-amber-500", desc: "Building track record..." };
  if (winRate >= 70) return { label: "Well-Tuned", color: "text-emerald-500", desc: "Conviction threshold calibrated" };
  if (winRate >= 50) return { label: "Adjusting", color: "text-blue-500", desc: "Tightening conviction threshold" };
  return { label: "Recalibrating", color: "text-red-500", desc: "Applying maximum hesitation" };
}

export function ReputationPanel() {
  const [rep, setRep] = useState<RepData | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [recentStrikes, setRecentStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch reputation from on-chain
      const [countResult, repResult, agentRes] = await Promise.all([
        client.readContract({
          address: CONVICTION_LOG_ADDRESS,
          abi: CONVICTION_LOG_ABI,
          functionName: "strikeCount",
        }),
        client.readContract({
          address: CONVICTION_LOG_ADDRESS,
          abi: CONVICTION_LOG_ABI,
          functionName: "agentReputation",
          args: [BigInt(0)],
        }),
        fetch("/api/agent-info?tokenId=0").then(r => r.json()).catch(() => null),
      ]);

      const total = Number(countResult);
      const r = repResult as [bigint, bigint, bigint, bigint, bigint];

      setRep({
        strikeCount: total,
        totalFilled: Number(r[1]),
        wins: Number(r[2]),
        losses: Number(r[3]),
        totalReturnBps: Number(r[4]),
      });

      if (agentRes && !agentRes.error) setAgent(agentRes);

      // Fetch recent strikes for timeline
      if (total > 0) {
        const start = Math.max(0, total - 12);
        const promises = [];
        for (let i = total - 1; i >= start; i--) {
          promises.push(
            client.readContract({
              address: CONVICTION_LOG_ADDRESS,
              abi: CONVICTION_LOG_ABI,
              functionName: "getStrike",
              args: [BigInt(i)],
            }).then((result) => {
              const s = result as {
                token: string;
                convergence: number;
                outcomeFilled: boolean;
                outcomeBps: bigint | number;
                timestamp: bigint | number;
                chainId: bigint | number;
              };
              return {
                id: i,
                token: String(s.token),
                convergence: Number(s.convergence),
                outcomeFilled: Boolean(s.outcomeFilled),
                outcomeBps: Number(s.outcomeBps),
                timestamp: Number(s.timestamp),
                chainId: Number(s.chainId),
              } satisfies Strike;
            })
          );
        }
        const results = await Promise.all(promises);
        setRecentStrikes(results);
      }
    } catch {
      setError("Failed to load reputation data from 0G Chain.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <GlassCard strong className="p-7">
        <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm">Loading agent memory from 0G Chain...</span>
        </div>
      </GlassCard>
    );
  }

  if (error && !rep) {
    return (
      <GlassCard strong className="p-7">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">{error}</div>
      </GlassCard>
    );
  }

  const winRate = rep && rep.totalFilled > 0
    ? (rep.wins / rep.totalFilled) * 100
    : 0;
  const totalReturnPct = rep ? rep.totalReturnBps / 100 : 0;
  const calibration = calibrationStatus(winRate, rep?.totalFilled ?? 0);
  const filledStrikes = recentStrikes.filter(s => s.outcomeFilled);
  const pendingStrikes = recentStrikes.filter(s => !s.outcomeFilled);

  return (
    <div className="space-y-4">
      {/* Agent Identity + Calibration Status */}
      <GlassCard strong className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
              {agent?.name?.[0] || "M"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{agent?.name || "MUSASHI"}</span>
                {agent?.active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                INFT #0 on 0G Chain
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${calibration.color}`}>
              {calibration.label}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{calibration.desc}</div>
          </div>
        </div>
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard strong className="p-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Strikes</div>
          <div className="text-2xl font-bold text-slate-800">{rep?.strikeCount ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{rep?.totalFilled ?? 0} outcomes recorded</div>
        </GlassCard>

        <GlassCard strong className="p-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">W / L</div>
          <div className="text-2xl font-bold">
            <span className="text-emerald-600">{rep?.wins ?? 0}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-red-500">{rep?.losses ?? 0}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{pendingStrikes.length} pending</div>
        </GlassCard>

        <GlassCard strong className="p-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Win Rate</div>
          <div className={`text-2xl font-bold ${winRate >= 60 ? "text-emerald-600" : winRate >= 40 ? "text-blue-600" : "text-red-500"}`}>
            {winRate.toFixed(1)}%
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${winRate >= 60 ? "bg-emerald-500" : winRate >= 40 ? "bg-blue-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(winRate, 100)}%` }}
            />
          </div>
        </GlassCard>

        <GlassCard strong className="p-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Total Return</div>
          <div className={`text-2xl font-bold ${totalReturnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{rep?.totalReturnBps ?? 0} bps cumulative</div>
        </GlassCard>
      </div>

      {/* Strike Outcome Timeline */}
      {recentStrikes.length > 0 && (
        <GlassCard strong className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Strike Outcome Timeline</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Agent learns from each outcome to calibrate future decisions
              </p>
            </div>
            <button onClick={loadData} className="text-xs px-3 py-1.5 rounded-lg glass text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
              Refresh
            </button>
          </div>

          {/* Visual timeline */}
          <div className="flex items-end gap-1 h-24 mb-3">
            {recentStrikes.slice().reverse().map((s) => {
              const isFilled = s.outcomeFilled;
              const isWin = s.outcomeBps > 0;
              const isLoss = s.outcomeBps < 0;
              const height = isFilled
                ? Math.min(Math.max(Math.abs(s.outcomeBps) / 50, 15), 100)
                : 30;

              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className={`w-full max-w-[24px] rounded-t-sm transition-all duration-300 ${
                      !isFilled ? "bg-slate-200 animate-pulse" :
                      isWin ? "bg-emerald-400" :
                      isLoss ? "bg-red-400" :
                      "bg-slate-300"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-[8px] text-slate-400 font-mono">#{s.id}</div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                      <div className="font-semibold">Strike #{s.id}</div>
                      <div className="text-white/70 mt-0.5">
                        {isFilled
                          ? `${isWin ? "+" : ""}${(s.outcomeBps / 100).toFixed(1)}% ${isWin ? "WIN" : isLoss ? "LOSS" : "NEUTRAL"}`
                          : "Awaiting outcome"}
                      </div>
                      <div className="text-white/50">Convergence: {s.convergence}/4</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span>Win</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
              <span>Loss</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
              <span>Pending</span>
            </div>
            <div className="ml-auto">
              <span className="text-slate-500">Learning from {filledStrikes.length} outcomes</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Learning Insight */}
      {rep && rep.totalFilled >= 3 && (
        <GlassCard strong className="p-5 border-l-2 border-l-blue-500">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-1">Agent Memory Active</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {winRate >= 70
                  ? `With a ${winRate.toFixed(0)}% win rate across ${rep.totalFilled} outcomes, the judge maintains its current conviction threshold. Strong calibration.`
                  : winRate >= 50
                  ? `Win rate at ${winRate.toFixed(0)}% across ${rep.totalFilled} outcomes. The judge is tightening its conviction threshold — requiring stronger convergence for PASS decisions.`
                  : `Win rate at ${winRate.toFixed(0)}% across ${rep.totalFilled} outcomes. The judge has entered maximum hesitation mode — only 4/4 convergence with pristine fundamentals will PASS.`
                }
                {" "}All data is on-chain and verifiable on{" "}
                <a href={`${OG_EXPLORER}/address/${CONVICTION_LOG_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  0G Explorer
                </a>.
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
