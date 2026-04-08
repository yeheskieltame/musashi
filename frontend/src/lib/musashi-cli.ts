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

export async function runGates(token: string, chainId: number) {
  const out = await run(["gates", token, "--chain", String(chainId), "--output", "json"]);
  return JSON.parse(out);
}

export async function runScan(chainId: number, limit: number, gates: boolean) {
  const args = ["scan", "--chain", String(chainId), "--limit", String(limit)];
  if (gates) args.push("--gates");
  const out = await run(args);
  return JSON.parse(out);
}

export async function runSearch(query: string, limit: number) {
  const out = await run(["search", query, "--limit", String(limit)]);
  return JSON.parse(out);
}

export async function runDiscover(chainId: number, limit: number) {
  const out = await run(["discover", "--chain", String(chainId), "--limit", String(limit)]);
  return JSON.parse(out);
}

export async function runStatus(perAgent: boolean, agentId: number) {
  const args = ["status"];
  if (perAgent) {
    args.push("--per-agent", "--agent-id", String(agentId));
  }
  const out = await run(args);
  return JSON.parse(out);
}

export async function runAgentInfo(tokenId: number) {
  const out = await run(["agent-info", "--token-id", String(tokenId)]);
  return JSON.parse(out);
}
