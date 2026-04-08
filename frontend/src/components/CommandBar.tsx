"use client";

import { useState } from "react";

interface Props {
  onSearch: (query: string) => void;
  onGates: (token: string, chain: number) => void;
  loading?: boolean;
}

export function CommandBar({ onSearch, onGates, loading }: Props) {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    if (input.startsWith("0x") && input.length >= 40) {
      onGates(input.trim(), chain);
    } else {
      onSearch(input.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter token address (0x...) or search by name..."
          className="w-full glass-strong rounded-xl px-5 py-3.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <select
        value={chain}
        onChange={(e) => setChain(Number(e.target.value))}
        className="glass-strong rounded-xl px-3 py-3.5 text-sm text-slate-700 outline-none cursor-pointer"
      >
        <option value={1}>ETH</option>
        <option value={56}>BSC</option>
        <option value={8453}>Base</option>
        <option value={42161}>ARB</option>
        <option value={137}>MATIC</option>
      </select>

      <button
        type="submit"
        disabled={!input.trim() || loading}
        className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl px-6 py-3.5 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
      >
        Analyze
      </button>
    </form>
  );
}
