"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http } from "viem";
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
  if (totalFilled < 3) return { label: "Calibrating", color: "text-blue-400", desc: "Building track record..." };
  if (winRate >= 70) return { label: "Well-Tuned", color: "text-emerald-400", desc: "Conviction threshold calibrated" };
  if (winRate >= 50) return { label: "Adjusting", color: "text-amber-400", desc: "Tightening conviction threshold" };
  return { label: "Recalibrating", color: "text-rose-400", desc: "Applying maximum hesitation" };
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
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md">
        <div className="flex items-center justify-center py-12 gap-3 text-white/50">
          <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span className="text-sm font-semibold">Loading agent memory from 0G Chain...</span>
        </div>
      </div>
    );
  }

  if (error && !rep) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-sm font-bold text-rose-400">{error}</div>
      </div>
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
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-300 font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-500/30 font-mono">
              {agent?.name?.[0] || "M"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white tracking-wide">{agent?.name || "MUSASHI"}</span>
                {agent?.active && (
                  <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">Active</span>
                )}
              </div>
              <div className="text-xs font-mono font-semibold text-white/40 mt-1">
                INFT #0 on 0G Chain
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-black uppercase tracking-wider ${calibration.color}`}>
              {calibration.label}
            </div>
            <div className="text-xs font-semibold text-white/40 mt-1">{calibration.desc}</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-all backdrop-blur-md">
          <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2 font-mono">Strikes</div>
          <div className="flex items-center gap-3">
            <div className="text-4xl font-black text-white tracking-tight">{rep?.strikeCount ?? 0}</div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 ml-auto shadow-inner">
              <span className="text-white/60 font-black block text-sm">S</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-white/40 mt-2">{rep?.totalFilled ?? 0} outcomes recorded</div>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-all backdrop-blur-md">
          <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2 font-mono">W / L</div>
          <div className="flex items-center gap-2">
            <div className="text-4xl font-black tracking-tight flex items-baseline">
              <span className="text-white">{rep?.wins ?? 0}</span>
              <span className="text-white/20 mx-2 font-light text-2xl">/</span>
              <span className="text-white/50">{rep?.losses ?? 0}</span>
            </div>
            <div className="flex ml-auto gap-1 items-end h-6">
              <div className="w-2 h-4 bg-emerald-500/80 rounded-t-sm" />
              <div className="w-2 h-6 bg-emerald-500/80 rounded-t-sm" />
              <div className="w-2 h-3 bg-rose-500/80 rounded-t-sm" />
            </div>
          </div>
          <div className="text-xs text-white/40 mt-2">
            <div className="flex overflow-hidden h-1.5 rounded-full w-full max-w-[120px] bg-white/5">
               <div className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{width: `${rep && rep.totalFilled ? (rep.wins / rep.totalFilled)*100 : 0}%`}} />
               <div className="bg-rose-500 h-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{width: `${rep && rep.totalFilled ? (rep.losses / rep.totalFilled)*100 : 0}%`}} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-all backdrop-blur-md">
          <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2 font-mono">Win Rate</div>
          <div className="flex items-center justify-between">
            <div className="text-4xl font-black tracking-tight text-white">
              {winRate.toFixed(1)}%
            </div>
            <div className="relative w-10 h-10 rounded-full border-[5px] border-white/5 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.15]">
                <circle cx="20" cy="20" r="16" fill="none" stroke="url(#gradient-winrate)" strokeWidth="4" strokeDasharray={`${(winRate/100) * 100} 100`} className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <defs>
                   <linearGradient id="gradient-winrate" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#10b981" />
                   </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-all backdrop-blur-md">
          <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-2 font-mono">Total Return</div>
          <div className="flex items-center justify-between">
            <div className={`text-4xl font-black tracking-tight ${totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(1)}%
            </div>
            <svg className={`w-6 h-6 ${totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              {totalReturnPct >= 0 
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
              }
            </svg>
          </div>
        </div>
      </div>

      {/* Strike Outcome Timeline */}
      {recentStrikes.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">Strike Outcome Timeline</h3>
              <p className="text-xs font-semibold text-white/40 mt-1">
                Agent learns from each outcome to calibrate future decisions
              </p>
            </div>
            <button onClick={loadData} className="text-xs font-bold px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer flex items-center gap-2 shadow-inner">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              REFRESH
            </button>
          </div>

          {/* Visual timeline */}
          <div className="flex items-end gap-1.5 h-32 mb-4 bg-white/[0.01] p-4 rounded-xl border border-white/5">
            {recentStrikes.slice().reverse().map((s) => {
              const isFilled = s.outcomeFilled;
              const isWin = s.outcomeBps > 0;
              const isLoss = s.outcomeBps < 0;
              const height = isFilled
                ? Math.min(Math.max(Math.abs(s.outcomeBps) / 50, 15), 100)
                : 30;

              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className={`w-full max-w-[24px] rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                      !isFilled ? "bg-white/10 animate-pulse border border-white/20" :
                      isWin ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]" :
                      isLoss ? "bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]" :
                      "bg-white/30"
                    }`}
                    style={{ height: `${height}%`, minHeight: '8px', width: '10px' }}
                  />
                  <div className="text-[9px] text-white/30 font-bold font-mono mt-1">#{s.id}</div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-[#0a0e1a] border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-3 whitespace-nowrap shadow-2xl backdrop-blur-md">
                      <div className="text-white/50 mb-1">Strike #{s.id}</div>
                      <div className="text-white text-sm">
                        {isFilled
                          ? <span className={isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-white"}>{`${isWin ? "+" : ""}${(s.outcomeBps / 100).toFixed(1)}% ${isWin ? "WIN" : isLoss ? "LOSS" : "NEUTRAL"}`}</span>
                          : "Awaiting outcome"}
                      </div>
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mt-1.5 font-mono">Convergence: {s.convergence}/4</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 text-xs font-bold text-white/50 uppercase tracking-wider bg-white/[0.02] px-5 py-2.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span>Win</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
              <span>Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-white/20" />
              <span>Pending</span>
            </div>
            <div className="ml-auto">
              <span className="text-white/70">Learning from <span className="text-white mx-1">{filledStrikes.length}</span> outcomes</span>
            </div>
          </div>
        </div>
      )}

      {/* Learning Insight */}
      {rep && rep.totalFilled >= 3 && (
        <div className="rounded-2xl bg-white/[0.02] border border-l-4 border-white/5 border-l-blue-500 p-6 backdrop-blur-md shadow-lg">
          <div className="flex gap-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2 tracking-wide">Agent Memory Active</h4>
              <p className="text-sm font-semibold text-white/50 leading-relaxed">
                {winRate >= 70
                  ? `With a ${winRate.toFixed(0)}% win rate across ${rep.totalFilled} outcomes, the judge maintains its current conviction threshold. Strong calibration.`
                  : winRate >= 50
                  ? `Win rate at ${winRate.toFixed(0)}% across ${rep.totalFilled} outcomes. The judge is tightening its conviction threshold — requiring stronger convergence for PASS decisions.`
                  : `Win rate at ${winRate.toFixed(0)}% across ${rep.totalFilled} outcomes. The judge has entered maximum hesitation mode — only 4/4 convergence with pristine fundamentals will PASS.`
                }
                <br /><br />
                <span className="text-white/40">All data is on-chain and verifiable on</span>{" "}
                <a href={`${OG_EXPLORER}/address/${CONVICTION_LOG_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  0G Explorer
                </a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
