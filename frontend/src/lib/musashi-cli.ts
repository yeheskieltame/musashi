import { execFile } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

const PROJECT_ROOT = resolve(process.cwd(), "..");
const BINARY = resolve(PROJECT_ROOT, "scripts/musashi-core/musashi-core");

// Load .env from project root so musashi-core gets contract addresses + RPC
function loadParentEnv(): Record<string, string> {
  const extra: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(PROJECT_ROOT, ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && val) extra[key] = val;
    }
  } catch {
    // .env may not exist — non-fatal
  }
  return extra;
}

const parentEnv = loadParentEnv();

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      BINARY,
      args,
      { timeout: 60_000, maxBuffer: 1024 * 1024, env: { ...process.env, ...parentEnv } },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

// Validation helpers
const VALID_CHAIN_IDS = new Set([0, 1, 56, 137, 42161, 8453, 16661]);

function validateAddress(token: string): string {
  const cleaned = token.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleaned)) {
    throw new Error("Invalid token address format");
  }
  return cleaned;
}

function validateChainId(chainId: number): number {
  const id = Math.floor(chainId);
  if (!VALID_CHAIN_IDS.has(id)) {
    throw new Error(`Invalid chain ID: ${id}`);
  }
  return id;
}

function validateLimit(limit: number, max = 50): number {
  const n = Math.floor(limit);
  if (n < 1 || n > max) {
    throw new Error(`Limit must be between 1 and ${max}`);
  }
  return n;
}

function validateQuery(query: string, maxLen = 200): string {
  const cleaned = query.trim();
  if (!cleaned || cleaned.length > maxLen) {
    throw new Error(`Query must be 1-${maxLen} characters`);
  }
  // Strip shell-dangerous characters (defense in depth, execFile already safe)
  return cleaned.replace(/[;&|`$(){}]/g, "");
}

export async function runGates(token: string, chainId: number) {
  const safeToken = validateAddress(token);
  const safeChain = validateChainId(chainId);
  const out = await run(["gates", safeToken, "--chain", String(safeChain), "--output", "json"]);
  return JSON.parse(out);
}

export async function runScan(chainId: number, limit: number, gates: boolean) {
  const safeChain = validateChainId(chainId);
  const safeLimit = validateLimit(limit);
  const args = ["scan", "--chain", String(safeChain), "--limit", String(safeLimit)];
  if (gates) args.push("--gates");
  const out = await run(args);
  return JSON.parse(out);
}

export async function runSearch(query: string, limit: number) {
  const safeQuery = validateQuery(query);
  const safeLimit = validateLimit(limit, 20);
  const out = await run(["search", safeQuery, "--limit", String(safeLimit)]);
  return JSON.parse(out);
}

export async function runDiscover(chainId: number, limit: number) {
  const safeChain = validateChainId(chainId);
  const safeLimit = validateLimit(limit);
  const out = await run(["discover", "--chain", String(safeChain), "--limit", String(safeLimit)]);
  return JSON.parse(out);
}

export async function runStatus(perAgent: boolean, agentId: number) {
  const args = ["status"];
  if (perAgent) {
    const safeId = Math.floor(agentId);
    if (safeId < 0 || safeId > 100000) throw new Error("Invalid agentId");
    args.push("--per-agent", "--agent-id", String(safeId));
  }
  const out = await run(args);
  return JSON.parse(out);
}

export async function runAgentInfo(tokenId: number) {
  const safeId = Math.floor(tokenId);
  if (safeId < 0 || safeId > 100000) throw new Error("Invalid tokenId");
  const out = await run(["agent-info", "--token-id", String(safeId)]);
  return JSON.parse(out);
}
