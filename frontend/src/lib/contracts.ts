// MUSASHI — on-chain ABIs and addresses for the Next.js dashboard.
//
// These point to the ERC-7857 compliant deployment on 0G Mainnet (chain 16661).
// The previous deployment (0xdB5E…/0xfFE8…) was replaced when MusashiINFT was
// upgraded to store encrypted intelligence in 0G Storage and require
// oracle-verified re-encryption on transfer. Never read the old addresses —
// their ABI does not match the new Go binary or agent prompts.

export const OG_CHAIN_ID = 16661;
export const OG_RPC = "https://evmrpc.0g.ai";
export const OG_EXPLORER = "https://chainscan.0g.ai";
export const OG_STORAGE_SCAN = "https://storagescan.0g.ai";

// Env var fallback lets redeployments happen without recompiling the app.
const envAddr = (v: string | undefined, fallback: string) =>
  (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? v : fallback) as `0x${string}`;

export const CONVICTION_LOG_ADDRESS = envAddr(
  process.env.NEXT_PUBLIC_CONVICTION_LOG_ADDRESS,
  "0x2B84aC25498FF0157fAB04fEa9e3544A14882A15"
);

export const MUSASHI_INFT_ADDRESS = envAddr(
  process.env.NEXT_PUBLIC_MUSASHI_INFT_ADDRESS,
  "0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c"
);

// ─────────────────────────────── ConvictionLog ABI ───────────────────────────
// ABI unchanged from the previous version. Included here so all on-chain ABIs
// live in one place.
export const CONVICTION_LOG_ABI = [
  {
    name: "logStrike",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_agentId", type: "uint256" },
      { name: "_token", type: "address" },
      { name: "_chainId", type: "uint64" },
      { name: "_convergence", type: "uint8" },
      { name: "_evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "recordOutcome",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_id", type: "uint256" },
      { name: "_returnBps", type: "int128" },
    ],
    outputs: [],
  },
  {
    name: "getStrike",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "convergence", type: "uint8" },
          { name: "outcomeFilled", type: "bool" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "chainId", type: "uint64" },
          { name: "timestamp", type: "uint48" },
          { name: "outcomeBps", type: "int128" },
          { name: "agentId", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "strikeCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "reputation",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "total", type: "uint256" },
      { name: "w", type: "uint256" },
      { name: "l", type: "uint256" },
      { name: "totalReturn", type: "int256" },
    ],
  },
  {
    name: "agentReputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_agentId", type: "uint256" }],
    outputs: [
      { name: "strikes", type: "uint256" },
      { name: "filled", type: "uint256" },
      { name: "w", type: "uint256" },
      { name: "l", type: "uint256" },
      { name: "totalReturn", type: "int256" },
    ],
  },
] as const;

// ─────────────────────────────── MusashiINFT ABI (ERC-7857) ──────────────────
// Contains ONLY the functions/events the dashboard reads or writes. The
// full Solidity contract has more (authorizeUsage, revokeUsage, clone, pause,
// ownership transfer, etc.). Add them here as UI surfaces grow.
//
// Shape notes for viem/wagmi:
//   - `getAgent` returns a tuple whose components (in order) are:
//     owner, active, winRate, convergenceAvg, version, storageRoot,
//     metadataHash, totalStrikes, createdAt, updatedAt, name.
//     The field rename (configHash/intelligenceHash → storageRoot/metadataHash)
//     is deliberate: storageRoot is literally the 0G Storage merkle root
//     pointing at the encrypted intelligence bundle.
//   - `sealedKey(tokenId)` returns the ECIES-wrapped AES key bytes. UI shows
//     length only; never attempt client-side decryption in the browser.
//   - `oracle()` exposes the re-encryption oracle address — UI surfaces this
//     to prove the ERC-7857 oracle slot is wired.
export const MUSASHI_INFT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_storageRoot", type: "bytes32" },
      { name: "_metadataHash", type: "bytes32" },
      { name: "_sealedKey", type: "bytes" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    name: "updateIntelligence",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newStorageRoot", type: "bytes32" },
      { name: "newSealedKey", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "to", type: "address" },
      { name: "newStorageRoot", type: "bytes32" },
      { name: "newSealedKey", type: "bytes" },
      { name: "oracleProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "clone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newOwner", type: "address" },
      { name: "newStorageRoot", type: "bytes32" },
      { name: "newSealedKey", type: "bytes" },
      { name: "oracleProof", type: "bytes" },
    ],
    outputs: [{ name: "newId", type: "uint256" }],
  },
  {
    name: "setOracle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_oracle", type: "address" }],
    outputs: [],
  },
  {
    name: "authorizeUsage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "executor", type: "address" },
      { name: "duration", type: "uint48" },
      { name: "permissionsHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "revokeUsage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "executor", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "active", type: "bool" },
          { name: "winRate", type: "uint16" },
          { name: "convergenceAvg", type: "uint8" },
          { name: "version", type: "uint16" },
          { name: "storageRoot", type: "bytes32" },
          { name: "metadataHash", type: "bytes32" },
          { name: "totalStrikes", type: "uint64" },
          { name: "createdAt", type: "uint48" },
          { name: "updatedAt", type: "uint48" },
          { name: "name", type: "string" },
        ],
      },
    ],
  },
  {
    name: "agentCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "sealedKey",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "getSealedKey",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "oracle",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "convictionLog",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "transferDigest",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "version", type: "uint16" },
      { name: "oldRoot", type: "bytes32" },
      { name: "newRoot", type: "bytes32" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  // ─────── events (for dashboard live feed) ───────
  {
    type: "event",
    name: "AgentMinted",
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "storageRoot", type: "bytes32" },
      { indexed: false, name: "metadataHash", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "SealedTransfer",
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "oldRoot", type: "bytes32" },
      { indexed: false, name: "newRoot", type: "bytes32" },
      { indexed: false, name: "newVersion", type: "uint16" },
    ],
  },
  {
    type: "event",
    name: "IntelligenceUpdated",
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: false, name: "newStorageRoot", type: "bytes32" },
      { indexed: false, name: "totalStrikes", type: "uint64" },
      { indexed: false, name: "winRate", type: "uint16" },
    ],
  },
  {
    type: "event",
    name: "AgentCloned",
    inputs: [
      { indexed: true, name: "originalId", type: "uint256" },
      { indexed: true, name: "newId", type: "uint256" },
      { indexed: true, name: "newOwner", type: "address" },
      { indexed: false, name: "newRoot", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "OracleSet",
    inputs: [
      { indexed: true, name: "oldOracle", type: "address" },
      { indexed: true, name: "newOracle", type: "address" },
    ],
  },
] as const;

// ─────────────────────────────── helpers ─────────────────────────────────────

/** URL to the 0G StorageScan entry for a merkle root. */
export const storageScanUrl = (root: string) => `${OG_STORAGE_SCAN}/tx/${root}`;

/** URL to the 0G ChainScan tx page. */
export const chainScanTx = (hash: string) => `${OG_EXPLORER}/tx/${hash}`;

/** URL to the 0G ChainScan address page. */
export const chainScanAddress = (addr: string) => `${OG_EXPLORER}/address/${addr}`;
