"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnect({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 glass-strong rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          <span className="font-mono text-sm text-slate-700">{short}</span>
        </div>
        {!compact && (
          <button
            onClick={() => disconnect()}
            className="text-xs text-slate-500 hover:text-amber-500 transition-colors px-2 py-1 cursor-pointer"
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="bg-transparent border border-white/20 text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-white/5 hover:border-white/40 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer"
    >
      Connect Wallet
    </button>
  );
}
