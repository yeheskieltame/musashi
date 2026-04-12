"use client";

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { GlassCard } from "./GlassCard";
import {
  CONVICTION_LOG_ADDRESS,
  CONVICTION_LOG_ABI,
  OG_RPC,
  OG_EXPLORER,
  OG_CHAIN_ID,
} from "@/lib/contracts";

const OG_STORAGE_INDEXER = "https://indexer-storage-turbo.0g.ai";
import { CHAIN_NAMES } from "@/types";

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
  evidenceHash: string;
  chainId: number;
  timestamp: number;
  outcomeBps: number;
}

function shortenAddr(addr: string | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function convergenceLabel(c: number): string {
  if (c >= 4) return "4/4 STRONG";
  if (c >= 3) return "3/4 PASS";
  return `${c}/4`;
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function StrikeLedger() {
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [totalStrikes, setTotalStrikes] = useState(0);
  const [evidenceData, setEvidenceData] = useState<Record<number, unknown>>({});
  const [evidenceLoading, setEvidenceLoading] = useState<number | null>(null);

  const fetchStrikes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const count = await client.readContract({
        address: CONVICTION_LOG_ADDRESS,
        abi: CONVICTION_LOG_ABI,
        functionName: "strikeCount",
      });

      const total = Number(count);
      setTotalStrikes(total);

      if (total === 0) {
        setStrikes([]);
        setLoading(false);
        return;
      }

      // Fetch latest strikes (up to 20, newest first)
      const start = Math.max(0, total - 20);
      const promises = [];
      for (let i = total - 1; i >= start; i--) {
        promises.push(
          client.readContract({
            address: CONVICTION_LOG_ADDRESS,
            abi: CONVICTION_LOG_ABI,
            functionName: "getStrike",
            args: [BigInt(i)],
          }).then((result) => {
            // viem returns a typed object matching the ABI tuple
            const r = result as {
              token: string;
              convergence: number;
              outcomeFilled: boolean;
              evidenceHash: string;
              chainId: bigint | number;
              timestamp: bigint | number;
              outcomeBps: bigint | number;
            };
            return {
              id: i,
              token: String(r.token),
              convergence: Number(r.convergence),
              outcomeFilled: Boolean(r.outcomeFilled),
              evidenceHash: String(r.evidenceHash),
              chainId: Number(r.chainId),
              timestamp: Number(r.timestamp),
              outcomeBps: Number(r.outcomeBps),
            } satisfies Strike;
          })
        );
      }

      const results = await Promise.all(promises);
      setStrikes(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch strikes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrikes();
  }, [fetchStrikes]);

  const fetchEvidence = useCallback(async (strikeId: number, evidenceHash: string) => {
    if (evidenceData[strikeId] || !evidenceHash) return;
    setEvidenceLoading(strikeId);
    try {
      const res = await fetch(`${OG_STORAGE_INDEXER}/file?root=${evidenceHash}`);
      if (res.ok) {
        const data = await res.json();
        setEvidenceData((prev) => ({ ...prev, [strikeId]: data }));
      }
    } catch {
      // non-fatal
    } finally {
      setEvidenceLoading(null);
    }
  }, [evidenceData]);

  const handleExpand = useCallback((id: number) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      const s = strikes.find((x) => x.id === id);
      if (s?.evidenceHash) fetchEvidence(id, s.evidenceHash);
    }
  }, [expanded, strikes, fetchEvidence]);

  return (
    <GlassCard strong className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(217,119,6,0.3)]">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-wide">On-Chain Strike Ledger</h2>
            <p className="text-xs text-slate-400">
              {totalStrikes} strikes recorded on 0G Chain (ConvictionLog)
            </p>
          </div>
        </div>
        <button
          onClick={fetchStrikes}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg glass text-slate-500 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 relative z-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <p className="text-sm text-amber-400 font-medium mb-1 tracking-wide">Failed to load strikes</p>
          <p className="text-xs text-amber-500/80 mb-2">{error}</p>
          <button
            onClick={fetchStrikes}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer border border-amber-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {loading && strikes.length === 0 ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 relative z-10">
          <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-sm">Fetching on-chain data from 0G...</span>
        </div>
      ) : strikes.length === 0 ? (
        <div className="text-center py-16 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 tracking-wide">No strikes recorded yet.</p>
          <p className="text-xs text-slate-500 mt-1">Use the Agent Chat to analyze tokens and publish strikes.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl relative z-10 border border-white/5 bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Token</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chain</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Convergence</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Outcome</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => handleExpand(s.id)}
                    className="border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-mono text-slate-400">#{s.id}</td>
                    <td className="py-3 px-3">
                      <a
                        href={`${OG_EXPLORER}/address/${s.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-zinc-300 hover:text-zinc-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shortenAddr(s.token)}
                      </a>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/5">
                        {CHAIN_NAMES[s.chainId] || `Chain ${s.chainId}`}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-bold ${s.convergence >= 4 ? "text-zinc-400" : "text-amber-400"}`}>
                        {convergenceLabel(s.convergence)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {formatDate(s.timestamp)}
                    </td>
                    <td className="py-3 px-3">
                      {s.outcomeFilled ? (
                        <span className={`text-xs font-bold ${s.outcomeBps >= 0 ? "text-zinc-400" : "text-amber-400"}`}>
                          {s.outcomeBps >= 0 ? "+" : ""}{bpsToPercent(s.outcomeBps)}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[10px] text-slate-500">
                        {s.evidenceHash.slice(0, 10)}...
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded detail panel */}
          {expanded !== null && (() => {
            const s = strikes.find((x) => x.id === expanded);
            if (!s) return null;
            return (
              <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-5 animate-fade-in relative z-10 backdrop-blur shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white tracking-wide">Strike #{s.id} Details</h3>
                  <button
                    onClick={() => setExpanded(null)}
                    className="text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Token Address</span>
                      <p className="font-mono text-sm text-white mt-0.5 font-semibold">{s.token}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Chain</span>
                      <p className="text-sm text-white mt-0.5 font-semibold">{CHAIN_NAMES[s.chainId] || `Chain ${s.chainId}`}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Convergence</span>
                      <p className="text-sm mt-0.5">
                        <span className={`font-bold ${s.convergence >= 4 ? "text-zinc-400" : "text-amber-400"}`}>
                          {convergenceLabel(s.convergence)}
                        </span>
                        <span className="text-slate-500 ml-2">({s.convergence} of 4 specialists agreed)</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Timestamp</span>
                      <p className="text-sm text-white mt-0.5 font-semibold">{formatDate(s.timestamp)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Evidence Hash (0G Storage)</span>
                      <div className="mt-0.5 bg-black/50 rounded-lg border border-white/10 p-2.5">
                        <p className="font-mono text-[11px] text-slate-300 break-all">{s.evidenceHash}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <a
                          href={`${OG_STORAGE_INDEXER}/file?root=${s.evidenceHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border border-zinc-500/20 transition-colors"
                        >
                          Download Evidence JSON
                        </a>
                        <a
                          href={`${OG_STORAGE_INDEXER}/file/info/${s.evidenceHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-500/10 text-zinc-300 hover:bg-zinc-500/20 border border-zinc-500/20 transition-colors"
                        >
                          File Info (Metadata)
                        </a>
                        <a
                          href="https://storagescan.0g.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                          0G Explorer
                        </a>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Outcome</span>
                      {s.outcomeFilled ? (
                        <p className="text-sm mt-0.5">
                          <span className={`font-bold ${s.outcomeBps >= 0 ? "text-zinc-400" : "text-amber-400"}`}>
                            {s.outcomeBps >= 0 ? "+" : ""}{bpsToPercent(s.outcomeBps)}
                          </span>
                          <span className="text-slate-500 ml-2">({s.outcomeBps} bps)</span>
                        </p>
                      ) : (
                        <p className="text-sm text-amber-400 mt-0.5 font-semibold">Awaiting outcome</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">On-Chain Links</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <a
                          href={`${OG_EXPLORER}/address/${CONVICTION_LOG_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-500/10 text-zinc-300 hover:bg-zinc-500/20 border border-zinc-500/20 transition-colors"
                        >
                          ConvictionLog
                        </a>
                        <a
                          href={`${OG_EXPLORER}/address/${s.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                          Token on Explorer
                        </a>
                      </div>
                    </div>

                    {/* Evidence content from 0G Storage */}
                    {evidenceLoading === s.id ? (
                      <div className="col-span-2 flex items-center gap-2 text-slate-400 py-4">
                        <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                        <span className="text-xs">Loading evidence from 0G Storage...</span>
                      </div>
                    ) : null}
                    {evidenceData[s.id] ? (
                      <div className="col-span-2 mt-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Evidence Data (from 0G Storage)</span>
                        <div className="mt-1 bg-[#0d1117] rounded-xl border border-[#30363d] p-4 max-h-80 overflow-y-auto">
                          <pre className="text-[11px] font-mono text-[#c9d1d9] whitespace-pre-wrap">
                            {JSON.stringify(evidenceData[s.id], null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </GlassCard>
  );
}
