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
    return <span className="text-emerald-500 font-bold text-lg">&#10003;</span>;
  if (status === "FAIL")
    return <span className="text-red-500 font-bold text-lg">&#10007;</span>;
  if (status === "WARN")
    return <span className="text-amber-500 font-bold text-lg">!</span>;
  return <span className="text-slate-400 text-lg">&#8226;</span>;
}

interface Props {
  gates: GateResult[];
  tokenAge?: string;
  overallStatus?: string;
}

export function GatePipeline({ gates, tokenAge, overallStatus }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Gate Pipeline</h3>
        <div className="flex items-center gap-3">
          {tokenAge && (
            <span className="text-xs font-mono px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              {tokenAge}
            </span>
          )}
          {overallStatus && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                overallStatus === "PASS"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : overallStatus === "FAIL"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}
            >
              {overallStatus}
            </span>
          )}
        </div>
      </div>

      {/* Gate Steps */}
      <div className="space-y-1">
        {GATE_LABELS.map((label, i) => {
          const gate = gates.find((g) => g.gate_num === i + 1);
          const isExpanded = expanded === i;
          const status = gate?.status || "PENDING";

          return (
            <div key={i}>
              <button
                onClick={() => setExpanded(isExpanded ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/50 transition-colors cursor-pointer text-left"
              >
                {/* Step number */}
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                  {i + 1}
                </span>

                {/* Connector line */}
                {i < 6 && (
                  <div className="absolute ml-3 mt-10 w-px h-3 bg-slate-200" />
                )}

                {/* Status */}
                <StatusIcon status={status} />

                {/* Label */}
                <span className="flex-1 text-sm font-medium text-slate-700">
                  {label}
                </span>

                {/* Reason preview */}
                {gate && (
                  <span className="text-xs text-slate-500 max-w-xs truncate hidden sm:block">
                    {gate.reason}
                  </span>
                )}

                {/* Expand icon */}
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded evidence */}
              {isExpanded && gate && (
                <div className="ml-14 mr-4 mb-2 p-3 bg-white/60 rounded-lg border border-slate-100">
                  <p className="text-sm text-slate-600 mb-2">{gate.reason}</p>
                  {gate.evidence && gate.evidence.length > 0 && (
                    <div className="space-y-1">
                      {gate.evidence.map((e, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 text-xs font-mono"
                        >
                          <span className="text-slate-400">{e.source}</span>
                          <span className="text-slate-500">{e.key}:</span>
                          <span className="text-slate-700">{e.value}</span>
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
