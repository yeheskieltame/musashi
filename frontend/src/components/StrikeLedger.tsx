"use client";

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http } from "viem";
import {
  CONVICTION_LOG_ADDRESS,
  CONVICTION_LOG_ABI,
  OG_RPC,
  OG_EXPLORER,
  OG_CHAIN_ID,
  storageScanUrl,
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
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">On-Chain Strike Ledger</h2>
            <p className="text-xs font-semibold text-white/40 mt-1">
              {totalStrikes} strikes recorded on 0G Chain (ConvictionLog)
            </p>
          </div>
        </div>
        <button
          onClick={fetchStrikes}
          disabled={loading}
          className="text-xs font-bold px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer disabled:opacity-50 shadow-inner"
        >
          {loading ? "LOAD..." : "REFRESH"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 mb-5 relative z-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <p className="text-sm text-rose-400 font-bold mb-1 tracking-wide">Failed to load strikes</p>
          <p className="text-xs font-medium text-rose-500/80 mb-3">{error}</p>
          <button
            onClick={fetchStrikes}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer border border-rose-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {loading && strikes.length === 0 ? (
        <div className="flex items-center justify-center py-16 gap-3 text-white/40 relative z-10">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm font-semibold">Fetching on-chain data from 0G...</span>
        </div>
      ) : strikes.length === 0 ? (
        <div className="text-center py-20 relative z-10 bg-white/[0.01] rounded-2xl border border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(255,255,255,0.02)]">
            <svg className="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-[15px] font-bold text-white/50 tracking-wide">No strikes recorded yet.</p>
          <p className="text-xs font-medium text-white/30 mt-2">Use the Agent Chat to analyze tokens and publish strikes.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl relative z-10 border border-white/10 bg-[#0a0e1a]/40 shadow-inner">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">ID</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Token</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Chain</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Convergence</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Date</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Outcome</th>
                  <th className="text-left py-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => handleExpand(s.id)}
                    className="border-b border-white/5 hover:bg-white/[0.08] transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4 font-mono text-xs font-bold text-white/30 group-hover:text-white/60 transition-colors">#{s.id}</td>
                    <td className="py-4 px-4">
                      <a
                        href={`${OG_EXPLORER}/address/${s.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs font-bold text-white/80 hover:text-blue-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shortenAddr(s.token)}
                      </a>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 text-white/60 border border-white/10 group-hover:border-white/20">
                        {CHAIN_NAMES[s.chainId] || `Chain ${s.chainId}`}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[11px] font-black tracking-wider px-2.5 py-1 rounded-md border ${s.convergence >= 4 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                        {convergenceLabel(s.convergence)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-white/40 font-medium text-xs">
                      {formatDate(s.timestamp)}
                    </td>
                    <td className="py-4 px-4">
                      {s.outcomeFilled ? (
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${s.outcomeBps >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                          {s.outcomeBps >= 0 ? "+" : ""}{bpsToPercent(s.outcomeBps)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 text-white/40 border border-white/10">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-[10px] font-medium text-white/30 bg-black/30 px-2 py-1 rounded border border-white/5">
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
              <div className="mt-4 rounded-xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 p-6 animate-fade-in relative z-10 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
                  <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    Strike #{s.id} Intelligence
                  </h3>
                  <button
                    onClick={() => setExpanded(null)}
                    className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1">Target Address</span>
                      <p className="font-mono text-[13px] text-white font-bold">{s.token}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1">Network</span>
                        <p className="text-sm text-white font-bold">{CHAIN_NAMES[s.chainId] || `Chain ${s.chainId}`}</p>
                      </div>
                      <div className="flex-1 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1">Timestamp</span>
                        <p className="text-sm text-white font-bold">{formatDate(s.timestamp)}</p>
                      </div>
                    </div>
                    <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-2">Verdict Confirmation</span>
                      <p className="flex items-center gap-3">
                        <span className={`text-sm font-black px-3 py-1 rounded-md border ${s.convergence >= 4 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                          {convergenceLabel(s.convergence)}
                        </span>
                        <span className="text-xs font-semibold text-white/40">({s.convergence} / 4 specialists agreed)</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 shadow-inner">
                      <span className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest text-emerald-400 mb-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        0G Storage Merkle Root
                      </span>
                      <div className="bg-[#050810] rounded-lg border border-emerald-500/30 p-2.5 shadow-inner">
                        <p className="font-mono text-[11px] font-semibold text-emerald-300 break-all">{s.evidenceHash}</p>
                      </div>
                      <p className="text-[10px] font-medium text-emerald-400/60 mt-2 leading-relaxed">
                        Tamper-evident evidence pointer on-chain. Decrypt and verify exactly using the 0G client.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <a
                          href={storageScanUrl(s.evidenceHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-colors"
                        >
                          Verify on StorageScan ↗
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(
                              `0g-storage-client download --indexer https://indexer-storage-turbo.0g.ai --root ${s.evidenceHash} --file strike-${s.id}.json --proof`
                            );
                          }}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 transition-colors"
                        >
                          Copy CLI Command
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                       <div className="flex-1 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1">Market Outcome</span>
                        {s.outcomeFilled ? (
                          <p className="text-sm mt-0.5">
                            <span className={`font-black px-2 py-0.5 rounded border ${s.outcomeBps >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                              {s.outcomeBps >= 0 ? "+" : ""}{bpsToPercent(s.outcomeBps)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-white/40 mt-1 font-bold">Awaiting outcome...</p>
                        )}
                      </div>
                      <div className="flex-1 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-2">On-Chain Links</span>
                        <div className="flex flex-col gap-1.5">
                          <a
                            href={`${OG_EXPLORER}/address/${CONVICTION_LOG_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Explore ConvictionLog ↗
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Evidence content from 0G Storage */}
                    {evidenceLoading === s.id ? (
                      <div className="col-span-2 flex items-center gap-3 bg-white/[0.02] p-4 rounded-lg border border-white/5">
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span className="text-xs font-bold text-white/50">Pulling cipher payload from 0G Network...</span>
                      </div>
                    ) : null}
                    {evidenceData[s.id] ? (
                      <div className="col-span-2 mt-4 animate-fade-in text-left">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 block">Decrypted Evidence Payload</span>
                        <div className="bg-[#050810] rounded-xl border border-white/10 p-4 max-h-80 overflow-y-auto shadow-inner">
                          <pre className="text-[11px] font-mono text-blue-200/70 whitespace-pre-wrap leading-relaxed">
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
    </div>
  );
}
