"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { createPublicClient, http } from "viem";
import {
  CONVICTION_LOG_ADDRESS,
  CONVICTION_LOG_ABI,
  MUSASHI_INFT_ADDRESS,
  MUSASHI_INFT_ABI,
  OG_RPC,
  OG_EXPLORER,
  OG_CHAIN_ID,
} from "@/lib/contracts";
import { GlassCard } from "./GlassCard";
import { CHAIN_NAMES } from "@/types";

const ogChain = {
  id: OG_CHAIN_ID,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "A0GI", decimals: 18 },
  rpcUrls: { default: { http: [OG_RPC] } },
} as const;

const client = createPublicClient({
  chain: ogChain,
  transport: http(OG_RPC),
});

interface AgentOption {
  tokenId: number;
  name: string;
  strikes: number;
  active: boolean;
}

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
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = currentChainId !== OG_CHAIN_ID;
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<number>(0);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fetch user's INFT agents
  useEffect(() => {
    if (!address) return;
    setLoadingAgents(true);

    (async () => {
      try {
        // Get total agent count
        const count = await client.readContract({
          address: MUSASHI_INFT_ADDRESS,
          abi: MUSASHI_INFT_ABI,
          functionName: "agentCount",
        });
        const total = Number(count);

        // Batch-fetch all agents in parallel instead of sequential loop
        const agentPromises = Array.from({ length: total }, (_, i) =>
          client.readContract({
            address: MUSASHI_INFT_ADDRESS,
            abi: MUSASHI_INFT_ABI,
            functionName: "getAgent",
            args: [BigInt(i)],
          }).then((result) => {
            const arr = Array.isArray(result) ? result : null;
            const r = result as Record<string, unknown>;
            return {
              index: i,
              owner: String(arr ? arr[0] : r.owner ?? ""),
              name: String(arr ? arr[9] : r.name ?? `Agent #${i}`),
              strikes: Number(arr ? arr[6] : r.totalStrikes ?? 0),
              active: Boolean(arr ? arr[1] : r.active ?? false),
            };
          }).catch(() => null)
        );

        const results = await Promise.all(agentPromises);
        const owned: AgentOption[] = results
          .filter((r): r is NonNullable<typeof r> =>
            r !== null && r.owner.toLowerCase() === address.toLowerCase()
          )
          .map((r) => ({
            tokenId: r.index,
            name: r.name,
            strikes: r.strikes,
            active: r.active,
          }));

        setAgents(owned);
        if (owned.length > 0) setSelectedAgent(owned[0].tokenId);
      } catch {
        // non-fatal
      } finally {
        setLoadingAgents(false);
      }
    })();
  }, [address]);

  function handleStrike() {
    if (!token || !evidenceHash) return;

    writeContract({
      address: CONVICTION_LOG_ADDRESS,
      abi: CONVICTION_LOG_ABI,
      functionName: "logStrike",
      args: [
        BigInt(selectedAgent),
        token as `0x${string}`,
        BigInt(chainId),
        convergence,
        evidenceHash as `0x${string}`,
      ],
    });
  }

  if (!isConnected) {
    return (
      <GlassCard strong className="p-7 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 mb-1">Connect your wallet to publish STRIKEs on-chain</p>
        <p className="text-xs text-slate-400">Requires 0G Mainnet (Chain ID: 16661) and a minted Agent INFT</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard strong className="p-7">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Publish STRIKE</h2>
          <p className="text-xs text-slate-400">Sign and publish conviction signal to 0G Chain</p>
        </div>
      </div>

      {/* Agent INFT Selection */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Select Agent INFT</label>
        {loadingAgents ? (
          <div className="flex items-center gap-2 text-slate-400 py-3">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-xs">Loading your INFTs...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-sm text-amber-700 font-medium mb-1">No Agent INFT found</p>
            <p className="text-xs text-amber-600">
              You need to mint an Agent INFT before publishing strikes.
              Use the Agent Chat to run: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">mint-agent --name YourAgentName</code>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <button
                key={a.tokenId}
                onClick={() => setSelectedAgent(a.tokenId)}
                className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedAgent === a.tokenId
                    ? "border-blue-500/30 bg-blue-50/50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold`}>
                    #{a.tokenId}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>Token #{a.tokenId}</span>
                      <span>{a.strikes} strikes</span>
                      {a.active && <span className="text-emerald-500">Active</span>}
                    </div>
                  </div>
                </div>
                {selectedAgent === a.tokenId && (
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Strike Details */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-5">
        <div className="glass rounded-xl p-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Token</label>
          <div className="font-mono text-slate-700 truncate text-sm mt-0.5">
            {token || "—"}
          </div>
        </div>
        <div className="glass rounded-xl p-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Chain</label>
          <div className="text-slate-700 text-sm mt-0.5">{CHAIN_NAMES[chainId] || `Chain ${chainId}`}</div>
        </div>
        <div className="glass rounded-xl p-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Convergence</label>
          <div className={`text-sm font-semibold mt-0.5 ${convergence >= 4 ? "text-emerald-600" : "text-blue-600"}`}>{convergence}/4</div>
        </div>
        <div className="glass rounded-xl p-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Evidence Hash</label>
          <div className="font-mono text-slate-700 truncate text-[11px] mt-0.5">
            {evidenceHash || "—"}
          </div>
        </div>
      </div>

      {/* Wrong chain warning */}
      {isWrongChain && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-700 font-medium">Wrong network</p>
            <p className="text-xs text-amber-600">Switch to 0G Mainnet (Chain ID: {OG_CHAIN_ID}) to publish strikes.</p>
          </div>
          <button
            onClick={() => switchChain({ chainId: OG_CHAIN_ID })}
            className="text-xs px-4 py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer font-medium whitespace-nowrap"
            aria-label="Switch to 0G Mainnet"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Publish button */}
      <button
        onClick={handleStrike}
        disabled={!token || !evidenceHash || agents.length === 0 || isPending || isConfirming || isWrongChain}
        className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl px-5 py-3.5 text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 cursor-pointer"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming on 0G Chain..."
            : `Sign & Publish as ${agents.find((a) => a.tokenId === selectedAgent)?.name || "Agent"}`}
      </button>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-xs text-red-500">{error.message.slice(0, 150)}</p>
        </div>
      )}

      {isSuccess && hash && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-700 font-semibold mb-1">STRIKE published on 0G Chain!</p>
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
