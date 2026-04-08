export const OG_CHAIN_ID = 16661;
export const OG_RPC = "https://evmrpc.0g.ai";
export const OG_EXPLORER = "https://chainscan.0g.ai";

export const CONVICTION_LOG_ADDRESS = "0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed" as `0x${string}`;
export const MUSASHI_INFT_ADDRESS = "0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32" as `0x${string}`;

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
      { name: "w", type: "uint256" },
      { name: "l", type: "uint256" },
      { name: "totalReturn", type: "int256" },
    ],
  },
] as const;

export const MUSASHI_INFT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_configHash", type: "bytes32" },
      { name: "_intelligenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "updateIntelligence",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "_intelligenceHash", type: "bytes32" },
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
          { name: "configHash", type: "bytes32" },
          { name: "intelligenceHash", type: "bytes32" },
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
] as const;
