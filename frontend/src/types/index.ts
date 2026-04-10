export interface GateEvidence {
  source: string;
  key: string;
  value: string;
}

export interface GateResult {
  gate: string;
  gate_num: number;
  status: "PASS" | "FAIL" | "WARN";
  reason: string;
  evidence: GateEvidence[];
}

export interface PipelineResult {
  token: string;
  chain_id: number;
  timestamp: string;
  status: "PASS" | "FAIL" | "WARN";
  failed_at: number;
  token_age: "fresh" | "early" | "established";
  age_hours: number;
  gates: GateResult[];
}

export interface ScanToken {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  chain_id: number;
  price_usd: string;
  market_cap: number;
  liquidity_usd: number;
  volume_24h: number;
  token_age: string;
  age_hours: number;
  holder_count: string;
  score: number;
  score_breakdown: string;
  safety_check: string;
  gate_result?: string;
  source: string;
}

export interface ScanResult {
  timestamp: string;
  chain_id: number;
  total_found: number;
  screened: number;
  top_picks: ScanToken[];
}

export interface SearchResult {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  price_usd: string;
  liquidity_usd: number;
  volume_24h: number;
  fdv: number;
  pair_url: string;
}

export interface ReputationResult {
  strike_count: number;
  total_filled: number;
  wins: number;
  losses: number;
  total_return_bps: number;
  contract_address: string;
  explorer_url: string;
}

export interface AgentInfo {
  token_id: number;
  owner: string;
  active: boolean;
  win_rate_bps: number;
  config_hash: string;
  intelligence_hash: string;
  total_strikes: number;
  name: string;
  agent_count: number;
  contract_address: string;
  explorer_url: string;
}

export interface StrikeResult {
  tx_hash: string;
  block_number: number;
  contract_address: string;
  agent_id?: number;
  explorer_url: string;
  status: string;
}

export interface StoreResult {
  root_hash: string;
  tx_hash: string;
  status: string;
  explorer_url: string;
  storage_scan: string;
  download_cmd: string;
}

// Debate types
export interface DebateEvent {
  type: "phase" | "gates" | "agent_start" | "agent_stream" | "agent_report" | "agent_error" | "judge_start" | "judge_stream" | "verdict" | "error" | "done";
  phase?: "gates" | "specialists" | "judgment";
  status?: "start" | "done";
  data?: PipelineResult;
  agent?: "safety" | "technical" | "narrative" | "market";
  model?: string;
  content?: string;
  report?: string;
  error?: string;
  result?: DebateVerdict;
}

export interface DebateVerdict {
  pass: boolean;
  convergence: number;
  confidence?: string;
  reasoning: string;
  decisive_factor?: string;
  cross_examination?: string;
}

export type AgentStatus = "waiting" | "running" | "done" | "error";

export interface TerminalLine {
  id: number;
  agent: "safety" | "technical" | "narrative" | "market" | "judge" | "system";
  content: string;
  timestamp: Date;
  type: "stream" | "report" | "phase" | "error" | "verdict";
}

export type ChainId = 0 | 1 | 56 | 137 | 42161 | 8453 | 16661;

export const CHAIN_NAMES: Record<number, string> = {
  0: "All Chains",
  1: "Ethereum",
  56: "BSC",
  137: "Polygon",
  42161: "Arbitrum",
  8453: "Base",
  16661: "0G Chain",
};

export const CHAIN_ICONS: Record<number, string> = {
  1: "ETH",
  56: "BNB",
  137: "MATIC",
  42161: "ARB",
  8453: "BASE",
  16661: "0G",
};
