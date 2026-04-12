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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 w-full">
      <div className="flex-1 relative w-full group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter token address (0x...) or search by name..."
          className="relative w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex w-full sm:w-auto gap-3">
        <select
          value={chain}
          onChange={(e) => setChain(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none cursor-pointer hover:bg-white/10 transition-colors focus:border-purple-500/50 appearance-none pr-8 relative"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23a1a1aa\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
        >
          <option value={16661} className="bg-slate-900">0G</option>
          <option value={1} className="bg-slate-900">ETH</option>
          <option value={56} className="bg-slate-900">BSC</option>
          <option value={8453} className="bg-slate-900">Base</option>
          <option value={42161} className="bg-slate-900">ARB</option>
          <option value={137} className="bg-slate-900">MATIC</option>
        </select>

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex-1 sm:flex-none relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer whitespace-nowrap"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative">Analyze</span>
        </button>
      </div>
    </form>
  );
}
