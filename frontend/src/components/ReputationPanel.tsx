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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-400">{error}</div>
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
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-white/10">
              {agent?.name?.[0] || "M"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-wide">{agent?.name || "MUSASHI"}</span>
                {agent?.active && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Active</span>
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
        <GlassCard strong className="p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-medium">Strikes</div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold text-white tracking-tight">{rep?.strikeCount ?? 0}</div>
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/10 ml-auto">
              <span className="text-blue-400 font-bold block text-xs">S</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{rep?.totalFilled ?? 0} outcomes recorded</div>
        </GlassCard>

        <GlassCard strong className="p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-medium">W / L</div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold tracking-tight">
              <span className="text-white">{rep?.wins ?? 0}</span>
              <span className="text-slate-600 mx-1.5 font-light">/</span>
              <span className="text-slate-400">{rep?.losses ?? 0}</span>
            </div>
            <div className="flex ml-auto gap-0.5 items-end h-4">
              <div className="w-1.5 h-3 bg-emerald-500/80 rounded-t-sm" />
              <div className="w-1.5 h-4 bg-purple-500/80 rounded-t-sm" />
              <div className="w-1.5 h-2 bg-red-500/80 rounded-t-sm" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            <div className="flex overflow-hidden h-1 rounded-full w-full max-w-[120px]">
               <div className="bg-emerald-500 h-full" style={{width: `${rep ? (rep.wins / rep.totalFilled)*100 : 0}%`}} />
               <div className="bg-red-500 h-full" style={{width: `${rep ? (rep.losses / rep.totalFilled)*100 : 0}%`}} />
            </div>
          </div>
        </GlassCard>

        <GlassCard strong className="p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-medium">Win Rate</div>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold tracking-tight text-white">
              {winRate.toFixed(1)}%
            </div>
            <div className="relative w-8 h-8 rounded-full border-4 border-white/5 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="16" cy="16" r="14" fill="none" stroke="url(#gradient-winrate)" strokeWidth="4" strokeDasharray={`${(winRate/100) * 88} 88`} className="transition-all duration-1000 ease-out" />
                <defs>
                   <linearGradient id="gradient-winrate" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                   </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </GlassCard>

        <GlassCard strong className="p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-medium">Total Return</div>
          <div className="flex items-center justify-between">
            <div className={`text-3xl font-bold tracking-tight ${totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(1)}%
            </div>
            <svg className={`w-5 h-5 ${totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {totalReturnPct >= 0 
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
              }
            </svg>
          </div>
        </GlassCard>
      </div>

      {/* Strike Outcome Timeline */}
      {recentStrikes.length > 0 && (
        <GlassCard strong className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Strike Outcome Timeline</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Agent learns from each outcome to calibrate future decisions
              </p>
            </div>
            <button onClick={loadData} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
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
                    className={`w-full max-w-[24px] rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                      !isFilled ? "bg-slate-700 animate-pulse border border-slate-600" :
                      isWin ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" :
                      isLoss ? "bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.3)]" :
                      "bg-slate-600"
                    }`}
                    style={{ height: `${height}px`, width: '8px' }}
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
        <GlassCard strong className="p-5 border-l-2 border-l-purple-500/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1 tracking-wide">Agent Memory Active</h4>
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
