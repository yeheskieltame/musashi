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
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,255,255,0.02)]">
          <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm text-white font-bold mb-1 tracking-wide">Connect your wallet to publish STRIKEs on-chain</p>
        <p className="text-xs text-white/40 font-medium">Requires 0G Mainnet (Chain ID: 16661) and a minted Agent INFT</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md relative overflow-hidden group shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.05),transparent_70%)] pointer-events-none" />
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-black text-white tracking-wide">Publish STRIKE</h2>
          <p className="text-xs font-semibold text-white/40 mt-1">Sign and publish conviction signal to 0G Chain</p>
        </div>
      </div>

      {/* Agent INFT Selection */}
      <div className="mb-6 relative z-10">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 block">Select Agent INFT</label>
        {loadingAgents ? (
          <div className="flex items-center gap-3 text-white/50 py-4 bg-[#0a0e1a]/40 rounded-xl px-4 border border-white/5">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Loading your INFTs...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
            <p className="text-sm text-amber-400 font-bold mb-2 tracking-wide flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
               No Agent INFT found
            </p>
            <p className="text-xs font-medium text-amber-300/80 leading-relaxed">
              You need to mint an Agent INFT before publishing strikes.
              Use the Agent Chat to run: <code className="bg-amber-500/20 px-2 py-1 rounded-md text-[11px] text-amber-300 font-mono font-bold border border-amber-500/30 ml-1">mint-agent --name YourAgentName</code>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <button
                key={a.tokenId}
                onClick={() => setSelectedAgent(a.tokenId)}
                className={`w-full text-left flex items-center justify-between p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                  selectedAgent === a.tokenId
                    ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shadow-inner border ${selectedAgent === a.tokenId ? "bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "bg-white/10 border-white/20 text-white/60"}`}>
                    #{a.tokenId}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white tracking-wide">{a.name}</span>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/10">Token #{a.tokenId}</span>
                      <span className="text-[10px] font-bold text-blue-400">{a.strikes} strikes</span>
                      {a.active && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>}
                    </div>
                  </div>
                </div>
                {selectedAgent === a.tokenId && (
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Strike Details */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-6 relative z-10">
        <div className="bg-[#0a0e1a]/40 border border-white/5 rounded-xl p-4 shadow-inner">
          <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Token</label>
          <div className="font-mono text-white truncate text-[13px] font-bold">
            {token || "—"}
          </div>
        </div>
        <div className="bg-[#0a0e1a]/40 border border-white/5 rounded-xl p-4 shadow-inner">
          <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Chain</label>
          <div className="text-white text-[13px] font-bold">{CHAIN_NAMES[chainId] || `Chain ${chainId}`}</div>
        </div>
        <div className="bg-[#0a0e1a]/40 border border-white/5 rounded-xl p-4 shadow-inner">
          <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Convergence</label>
          <div className={`text-[13px] font-black tracking-wider ${convergence >= 4 ? "text-emerald-400" : "text-blue-400"}`}>{convergence}/4</div>
        </div>
        <div className="bg-[#0a0e1a]/40 border border-white/5 rounded-xl p-4 shadow-inner">
          <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Evidence Hash</label>
          <div className="font-mono text-blue-300/80 truncate text-[11px] font-semibold">
            {evidenceHash || "—"}
          </div>
        </div>
      </div>

      {/* Wrong chain warning */}
      {isWrongChain && (
        <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 p-5 flex items-center justify-between relative z-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <div>
            <p className="text-sm text-white font-bold tracking-wide flex items-center gap-2">
               <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
               Wrong network
            </p>
            <p className="text-xs font-medium text-amber-400/80 mt-1">Switch to 0G Mainnet (Chain ID: {OG_CHAIN_ID}) to publish strikes.</p>
          </div>
          <button
            onClick={() => switchChain({ chainId: OG_CHAIN_ID })}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer whitespace-nowrap border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
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
        className="relative w-full bg-blue-600 border border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] text-white rounded-xl px-6 py-4 text-sm font-black uppercase tracking-widest hover:bg-blue-500 transition-all duration-300 disabled:opacity-50 disabled:shadow-none cursor-pointer overflow-hidden z-10"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
        {isPending
          ? (
            <>
               <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
               Signing...
            </>
          )
          : isConfirming
            ? (
               <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Confirming on 0G Chain...
               </>
            )
            : `Sign & Publish as ${agents.find((a) => a.tokenId === selectedAgent)?.name || "Agent"}`}
        </span>
      </button>

      {error && (
        <div className="mt-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 relative z-10 text-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <p className="text-xs font-bold text-rose-400">{error.message.slice(0, 150)}</p>
        </div>
      )}

      {isSuccess && hash && (
        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 relative z-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          <p className="text-[13px] text-emerald-400 font-black mb-2 tracking-wide flex items-center gap-2">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
             </svg>
             STRIKE published on 0G Chain!
          </p>
          <div className="bg-black/30 rounded-lg p-3 border border-emerald-500/20">
             <a
               href={`${OG_EXPLORER}/tx/${hash}`}
               target="_blank"
               rel="noopener noreferrer"
               className="text-xs font-bold font-mono text-emerald-300/80 hover:text-emerald-300 break-all transition-colors inline-block"
             >
               Tx: {hash} ↗
             </a>
          </div>
        </div>
      )}
    </div>
  );
}
