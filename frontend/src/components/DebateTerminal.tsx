"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DebateTerminalProps {
  token: string;
  chain: number;
  onComplete?: (result: DebateVerdict) => void;
}

interface DebateEvent {
  type:
    | "phase"
    | "gates"
    | "agent_start"
    | "agent_stream"
    | "agent_report"
    | "agent_error"
    | "judge_start"
    | "judge_stream"
    | "verdict"
    | "error"
    | "done";
  phase?: string;
  status?: string;
  data?: any;
  agent?: string;
  model?: string;
  content?: string;
  report?: string;
  error?: string;
  result?: DebateVerdict;
}

interface DebateVerdict {
  pass: boolean;
  convergence: number;
  confidence?: string;
  reasoning: string;
  decisive_factor?: string;
  cross_examination?: string;
}

interface TerminalLine {
  id: number;
  agent?: "safety" | "technical" | "narrative" | "market" | "judge" | "system";
  content: string;
  timestamp: Date;
  type: "stream" | "report" | "phase" | "error" | "verdict";
}

type AgentStatus = "waiting" | "running" | "done" | "error";

const AGENTS = ["safety", "technical", "narrative", "market"] as const;

const AGENT_COLORS: Record<string, string> = {
  safety: "text-blue-400",
  technical: "text-emerald-400",
  narrative: "text-violet-400",
  market: "text-cyan-400",
  judge: "text-white",
  system: "text-white/50",
};

const AGENT_LABELS: Record<string, string> = {
  safety: "SAFETY",
  technical: "TECHNICAL",
  narrative: "NARRATIVE",
  market: "MARKET",
  judge: "JUDGE",
  system: "SYSTEM",
};

const BADGE_STYLES: Record<AgentStatus, string> = {
  waiting: "bg-white/5 text-white/40 border-white/10",
  running: "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.2)]",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

const JUDGE_BADGE_STYLES: Record<AgentStatus, string> = {
  waiting: "bg-white/5 text-white/40 border-white/10",
  running: "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse shadow-[0_0_15px_rgba(217,119,6,0.3)]",
  done: "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(217,119,6,0.2)]",
  error: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

let lineIdCounter = 0;
function nextLineId() {
  return ++lineIdCounter;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DebateTerminal({ token, chain, onComplete }: DebateTerminalProps) {
  const [events, setEvents] = useState<TerminalLine[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({
    safety: "waiting",
    technical: "waiting",
    narrative: "waiting",
    market: "waiting",
    judge: "waiting",
  });
  const [running, setRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [gateData, setGateData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const terminalRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<Record<string, string>>({});

  // Auto-scroll on new events
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [events]);

  // Elapsed timer
  useEffect(() => {
    if (!running || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [running, startTime]);

  const addLine = useCallback(
    (
      content: string,
      type: TerminalLine["type"],
      agent?: TerminalLine["agent"],
    ) => {
      setEvents((prev) => [
        ...prev,
        { id: nextLineId(), content, type, agent, timestamp: new Date() },
      ]);
    },
    [],
  );

  const setStatus = useCallback((agent: string, status: AgentStatus) => {
    setAgentStatuses((prev) => ({ ...prev, [agent]: status }));
  }, []);

  const handleEvent = useCallback(
    (event: DebateEvent) => {
      switch (event.type) {
        case "phase":
          addLine(
            `--- ${(event.phase ?? "").toUpperCase()} ${event.status === "complete" ? "COMPLETE" : "STARTED"} ---`,
            "phase",
            "system",
          );
          break;

        case "gates":
          setGateData(event.data);
          {
            const d = event.data;
            const status = d?.status ?? "UNKNOWN";
            const age = d?.token_age ?? "?";
            const gateCount = Array.isArray(d?.gates) ? d.gates.length : 0;
            const passed = Array.isArray(d?.gates)
              ? d.gates.filter((g: any) => g.status === "PASS").length
              : 0;
            addLine(
              `Gate pipeline: ${status} (${passed}/${gateCount} gates passed, token age: ${age})`,
              "report",
              "system",
            );
          }
          break;

        case "agent_start":
          if (event.agent) {
            setStatus(event.agent, "running");
            addLine(
              `Starting analysis${event.model ? ` (${event.model})` : ""}...`,
              "stream",
              event.agent as TerminalLine["agent"],
            );
          }
          break;

        case "agent_stream":
          if (event.agent && event.content) {
            const key = event.agent;
            const buf = (streamBufferRef.current[key] || "") + event.content;
            streamBufferRef.current[key] = buf;

            // Flush on newlines or when buffer gets long enough
            const lines = buf.split("\n");
            if (lines.length > 1) {
              // Flush all complete lines
              const complete = lines.slice(0, -1).join("\n").trim();
              streamBufferRef.current[key] = lines[lines.length - 1];
              if (complete) {
                for (const l of complete.split("\n")) {
                  if (l.trim()) {
                    addLine(l.trim(), "stream", key as TerminalLine["agent"]);
                  }
                }
              }
            } else if (buf.length > 120) {
              // Flush long buffers even without newline
              const flushed = buf.trim();
              streamBufferRef.current[key] = "";
              if (flushed) {
                addLine(flushed, "stream", key as TerminalLine["agent"]);
              }
            }
          }
          break;

        case "agent_report":
          if (event.agent) {
            // Flush remaining stream buffer
            const remaining = streamBufferRef.current[event.agent];
            if (remaining?.trim()) {
              addLine(
                remaining.trim(),
                "stream",
                event.agent as TerminalLine["agent"],
              );
            }
            streamBufferRef.current[event.agent] = "";
            setStatus(event.agent, "done");

            // Show the full report content if available
            if (event.report) {
              const reportLines = event.report.split("\n").filter((l: string) => l.trim());
              for (const l of reportLines) {
                addLine(l.trim(), "report", event.agent as TerminalLine["agent"]);
              }
            }
            addLine(
              `--- Analysis complete ---`,
              "report",
              event.agent as TerminalLine["agent"],
            );
          }
          break;

        case "agent_error":
          if (event.agent) {
            setStatus(event.agent, "error");
            addLine(
              `Error: ${event.error ?? "Unknown error"}`,
              "error",
              event.agent as TerminalLine["agent"],
            );
          }
          break;

        case "judge_start":
          setStatus("judge", "running");
          addLine("Synthesizing specialist reports...", "stream", "judge");
          break;

        case "judge_stream":
          if (event.content) {
            const key = "judge";
            const buf = (streamBufferRef.current[key] || "") + event.content;
            streamBufferRef.current[key] = buf;

            const lines = buf.split("\n");
            if (lines.length > 1) {
              const complete = lines.slice(0, -1).join("\n").trim();
              streamBufferRef.current[key] = lines[lines.length - 1];
              if (complete) {
                for (const l of complete.split("\n")) {
                  if (l.trim()) {
                    addLine(l.trim(), "stream", "judge");
                  }
                }
              }
            } else if (buf.length > 120) {
              const flushed = buf.trim();
              streamBufferRef.current[key] = "";
              if (flushed) {
                addLine(flushed, "stream", "judge");
              }
            }
          }
          break;

        case "verdict":
          if (event.result) {
            setStatus("judge", "done");
            setVerdict(event.result);
            addLine(
              `VERDICT: ${event.result.pass ? "PASS" : "FAIL"} | Convergence: ${event.result.convergence}/4 | ${event.result.reasoning}`,
              "verdict",
              "judge",
            );
            onComplete?.(event.result);
          }
          break;

        case "error":
          addLine(`System error: ${event.error ?? "Unknown"}`, "error", "system");
          break;

        case "done":
          setRunning(false);
          // Flush all remaining buffers
          Object.entries(streamBufferRef.current).forEach(([key, buf]) => {
            if (buf?.trim()) {
              addLine(buf.trim(), "stream", key as TerminalLine["agent"]);
            }
          });
          streamBufferRef.current = {};
          break;
      }
    },
    [addLine, setStatus, onComplete],
  );

  const startDebate = useCallback(async () => {
    // Reset state
    setRunning(true);
    setEvents([]);
    setVerdict(null);
    setGateData(null);
    setStartTime(Date.now());
    setElapsed(0);
    streamBufferRef.current = {};
    setAgentStatuses({
      safety: "waiting",
      technical: "waiting",
      narrative: "waiting",
      market: "waiting",
      judge: "waiting",
    });

    addLine(`Initiating debate for ${truncateAddress(token)} on chain ${chain}`, "phase", "system");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, chain }),
        signal: controller.signal,
      });

      if (!res.ok) {
        addLine(`HTTP ${res.status}: ${res.statusText}`, "error", "system");
        setRunning(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setRunning(false);
              return;
            }
            try {
              const event: DebateEvent = JSON.parse(data);
              handleEvent(event);
            } catch {
              /* skip malformed */
            }
          }
        }
      }

      setRunning(false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      addLine(
        `Connection error: ${err instanceof Error ? err.message : "Unknown"}`,
        "error",
        "system",
      );
      setRunning(false);
    }
  }, [token, chain, addLine, handleEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Status label                                                     */
  /* ---------------------------------------------------------------- */

  const statusLabel = running
    ? "Analyzing"
    : verdict
      ? verdict.pass
        ? "Complete - PASS"
        : "Complete - FAIL"
      : events.some((e) => e.type === "error")
        ? "Failed"
        : "Ready";

  const statusColor = running
    ? "text-blue-400"
    : verdict
      ? verdict.pass
        ? "text-emerald-400"
        : "text-rose-400"
      : events.some((e) => e.type === "error")
        ? "text-amber-400"
        : "text-white/40";

  const statusDot = running
    ? "bg-blue-500 animate-pulse"
    : verdict
      ? verdict.pass
        ? "bg-emerald-500"
        : "bg-rose-500"
      : events.some((e) => e.type === "error")
        ? "bg-amber-500"
        : "bg-white/30";

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.01]">
        <div className="flex items-center gap-4">
          {/* Terminal icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Multi-Agent Debate
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase ${statusColor}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full shadow-lg ${statusDot}`} />
                {statusLabel}
              </span>
              {running && startTime && (
                <span className="text-xs font-mono font-bold text-white/30">
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Token + chain badge */}
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-white/70">
            {truncateAddress(token)}
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20 text-[10px] tracking-widest">
              {chain}
            </span>
          </span>

          {/* Start button */}
          {!running && (
            <button
              onClick={startDebate}
              className="px-4 py-2 rounded-xl bg-blue-600 border border-blue-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer"
              disabled={!token}
            >
              {events.length > 0 ? "Re-run" : "Start Debate"}
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            aria-label={collapsed ? "Expand terminal" : "Collapse terminal"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      <div
        className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-[800px] opacity-100"
        }`}
      >
        {/* Agent status bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-white/5 bg-[#0a0e1a]/50">
          {AGENTS.map((agent) => (
            <span
              key={agent}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${BADGE_STYLES[agentStatuses[agent]]}`}
            >
              {agentStatuses[agent] === "running" && (
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              )}
              {agentStatuses[agent] === "done" && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {agentStatuses[agent] === "error" && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              )}
              {agent}
            </span>
          ))}

          {/* Separator */}
          <span className="w-px h-5 bg-white/10 mx-1" />

          {/* Judge badge */}
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${JUDGE_BADGE_STYLES[agentStatuses.judge]}`}
          >
            {agentStatuses.judge === "running" && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            {agentStatuses.judge === "done" && (
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            Judge
          </span>
        </div>

        {/* Terminal body */}
        <div
          ref={terminalRef}
          className="bg-[#050810] relative overflow-y-auto font-mono text-[11px] leading-relaxed px-5 py-4 scroll-smooth shadow-inner"
          style={{ maxHeight: "400px", minHeight: events.length > 0 ? "200px" : "120px" }}
        >
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_100%)] pointer-events-none" />
           <div className="relative z-10 space-y-1">
          {events.length === 0 && !running && (
            <div className="flex items-center justify-center py-10 text-white/30 font-semibold tracking-wide">
              <span>Press "Start Debate" to begin multi-agent analysis on 0G</span>
            </div>
          )}

          {events.map((line) => {
            const color = line.agent ? AGENT_COLORS[line.agent] : "text-white/40";
            const label = line.agent ? AGENT_LABELS[line.agent] : null;

            if (line.type === "phase") {
              return (
                <div key={line.id} className="text-blue-400 font-bold py-2 select-none uppercase tracking-widest border-b border-blue-500/20 mb-2 mt-1">
                  {line.content}
                </div>
              );
            }

            if (line.type === "error") {
              return (
                <div key={line.id} className="text-rose-400 py-1 bg-rose-500/10 border-l-2 border-rose-500 pl-3 my-1">
                  {label && (
                    <span className="font-bold opacity-80 decoration-rose-500/40">[{label}] </span>
                  )}
                  {line.content}
                </div>
              );
            }

            if (line.type === "verdict") {
              return (
                <div
                  key={line.id}
                  className="text-amber-300 font-bold py-2 text-xs bg-amber-500/10 border border-amber-500/20 px-4 rounded-lg mt-3"
                >
                  <span className="text-amber-400/80 mr-2">[{label}]</span><span className="leading-relaxed">{line.content}</span>
                </div>
              );
            }

            const isJudge = line.agent === "judge";

            return (
              <div
                key={line.id}
                className={`${color} py-0.5 ${isJudge ? "font-bold text-xs mt-2" : "font-medium"} transition-all`}
              >
                {label && label !== "SYSTEM" && (
                  <span className="font-bold opacity-60 mr-1.5">[{label}]</span>
                )}
                {line.content}
              </div>
            );
          })}

          {running && (
            <span className="inline-block w-2.5 h-4 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse ml-2 align-middle" />
          )}
          </div>
        </div>

        {/* Verdict panel */}
        {verdict && (
          <div
            className={`px-5 py-4 border-t ${
              verdict.pass
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-rose-500/30 bg-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-4 flex-wrap">
              {/* PASS / FAIL badge */}
              <span
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(0,0,0,0.2)] ${
                  verdict.pass
                    ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                }`}
              >
                {verdict.pass ? (
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                )}
                {verdict.pass ? "PASS" : "FAIL"}
              </span>

              {/* Convergence */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Convergence</span>
                <span className="font-black text-sm text-white">
                  {verdict.convergence}/4
                </span>
              </div>

              {/* Divider */}
              <span className="hidden sm:block w-px h-6 bg-white/10" />

              {/* Reasoning - extract FINAL REASONING or DECISIVE FACTOR if present */}
              <p className="text-xs font-medium text-white/70 flex-1 min-w-0 leading-relaxed">
                {(() => {
                  const r = verdict.reasoning;
                  const finalMatch = /FINAL REASONING:\s*([^\n]+(?:\n[^\n]+)*)/i.exec(r);
                  if (finalMatch) return finalMatch[1].trim().slice(0, 300);
                  const decisiveMatch = /DECISIVE FACTOR:\s*([^\n]+)/i.exec(r);
                  if (decisiveMatch) return decisiveMatch[1].trim().slice(0, 300);
                  return r.slice(0, 300) + (r.length > 300 ? "..." : "");
                })()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
