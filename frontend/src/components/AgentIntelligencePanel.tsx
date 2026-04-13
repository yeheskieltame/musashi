"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
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
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md">
        <div className="flex items-center gap-3 text-white/50">
          <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span className="text-sm font-semibold">Loading ERC-7857 intelligence state from 0G Chain…</span>
        </div>
      </div>
    );
  }

  if (error || !intel) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-sm font-bold text-rose-400">
          {error ?? "No agent intelligence found."}
        </div>
      </div>
    );
  }

  const oracleSet = intel.oracle !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-7 backdrop-blur-md space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-blue-400">ERC-7857 Intelligence</span>
            <span className="px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold text-blue-300 font-mono">
              v{intel.version}
            </span>
          </div>
          <h3 className="text-2xl font-black text-white mt-1.5 tracking-tight">{intel.name} <span className="text-white/30 font-light">#{intel.tokenId}</span></h3>
          <p className="text-xs font-semibold text-white/40 mt-1">
            Encrypted bundle on 0G Storage · AES key sealed to owner pubkey · oracle-verified re-seal on transfer
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.05] text-[11px] font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-inner"
        >
          REFRESH
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage root */}
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

        {/* Sealed key */}
        <Field
          label="Sealed symmetric key"
          subtitle="ECIES-wrapped AES-256 key · decryptable only by current owner"
          value={`${intel.sealedKeyLength} bytes`}
          raw={`${intel.sealedKeyLength} bytes (hidden)`}
          accent="cyan"
          inline={
            <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold font-mono ${intel.sealedKeyLength > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
              {intel.sealedKeyLength > 0 ? "SEALED" : "MISSING"}
            </span>
          }
        />

        {/* Oracle */}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        <Stat label="Re-seal version" value={`v${intel.version}`} hint="bumps every transfer / clone / update" />
        <Stat label="Total strikes" value={intel.totalStrikes.toString()} hint="from ConvictionLog" />
        <Stat label="Win rate" value={intel.totalStrikes > 0 ? `${(intel.winRate / 100).toFixed(1)}%` : "—"} hint="bps / 100" />
        <Stat label="Status" value={intel.active ? "active" : "paused"} hint={intel.active ? "accepting strikes" : "disabled"} tone={intel.active ? "ok" : "warn"} />
      </div>

      <div className="pt-4 border-t border-white/10 text-[11px] font-semibold text-white/40 leading-relaxed">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Linked ConvictionLog:</span>
          <a
            href={chainScanAddress(intel.convictionLog)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-bold text-white/70 hover:text-blue-400 transition-colors"
          >
            {fmtAddr(intel.convictionLog)}
          </a>
          <span className={intel.convictionLog.toLowerCase() === CONVICTION_LOG_ADDRESS.toLowerCase() ? "text-emerald-400" : "text-rose-400"}>
            {intel.convictionLog.toLowerCase() === CONVICTION_LOG_ADDRESS.toLowerCase() ? "✓ MATCHES DASHBOARD CONFIG" : "✗ MISMATCH"}
          </span>
        </div>
        <div className="mt-1.5 text-white/30">
          Minted {fmtTs(intel.createdAt)} · last update {fmtTs(intel.updatedAt)} · {OG_EXPLORER.replace("https://", "")} · storage: {OG_STORAGE_SCAN.replace("https://", "")}
        </div>
      </div>
    </div>
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
    amber: "border-amber-500/20 bg-amber-500/[0.05]",
    violet: "border-violet-500/20 bg-violet-500/[0.05]",
    cyan: "border-blue-500/20 bg-blue-500/[0.05]",
    slate: "border-white/10 bg-white/[0.03]",
    red: "border-rose-500/20 bg-rose-500/[0.05]",
  };
  return (
    <div className={`rounded-xl border ${accentMap[accent]} p-5 transition-colors hover:bg-white/[0.06]`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">{label}</span>
        {inline}
      </div>
      <p className="text-[11px] font-medium text-white/40 mt-1.5 leading-snug">{subtitle}</p>
      <div className="mt-3 flex items-center gap-3">
        <code className="font-mono text-sm font-bold text-white break-all" title={raw}>{value}</code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-[10px] font-bold uppercase px-2 py-1 rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-colors"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        )}
      </div>
      {linkHref && (
        <a href={linkHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
          {linkLabel}
        </a>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "warn" }) {
  const toneClass = tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-white";
  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className={`text-xl font-black mt-1 ${toneClass}`}>{value}</div>
      <div className="text-[10px] font-semibold text-white/30 mt-1">{hint}</div>
    </div>
  );
}
