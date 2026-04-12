"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Agent = "openclaw" | "claude-code";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const AGENT_CONFIG: Record<Agent, { name: string; label: string; color: string; placeholder: string }> = {
  "claude-code": {
    name: "Claude Code",
    label: "CC",
    color: "bg-amber-600 hover:bg-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)] border border-amber-500/50",
    placeholder: "Ask anything... e.g. \"analyze 0x... on Base\"",
  },
  openclaw: {
    name: "OpenClaw",
    label: "OC",
    color: "bg-emerald-600 hover:bg-zinc-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-zinc-500/50",
    placeholder: "Ask anything... e.g. \"scan base chain\"",
  },
};

const QUICK_ACTIONS = [
  { label: "Scan Base", cmd: "Scan Base chain for the best token opportunities right now" },
  { label: "Scan Ethereum", cmd: "Scan Ethereum for top token opportunities" },
  { label: "Discover Trending", cmd: "Discover trending tokens across all chains" },
  { label: "Explain Gates", cmd: "Explain how the 7-gate elimination pipeline works" },
];

function FormatText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|_[^_]+_)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="px-1.5 py-0.5 rounded bg-white/10 text-[12px] font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return <em key={i} className="text-white/40 italic">{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<Agent>("claude-code");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "MUSASHI agent ready. All CLI features available here — scan, analyze, discover, gate check, strike. Talk naturally.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cfg = AGENT_CONFIG[agent];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function addMessage(role: Message["role"], content: string): string {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date() }]);
    return id;
  }

  function updateLastAssistant(content: string) {
    setMessages((prev) => {
      const msgs = [...prev];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      return msgs;
    });
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;

    addMessage("user", text.trim());
    setInput("");
    setProcessing(true);
    addMessage("assistant", "");

    const controller = new AbortController();
    abortRef.current = controller;
    let fullText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          agent: agent === "claude-code" ? "claude" : "openclaw",
          sessionId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "text") {
              fullText += event.content;
              updateLastAssistant(fullText);
            } else if (event.type === "tool") {
              updateLastAssistant(fullText + `\n\n_Using ${event.name}..._`);
            } else if (event.type === "done") {
              if (event.sessionId) setSessionId(event.sessionId);
              if (event.result && !fullText.trim()) {
                fullText = event.result;
                updateLastAssistant(fullText);
              }
            } else if (event.type === "error") {
              fullText += `\n\nError: ${event.content}`;
              updateLastAssistant(fullText);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        updateLastAssistant(fullText + "\n\n_Cancelled._");
      } else {
        const msg = err instanceof Error ? err.message : "Connection failed";
        updateLastAssistant(fullText || `Error: ${msg}`);
      }
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }, [processing, agent, sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[460px] max-w-[460px] h-[70vh] sm:h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col"
          style={{ animation: "chatOpen 0.3s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/musashi-logo.png" alt="MUSASHI" className="w-6 h-6" />
              <div>
                <span className="text-sm font-semibold text-white">MUSASHI</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  <span className="text-[10px] text-white/40">Online</span>
                </div>
              </div>
            </div>

            {/* Agent toggle */}
            <div className="flex gap-1 rounded-full p-0.5 bg-white/5">
              {(Object.keys(AGENT_CONFIG) as Agent[]).map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    if (a !== agent && !processing) {
                      setAgent(a);
                      setSessionId(null);
                      addMessage("system", `Switched to ${AGENT_CONFIG[a].name}.`);
                    }
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all cursor-pointer ${
                    agent === a
                      ? `${AGENT_CONFIG[a].color} text-white`
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {AGENT_CONFIG[a].label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Minimize chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-zinc-500 text-white"
                      : msg.role === "system"
                        ? "bg-white/[0.04] border border-white/[0.08] text-white/50 text-xs italic"
                        : "bg-white/[0.04] border border-white/[0.08] text-white/85"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`w-4 h-4 rounded-full ${cfg.color.split(' ')[0]} flex items-center justify-center text-[8px] text-white font-bold`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-white/30">{cfg.name}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {msg.content ? (
                      <FormatText text={msg.content} />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions - only show when few messages */}
          {messages.length <= 2 && !processing && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.cmd)}
                  className="text-[10px] px-3 py-1.5 rounded-full border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={cfg.placeholder}
              disabled={processing}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-500/40 disabled:opacity-50"
            />
            {processing ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl px-4 py-2.5 hover:bg-amber-500/30 transition-all cursor-pointer"
                aria-label="Cancel request"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`${cfg.color} text-white rounded-xl px-4 py-2.5 transition-all disabled:opacity-30 cursor-pointer`}
                aria-label="Send message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chat" : "Open chat"}
        className={`fixed bottom-6 right-6 z-50 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center ${
          open
            ? "w-16 h-16 bg-transparent hover:scale-90"
            : "w-16 h-16 bg-transparent hover:scale-110"
        }`}
      >
        {open ? (
          <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center backdrop-blur">
            <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <img src="/musashi-logo.png" alt="MUSASHI" className="w-16 h-16 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
            <span className="absolute inset-2 rounded-full border border-amber-500/20 blur-[2px] animate-ping" style={{ animationDuration: "2s" }} />
          </div>
        )}
      </button>

      <style jsx global>{`
        @keyframes chatOpen {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
