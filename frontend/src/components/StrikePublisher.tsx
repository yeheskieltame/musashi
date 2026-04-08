"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  CONVICTION_LOG_ADDRESS,
  CONVICTION_LOG_ABI,
  OG_EXPLORER,
} from "@/lib/contracts";
import { GlassCard } from "./GlassCard";

interface Props {
  token?: string;
  chainId?: number;
  convergence?: number;
  evidenceHash?: string;
}

export function StrikePublisher({
  token,
  chainId = 1,
  convergence = 3,
  evidenceHash,
}: Props) {
  const { isConnected } = useAccount();
  const [agentId] = useState(0);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleStrike() {
    if (!token || !evidenceHash) return;

    writeContract({
      address: CONVICTION_LOG_ADDRESS,
      abi: CONVICTION_LOG_ABI,
      functionName: "logStrike",
      args: [
        BigInt(agentId),
        token as `0x${string}`,
        BigInt(chainId),
        convergence,
        evidenceHash as `0x${string}`,
      ],
    });
  }

  if (!isConnected) {
    return (
      <GlassCard strong className="p-6 text-center">
        <p className="text-slate-500 text-sm">
          Connect your wallet to publish STRIKEs on-chain
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard strong className="p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Publish STRIKE</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="text-xs text-slate-500">Token</label>
          <div className="font-mono text-slate-700 truncate">
            {token || "Select a token first"}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Chain</label>
          <div className="font-mono text-slate-700">{chainId}</div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Convergence</label>
          <div className="font-mono text-slate-700">{convergence}/4</div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Evidence</label>
          <div className="font-mono text-slate-700 truncate text-xs">
            {evidenceHash || "Run full pipeline first"}
          </div>
        </div>
      </div>

      <button
        onClick={handleStrike}
        disabled={!token || !evidenceHash || isPending || isConfirming}
        className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl px-5 py-3 text-sm font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 cursor-pointer"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : "Sign & Publish STRIKE"}
      </button>

      {error && (
        <p className="text-xs text-red-500">
          {error.message.slice(0, 120)}
        </p>
      )}

      {isSuccess && hash && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-700 font-medium">
            STRIKE published successfully!
          </p>
          <a
            href={`${OG_EXPLORER}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline font-mono break-all"
          >
            {hash}
          </a>
        </div>
      )}
    </GlassCard>
  );
}
