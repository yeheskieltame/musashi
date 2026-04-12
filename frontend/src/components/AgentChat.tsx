"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Agent = "openclaw" | "claude-code";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tools?: { name: string; input: string }[];
}

const AGENT_CONFIG: Record<Agent, { name: string; label: string; color: string; placeholder: string }> = {
  "claude-code": {
    name: "Claude Code",
    label: "CC",
    color: "bg-amber-600 hover:bg-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)] border border-amber-500/50",
    placeholder: "Ask MUSASHI core... e.g. \"analyze 0x...\"",
  },
  openclaw: {
    name: "OpenClaw",
    label: "OC",
    color: "bg-amber-600 hover:bg-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)] border border-amber-500/50",
    placeholder: "Ask specialized modules... e.g. \"scan base\"",
  },
};

export function AgentChat() {
  const [agent, setAgent] = useState<Agent>("claude-code");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "MUSASHI agent ready. Talk naturally — the agent decides what tools to use.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cfg = AGENT_CONFIG[agent];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(role: Message["role"], content: string, tools?: Message["tools"]): string {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date(), tools }]);
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

  function handleSwitchAgent(newAgent: Agent) {
    if (newAgent === agent || processing) return;
    setAgent(newAgent);
    setSessionId(null);
    addMessage("system", `Switched to ${AGENT_CONFIG[newAgent].name}. New conversation started.`);
  }

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing) return;

    const userText = input.trim();
    addMessage("user", userText);
    setInput("");
    setProcessing(true);

    // Create assistant placeholder
    addMessage("assistant", "");

    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";
    const toolsUsed: { name: string; input: string }[] = [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
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
              toolsUsed.push({ name: event.name, input: JSON.stringify(event.input).slice(0, 100) });
              updateLastAssistant(fullText + `\n\n_Using ${event.name}..._`);
            } else if (event.type === "done") {
              if (event.sessionId) {
                setSessionId(event.sessionId);
              }
              // Final result might have a cleaner text
              if (event.result && !fullText.trim()) {
                fullText = event.result;
                updateLastAssistant(fullText);
              }
            } else if (event.type === "error") {
              fullText += `\n\nError: ${event.content}`;
              updateLastAssistant(fullText);
            }
          } catch {
            // skip malformed events
          }
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
  }, [input, processing, agent, sessionId]);

  function handleCancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent Selector */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1 glass rounded-full p-1">
          {(Object.keys(AGENT_CONFIG) as Agent[]).map((a) => (
            <button
              key={a}
              onClick={() => handleSwitchAgent(a)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer border ${
                agent === a
                  ? `${AGENT_CONFIG[a].color} text-white shadow-md`
                  : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {AGENT_CONFIG[a].name}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {sessionId && (
          <span className="text-[10px] text-slate-400 font-mono">
            session: {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                msg.role === "user"
                  ? "bg-amber-600 border border-amber-500/50 text-white shadow-[0_4px_15px_rgba(217,119,6,0.3)]"
                  : msg.role === "system"
                    ? "bg-white/5 text-slate-400 text-xs italic border border-white/10"
                    : "bg-white/[0.04] border border-white/10 text-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`w-5 h-5 rounded-full ${cfg.color} flex items-center justify-center text-[9px] text-white font-bold`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400">{cfg.name}</span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
              {msg.tools && msg.tools.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/50 space-y-1">
                  {msg.tools.map((t, i) => (
                    <div key={i} className="text-[10px] font-mono text-slate-400">
                      {t.name}: {t.input}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={cfg.placeholder}
          disabled={processing}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
        />
        {processing ? (
          <button
            type="button"
            onClick={handleCancel}
            className="bg-amber-600 text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-amber-500 transition-all cursor-pointer"
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
            className={`${cfg.color} text-white rounded-xl px-5 py-3 text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer`}
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
