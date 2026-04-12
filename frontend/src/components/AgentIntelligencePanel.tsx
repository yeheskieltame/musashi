"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { GlassCard } from "./GlassCard";
import {
  MUSASHI_INFT_ADDRESS,
  MUSASHI_INFT_ABI,
  CONVICTION_LOG_ADDRESS,
  OG_CHAIN_ID,
  OG_RPC,
  OG_EXPLORER,
  OG_STORAGE_SCAN,
  storageScanUrl,
  chainScanAddress,
} from "@/lib/contracts";

// AgentIntelligencePanel — visualizes the ERC-7857 state of a MUSASHI agent.
//
// Judges watching the demo see, without having to trust our word:
//   - Where the encrypted intelligence bundle lives on 0G Storage (merkle root
//     + one-click link to 0G StorageScan).
//   - That the agent holds a real sealed symmetric key (byte length shown,
//     contents never exposed — only the owner can decrypt client-side).
//   - Which address is authorized to perform oracle-verified re-seals on
//     transfer / clone (`oracle()`), proving the ERC-7857 oracle slot is
//     wired to a real signer, not left empty.
//   - The agent's re-seal version counter (bumps on every transfer/clone/
//     update), demonstrating the replay-protection story.
//
// All reads are direct on-chain calls (no backend hop) so the panel works
// even if the Go binary is offline — it is the clearest possible proof that
// the contracts on 0G Mainnet really implement the claimed behavior.

const ogChain = {
  id: OG_CHAIN_ID,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "A0GI", decimals: 18 },
  rpcUrls: { default: { http: [OG_RPC] } },
} as const;

const client = createPublicClient({ chain: ogChain, transport: http(OG_RPC) });

type AgentTuple = {
  owner: `0x${string}`;
  active: boolean;
  winRate: number;
  convergenceAvg: number;
  version: number;
  storageRoot: Hex;
  metadataHash: Hex;
  totalStrikes: bigint;
  createdAt: bigint;
  updatedAt: bigint;
  name: string;
};

interface AgentIntel {
  tokenId: number;
  owner: string;
  active: boolean;
  version: number;
  storageRoot: string;
  metadataHash: string;
  totalStrikes: number;
  winRate: number;
  createdAt: number;
  updatedAt: number;
  name: string;
  sealedKeyLength: number;
  oracle: string;
  convictionLog: string;
}

const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const fmtTs = (t: number) => (t > 0 ? new Date(t * 1000).toUTCString().replace("GMT", "UTC") : "—");

export function AgentIntelligencePanel({ tokenId = 0 }: { tokenId?: number }) {
  const [intel, setIntel] = useState<AgentIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentRes, sealedRes, oracleRes, clogRes] = await Promise.all([
        client.readContract({
          address: MUSASHI_INFT_ADDRESS,
          abi: MUSASHI_INFT_ABI,
          functionName: "getAgent",
          args: [BigInt(tokenId)],
        }),
        client.readContract({
          address: MUSASHI_INFT_ADDRESS,
          abi: MUSASHI_INFT_ABI,
          functionName: "getSealedKey",
          args: [BigInt(tokenId)],
        }),
        client.readContract({
          address: MUSASHI_INFT_ADDRESS,
          abi: MUSASHI_INFT_ABI,
          functionName: "oracle",
        }),
        client.readContract({
          address: MUSASHI_INFT_ADDRESS,
          abi: MUSASHI_INFT_ABI,
          functionName: "convictionLog",
        }),
      ]);

      const a = agentRes as unknown as AgentTuple;
      const sealedHex = sealedRes as Hex;
      // Strip 0x, divide by 2 → number of bytes.
      const sealedBytes = sealedHex && sealedHex.length > 2 ? (sealedHex.length - 2) / 2 : 0;

      setIntel({
        tokenId,
        owner: a.owner,
        active: a.active,
        version: Number(a.version),
        storageRoot: a.storageRoot,
        metadataHash: a.metadataHash,
        totalStrikes: Number(a.totalStrikes),
        winRate: Number(a.winRate),
        createdAt: Number(a.createdAt),
        updatedAt: Number(a.updatedAt),
        name: a.name,
        sealedKeyLength: sealedBytes,
        oracle: oracleRes as string,
        convictionLog: clogRes as string,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent intelligence from 0G Chain.");
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh on the ERC-7857 events that actually mutate this panel's state.
  useEffect(() => {
    const unwatch = client.watchContractEvent({
      address: MUSASHI_INFT_ADDRESS,
      abi: MUSASHI_INFT_ABI,
      onLogs: (logs) => {
        const affects = logs.some((l) => {
          const name = (l as unknown as { eventName?: string }).eventName;
          return (
            name === "SealedTransfer" ||
            name === "IntelligenceUpdated" ||
            name === "AgentCloned" ||
            name === "AgentMinted" ||
            name === "OracleSet"
          );
        });
        if (affects) void load();
      },
    });
    return () => { unwatch(); };
  }, [load]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  if (loading) {
    return (
      <GlassCard strong className="p-7">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 rounded-full border-2 border-amber-500/60 border-t-transparent animate-spin" />
          <span className="text-sm">Loading ERC-7857 intelligence state from 0G Chain…</span>
        </div>
      </GlassCard>
    );
  }

  if (error || !intel) {
    return (
      <GlassCard strong className="p-7">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-400">
          {error ?? "No agent intelligence found."}
        </div>
      </GlassCard>
    );
  }

  const oracleSet = intel.oracle !== "0x0000000000000000000000000000000000000000";

  return (
    <GlassCard strong className="p-7 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-500/80">ERC-7857 Intelligence</span>
            <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-300 font-mono">
              v{intel.version}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-white mt-1">{intel.name} <span className="text-white/30 font-light">#{intel.tokenId}</span></h3>
          <p className="text-xs text-white/40 mt-1">
            Encrypted bundle on 0G Storage · AES key sealed to owner pubkey · oracle-verified re-seal on transfer
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] text-[11px] text-white/60 hover:text-white hover:border-white/20 transition-colors"
        >
          refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Storage root — the ONE thing that proves 0G Storage is doing real work */}
        <Field
          label="0G Storage root"
          subtitle="Merkle root of the AES-256-CTR encrypted intelligence bundle"
          value={fmtHash(intel.storageRoot)}
          raw={intel.storageRoot}
          onCopy={() => copy("storageRoot", intel.storageRoot)}
          copied={copied === "storageRoot"}
          linkHref={storageScanUrl(intel.storageRoot)}
          linkLabel="Open in StorageScan ↗"
          accent="amber"
        />

        {/* Sealed key — length only, never bytes. Decryption happens client-side off-dashboard. */}
        <Field
          label="Sealed symmetric key"
          subtitle="ECIES-wrapped AES-256 key · decryptable only by current owner"
          value={`${intel.sealedKeyLength} bytes`}
          raw={`${intel.sealedKeyLength} bytes (hidden)`}
          accent="cyan"
          inline={
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${intel.sealedKeyLength > 0 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
              {intel.sealedKeyLength > 0 ? "sealed" : "missing"}
            </span>
          }
        />

        {/* Oracle — proves the re-encryption oracle slot is wired */}
        <Field
          label="Re-encryption oracle"
          subtitle="ECDSA signer attesting that transfers re-seal to the receiver"
          value={oracleSet ? fmtAddr(intel.oracle) : "NOT SET"}
          raw={intel.oracle}
          onCopy={oracleSet ? () => copy("oracle", intel.oracle) : undefined}
          copied={copied === "oracle"}
          linkHref={oracleSet ? chainScanAddress(intel.oracle) : undefined}
          linkLabel="View on ChainScan ↗"
          accent={oracleSet ? "violet" : "red"}
        />

        {/* Owner */}
        <Field
          label="Owner"
          subtitle="Only this address can update, transfer, clone, or revoke the agent"
          value={fmtAddr(intel.owner)}
          raw={intel.owner}
          onCopy={() => copy("owner", intel.owner)}
          copied={copied === "owner"}
          linkHref={chainScanAddress(intel.owner)}
          linkLabel="View on ChainScan ↗"
          accent="slate"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
        <Stat label="Re-seal version" value={`v${intel.version}`} hint="bumps every transfer / clone / update" />
        <Stat label="Total strikes" value={intel.totalStrikes.toString()} hint="from ConvictionLog" />
        <Stat label="Win rate" value={intel.totalStrikes > 0 ? `${(intel.winRate / 100).toFixed(1)}%` : "—"} hint="bps / 100" />
        <Stat label="Status" value={intel.active ? "active" : "paused"} hint={intel.active ? "accepting strikes" : "disabled"} tone={intel.active ? "ok" : "warn"} />
      </div>

      <div className="pt-3 border-t border-white/5 text-[11px] text-white/30 leading-relaxed">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Linked ConvictionLog:</span>
          <a
            href={chainScanAddress(intel.convictionLog)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-white/50 hover:text-amber-300 transition-colors"
          >
            {fmtAddr(intel.convictionLog)}
          </a>
          <span className={intel.convictionLog.toLowerCase() === CONVICTION_LOG_ADDRESS.toLowerCase() ? "text-emerald-400" : "text-red-400"}>
            {intel.convictionLog.toLowerCase() === CONVICTION_LOG_ADDRESS.toLowerCase() ? "✓ matches dashboard config" : "✗ MISMATCH"}
          </span>
        </div>
        <div className="mt-1">
          Minted {fmtTs(intel.createdAt)} · last update {fmtTs(intel.updatedAt)} · {OG_EXPLORER.replace("https://", "")} · storage: {OG_STORAGE_SCAN.replace("https://", "")}
        </div>
      </div>
    </GlassCard>
  );
}

function Field({
  label,
  subtitle,
  value,
  raw,
  onCopy,
  copied,
  linkHref,
  linkLabel,
  accent,
  inline,
}: {
  label: string;
  subtitle: string;
  value: string;
  raw: string;
  onCopy?: () => void;
  copied?: boolean;
  linkHref?: string;
  linkLabel?: string;
  accent: "amber" | "violet" | "cyan" | "slate" | "red";
  inline?: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    amber: "border-amber-500/30 bg-amber-500/[0.03]",
    violet: "border-violet-500/30 bg-violet-500/[0.03]",
    cyan: "border-cyan-500/30 bg-cyan-500/[0.03]",
    slate: "border-white/10 bg-white/[0.02]",
    red: "border-red-500/30 bg-red-500/[0.03]",
  };
  return (
    <div className={`rounded-xl border ${accentMap[accent]} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</span>
        {inline}
      </div>
      <p className="text-[10px] text-white/30 mt-1 leading-snug">{subtitle}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="font-mono text-sm text-white/90 break-all" title={raw}>{value}</code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/30"
          >
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      {linkHref && (
        <a href={linkHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] text-amber-400 hover:text-amber-300">
          {linkLabel}
        </a>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "warn" }) {
  const toneClass = tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-white";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/30">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-white/25">{hint}</div>
    </div>
  );
}
