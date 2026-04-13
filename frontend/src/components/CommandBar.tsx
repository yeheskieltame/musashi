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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4 w-full">
      <div className="flex-1 relative w-full group">
        <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter token address (0x...) or search by name..."
          className="relative w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-sm font-semibold text-white placeholder-white/40 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-mono shadow-inner"
        />
        {loading && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex w-full sm:w-auto gap-4">
        <select
          value={chain}
          onChange={(e) => setChain(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors focus:border-blue-500/50 appearance-none pr-10 relative shadow-inner"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23ffffff\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
        >
          <option value={16661} className="bg-[#0a0e1a]">0G</option>
          <option value={1} className="bg-[#0a0e1a]">ETH</option>
          <option value={56} className="bg-[#0a0e1a]">BSC</option>
          <option value={8453} className="bg-[#0a0e1a]">Base</option>
          <option value={42161} className="bg-[#0a0e1a]">ARB</option>
          <option value={137} className="bg-[#0a0e1a]">MATIC</option>
        </select>

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex-1 sm:flex-none relative group overflow-hidden rounded-xl bg-blue-600 border border-blue-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:bg-blue-500 transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer whitespace-nowrap"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative">Analyze</span>
        </button>
      </div>
    </form>
  );
}
