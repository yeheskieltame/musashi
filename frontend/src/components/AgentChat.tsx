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
  openclaw: {
    name: "OpenClaw",
    label: "OC",
    color: "from-emerald-500 to-teal-500",
    placeholder: "Ask anything... e.g. \"scan base chain for opportunities\"",
  },
  "claude-code": {
    name: "Claude Code",
    label: "CC",
    color: "from-blue-500 to-violet-500",
    placeholder: "Ask anything... e.g. \"analyze this token on ethereum\"",
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
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                agent === a
                  ? `bg-gradient-to-r ${AGENT_CONFIG[a].color} text-white shadow-md`
                  : "text-slate-500 hover:text-slate-700"
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
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                  : msg.role === "system"
                    ? "bg-slate-100 text-slate-500 text-xs italic"
                    : "glass-strong text-slate-700"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`w-5 h-5 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-[9px] text-white font-bold`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400">{cfg.name}</span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
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
          className="flex-1 glass-strong rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
        {processing ? (
          <button
            type="button"
            onClick={handleCancel}
            className="bg-red-500 text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-red-600 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className={`bg-gradient-to-r ${cfg.color} text-white rounded-xl px-5 py-3 text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer`}
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
