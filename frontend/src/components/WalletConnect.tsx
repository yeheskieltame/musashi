"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function WalletConnect({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 glass-strong rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-sm text-slate-700">{short}</span>
        </div>
        {!compact && (
          <button
            onClick={() => disconnect()}
            className="text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1"
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
    >
      Connect Wallet
    </button>
  );
}
