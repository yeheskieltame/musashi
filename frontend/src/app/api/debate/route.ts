import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

/* ---------- constants & env ---------- */

const PROJECT_ROOT = resolve(process.cwd(), "..");
const BINARY = resolve(PROJECT_ROOT, "scripts/musashi-core/musashi-core");
const VALID_CHAIN_IDS = new Set([1, 56, 137, 42161, 8453, 16661]);

const SPECIALIST_TIMEOUT_MS = 120_000;
const JUDGE_TIMEOUT_MS = 180_000;

// Rate limiter: 3 req/min (debates are expensive)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

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
    // non-fatal
  }
  return extra;
}

const parentEnv = loadParentEnv();
const childEnv = { ...process.env, ...parentEnv };

/* ---------- validation ---------- */

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

/* ---------- gate runner ---------- */

function runGates(token: string, chainId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      BINARY,
      ["gates", token, "--chain", String(chainId), "--output", "json"],
      { timeout: 60_000, maxBuffer: 2 * 1024 * 1024, env: childEnv },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/* ---------- specialist definitions ---------- */

interface SpecialistDef {
  name: "safety" | "technical" | "narrative" | "market";
  systemMessage: string;
  buildPrompt: (token: string, chainId: number, gates: Record<string, unknown>) => string;
  extraTools?: string;
}

// Helper to extract gates by number from PipelineResult format: { gates: [{ gate_num, ... }] }
function extractGates(pipeline: Record<string, unknown>, nums: number[]): unknown[] {
  const gates = pipeline.gates as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(gates)) return [];
  return gates.filter((g) => nums.includes(g.gate_num as number));
}

const SPECIALISTS: SpecialistDef[] = [
  {
    name: "safety",
    systemMessage:
      "You are MUSASHI's Safety Specialist. You analyze contract security and liquidity structure. You receive raw gate data and produce a focused risk assessment. Be concise and structured. Output your report in this format: SAFETY REPORT\n\nRISK LEVEL: [SAFE/CAUTION/DANGEROUS]\nSCORE: [1-10]\n\nCONTRACT SAFETY:\n- [findings]\n\nLIQUIDITY STRUCTURE:\n- [findings]\n\nCRITICAL RISKS:\n- [if any]\n\nVERDICT: [1-2 sentence summary]",
    buildPrompt(token, chainId, pipeline) {
      const gateData = extractGates(pipeline, [1, 2]);
      return `${this.systemMessage}\n\nHere is the gate data for token ${token} on chain ${chainId}:\n\n${JSON.stringify(gateData, null, 2)}\n\nAnalyze this data and produce your report.`;
    },
  },
  {
    name: "technical",
    systemMessage:
      "You are MUSASHI's Technical Specialist. You analyze on-chain wallet behavior, holder distribution, and trading patterns. You receive raw gate data and produce a focused technical assessment. Be concise and structured. Output your report in this format: TECHNICAL REPORT\n\nHEALTH: [HEALTHY/NEUTRAL/UNHEALTHY]\nSCORE: [1-10]\n\nHOLDER DISTRIBUTION:\n- [findings]\n\nTRADING PATTERNS:\n- [findings]\n\nSMART MONEY SIGNALS:\n- [findings]\n\nVERDICT: [1-2 sentence summary]",
    buildPrompt(token, chainId, pipeline) {
      const gateData = extractGates(pipeline, [3]);
      return `${this.systemMessage}\n\nHere is the gate data for token ${token} on chain ${chainId}:\n\n${JSON.stringify(gateData, null, 2)}\n\nAnalyze this data and produce your report.`;
    },
  },
  {
    name: "narrative",
    systemMessage:
      "You are MUSASHI's Narrative Specialist. You analyze social momentum and narrative positioning of tokens. You MUST use WebSearch and WebFetch tools to find real-time information about this token on Twitter/X, Farcaster, Reddit, and crypto news. Assess: organic vs bot activity, narrative lifecycle stage (Forming/Growing/Peak/Declining), catalysts, copycat risk. Be concise. Output your report in this format: NARRATIVE REPORT\n\nMOMENTUM: [RISING/STABLE/DECLINING]\nSCORE: [1-10]\n\nSOCIAL SIGNALS:\n- [findings from web search]\n\nNARRATIVE STAGE:\n- [lifecycle assessment]\n\nCATALYSTS:\n- [upcoming events/triggers]\n\nVERDICT: [1-2 sentence summary]",
    extraTools: "WebSearch,WebFetch",
    buildPrompt(token, chainId, pipeline) {
      const age = (pipeline.token_age as string) ?? "unknown";
      const gates = pipeline.gates as Array<Record<string, unknown>> | undefined;
      const summary = Array.isArray(gates)
        ? gates.map((g) => `Gate ${g.gate_num}: ${g.status}`).join(", ")
        : "N/A";
      return `${this.systemMessage}\n\nToken: ${token}\nChain ID: ${chainId}\nToken Age: ${age}\nGate Results Summary: ${summary}\n\nSearch the web for information about this token and produce your report.`;
    },
  },
  {
    name: "market",
    systemMessage:
      "You are MUSASHI's Market Specialist. You analyze macro market conditions and data consistency. You receive raw gate data and assess whether market conditions favor entry. Be concise and structured. Output your report in this format: MARKET REPORT\n\nTIMING: [FAVORABLE/NEUTRAL/UNFAVORABLE]\nSCORE: [1-10]\n\nMACRO CONDITIONS:\n- [BTC dominance, market cap trends]\n\nDATA CONSISTENCY:\n- [cross-validation findings]\n\nENTRY QUALITY:\n- [assessment]\n\nVERDICT: [1-2 sentence summary]",
    buildPrompt(token, chainId, pipeline) {
      const gateData = extractGates(pipeline, [6, 7]);
      return `${this.systemMessage}\n\nHere is the gate data for token ${token} on chain ${chainId}:\n\n${JSON.stringify(gateData, null, 2)}\n\nAnalyze this data and produce your report.`;
    },
  },
];

/* ---------- SSE helpers ---------- */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

function sseWrite(controller: SSEController, encoder: TextEncoder, payload: Record<string, unknown>) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

/* ---------- spawn a Claude agent and stream output ---------- */

function spawnAgent(opts: {
  model: "sonnet" | "opus";
  prompt: string;
  timeoutMs: number;
  allowedTools?: string;
}): {
  process: ReturnType<typeof spawn>;
  result: Promise<string>;
  onChunk: (cb: (text: string) => void) => void;
} {
  const args = [
    "-p",
    "--model", opts.model,
    "--output-format", "stream-json",
    "--no-session-persistence",
  ];

  if (opts.allowedTools) {
    args.push("--allowedTools", opts.allowedTools);
  }

  args.push(opts.prompt);

  const child = spawn("claude", args, {
    cwd: PROJECT_ROOT,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.end();

  let chunkCallback: ((text: string) => void) | null = null;

  const result = new Promise<string>((res, reject) => {
    let accumulated = "";
    let buffer = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Agent timed out"));
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text") {
                accumulated += block.text;
                if (chunkCallback) chunkCallback(block.text);
              }
            }
          } else if (event.type === "result") {
            // Final result — prefer result text if present
            if (event.result) {
              accumulated = event.result;
            }
          }
        } catch {
          // skip non-JSON
        }
      }
    });

    child.on("close", () => {
      clearTimeout(timeout);
      res(accumulated);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return {
    process: child,
    result,
    onChunk(cb) {
      chunkCallback = cb;
    },
  };
}

/* ---------- main orchestration ---------- */

async function orchestrate(
  token: string,
  chainId: number,
  controller: SSEController,
  encoder: TextEncoder,
) {
  /* ---- Phase 1: Gates ---- */
  sseWrite(controller, encoder, { type: "phase", phase: "gates", status: "start" });

  let gatesRaw: string;
  let gates: Record<string, unknown>;
  try {
    gatesRaw = await runGates(token, chainId);
    gates = JSON.parse(gatesRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown gates error";
    sseWrite(controller, encoder, { type: "error", content: `Gates failed: ${msg}` });
    sseWrite(controller, encoder, { type: "done" });
    controller.close();
    return;
  }

  sseWrite(controller, encoder, { type: "gates", data: gates });
  sseWrite(controller, encoder, { type: "phase", phase: "gates", status: "done" });

  /* ---- Phase 2: Specialists (parallel) ---- */
  sseWrite(controller, encoder, { type: "phase", phase: "specialists", status: "start" });

  const reports: Record<string, string> = {};
  const errors: Record<string, string> = {};

  const specialistPromises = SPECIALISTS.map((spec) => {
    const prompt = spec.buildPrompt(token, chainId, gates);

    sseWrite(controller, encoder, { type: "agent_start", agent: spec.name, model: "sonnet" });

    const agent = spawnAgent({
      model: "sonnet",
      prompt,
      timeoutMs: SPECIALIST_TIMEOUT_MS,
      allowedTools: spec.extraTools,
    });

    agent.onChunk((text) => {
      sseWrite(controller, encoder, { type: "agent_stream", agent: spec.name, content: text });
    });

    return agent.result
      .then((report) => {
        reports[spec.name] = report;
        sseWrite(controller, encoder, { type: "agent_report", agent: spec.name, report });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors[spec.name] = msg;
        sseWrite(controller, encoder, { type: "agent_error", agent: spec.name, error: msg });
      });
  });

  await Promise.all(specialistPromises);

  sseWrite(controller, encoder, { type: "phase", phase: "specialists", status: "done" });

  /* ---- Phase 3: Judge ---- */
  sseWrite(controller, encoder, { type: "phase", phase: "judgment", status: "start" });

  // Build gate summary for judge
  const gatesArr = gates.gates as Array<Record<string, unknown>> | undefined;
  const gateSummary = Array.isArray(gatesArr)
    ? gatesArr.map((g) => `Gate ${g.gate_num} (${g.gate}): ${g.status} — ${g.reason ?? ""}`)
    : ["Gate data unavailable"];

  // Build specialist reports block
  const reportsBlock = Object.entries(reports)
    .map(([name, text]) => `=== ${name.toUpperCase()} SPECIALIST ===\n${text}`)
    .join("\n\n");

  const failedAgents = Object.entries(errors)
    .map(([name, msg]) => `=== ${name.toUpperCase()} SPECIALIST (FAILED) ===\nError: ${msg}`)
    .join("\n\n");

  const judgePrompt = `You are MUSASHI's Conviction Judge, powered by Opus. You have received reports from 4 independent specialist agents. Your job is to cross-examine their findings, identify contradictions and convergence, and make a final PASS or FAIL judgment.

Rules:
- PASS means high conviction entry signal
- FAIL means do not enter
- Hesitation = FAIL
- You must address each specialist's findings
- Identify where specialists agree (convergence) and disagree (contradiction)
- Convergence score: 1-4 (how many domains align positively)

== SPECIALIST REPORTS ==

${reportsBlock}
${failedAgents ? `\n${failedAgents}` : ""}

== GATE DATA ==

${gateSummary.join("\n")}

Now deliver your judgment in this format:

CONVICTION JUDGMENT

VERDICT: [PASS/FAIL]
CONVERGENCE: [1-4]/4
CONFIDENCE: [percentage]

CROSS-EXAMINATION:
- [where specialists agree]
- [where they contradict]
- [hidden patterns]

DECISIVE FACTOR: [what tipped the decision]

FINAL REASONING: [2-3 sentences]`;

  sseWrite(controller, encoder, { type: "judge_start", model: "opus" });

  let judgeReport = "";

  try {
    const judge = spawnAgent({
      model: "opus",
      prompt: judgePrompt,
      timeoutMs: JUDGE_TIMEOUT_MS,
    });

    judge.onChunk((text) => {
      sseWrite(controller, encoder, { type: "judge_stream", content: text });
    });

    judgeReport = await judge.result;

    // Parse verdict from judge report
    const passMatch = /VERDICT:\s*(PASS|FAIL)/i.exec(judgeReport);
    const convergenceMatch = /CONVERGENCE:\s*(\d)/i.exec(judgeReport);

    sseWrite(controller, encoder, {
      type: "verdict",
      result: {
        pass: passMatch ? passMatch[1].toUpperCase() === "PASS" : false,
        convergence: convergenceMatch ? parseInt(convergenceMatch[1], 10) : 0,
        reasoning: judgeReport,
        reports,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown judge error";
    sseWrite(controller, encoder, { type: "error", content: `Judge failed: ${msg}` });
    // Still send partial results
    sseWrite(controller, encoder, {
      type: "verdict",
      result: {
        pass: false,
        convergence: 0,
        reasoning: `Judge failed: ${msg}. Partial specialist reports available.`,
        reports,
      },
    });
  }

  sseWrite(controller, encoder, { type: "phase", phase: "judgment", status: "done" });
  sseWrite(controller, encoder, { type: "done" });
  controller.close();
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { error: "Rate limit exceeded. Debates are expensive — try again in a minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, chain } = body;

  if (!token || typeof token !== "string") {
    return Response.json({ error: "token address required" }, { status: 400 });
  }

  if (chain === undefined || typeof chain !== "number") {
    return Response.json({ error: "chain ID required (number)" }, { status: 400 });
  }

  let safeToken: string;
  let safeChain: number;
  try {
    safeToken = validateAddress(token);
    safeChain = validateChainId(chain);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Validation error";
    return Response.json({ error: msg }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      orchestrate(safeToken, safeChain, controller, encoder).catch((err) => {
        const msg = err instanceof Error ? err.message : "Orchestration error";
        try {
          sseWrite(controller, encoder, { type: "error", content: msg });
          sseWrite(controller, encoder, { type: "done" });
          controller.close();
        } catch {
          // controller may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
