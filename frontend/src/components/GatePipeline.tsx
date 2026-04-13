"use client";

import { useState } from "react";
import type { GateResult } from "@/types";

const GATE_LABELS = [
  "Contract Safety",
  "Liquidity",
  "Wallets",
  "Social",
  "Narrative",
  "Timing",
  "Cross-Val",
];

function StatusIcon({ status }: { status: string }) {
  if (status === "PASS")
    return <span className="text-emerald-400 font-black text-lg">&#10003;</span>;
  if (status === "FAIL")
    return <span className="text-rose-500 font-black text-lg">&#10007;</span>;
  if (status === "WARN")
    return <span className="text-amber-400 font-black text-lg">!</span>;
  if (status === "SKIP")
    return <span className="text-white/30 font-bold text-lg">&#8594;</span>;
  return <span className="text-white/40 text-lg">&#8226;</span>;
}

interface Props {
  gates: GateResult[];
  tokenAge?: string;
  overallStatus?: string;
}

export function GatePipeline({ gates, tokenAge, overallStatus }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-white tracking-wide">Gate Pipeline</h3>
        <div className="flex items-center gap-3">
          {tokenAge && (
            <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold">
              {tokenAge}
            </span>
          )}
          {overallStatus && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                overallStatus === "PASS"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : overallStatus === "FAIL"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              }`}
            >
              {overallStatus}
            </span>
          )}
        </div>
      </div>

      {/* Gate Steps */}
      <div className="space-y-2">
        {GATE_LABELS.map((label, i) => {
          const gate = gates.find((g) => g.gate_num === i + 1);
          const isExpanded = expanded === i;
          const status = gate?.status || "PENDING";

          return (
            <div key={i}>
              <button
                onClick={() => setExpanded(isExpanded ? null : i)}
                className="w-full relative group"
                aria-expanded={isExpanded}
                aria-label={`Gate ${i + 1}: ${label} - ${status}`}
              >
                <div className={`absolute inset-0 bg-white/[0.03] rounded-xl border border-white/5 transition-colors group-hover:border-white/10 ${isExpanded ? "border-white/10 bg-white/[0.05]" : ""}`} />
                <div className="relative w-full flex items-center gap-4 px-5 py-4 cursor-pointer text-left">
                  {/* Step number */}
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="text-[10px] font-bold font-mono text-white/50">{i + 1}</span>
                  </div>

                  {/* Connector line */}
                  {i < 6 && (
                    <div className="absolute left-[33px] top-[40px] w-px h-6 bg-white/5 z-0" />
                  )}

                  {/* Status */}
                  <div className="w-4 flex justify-center z-10">
                    <StatusIcon status={status} />
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white tracking-wide block truncate">
                      {label}
                    </span>
                  </div>

                  {/* Reason preview */}
                  {gate && (
                    <span className="text-xs font-medium text-white/30 hidden sm:block truncate max-w-[200px]">
                      {gate.reason}
                    </span>
                  )}

                  {/* Expand icon */}
                  <svg
                    className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-180 text-white" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded evidence */}
              {isExpanded && gate && (
                <div className="ml-16 mr-2 mt-2 mb-4 p-4 bg-white/[0.02] rounded-xl border border-white/5 backdrop-blur-sm animate-fade-in shadow-inner">
                  <p className="text-xs font-semibold text-white/60 mb-3 leading-relaxed">{gate.reason}</p>
                  {gate.evidence && gate.evidence.length > 0 && (
                    <div className="space-y-2">
                      {gate.evidence.map((e, j) => (
                        <div
                          key={j}
                          className="flex items-start gap-2 text-[11px] font-mono leading-tight"
                        >
                          <span className="text-blue-400 font-bold whitespace-nowrap">[{e.source}]</span>
                          <span className="text-white/40 break-words flex-1">
                            {e.key}: <span className="text-white normal-case">{typeof e.value === 'object' ? JSON.stringify(e.value) : String(e.value)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
