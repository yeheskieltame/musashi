import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

const PROJECT_ROOT = resolve(process.cwd(), "..");
const MAX_MESSAGE_LENGTH = 4000;

// Simple in-memory rate limiter (per-IP, 10 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

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

// Load .env from project root for child processes
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

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return Response.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, agent, sessionId } = body;

  if (!message || typeof message !== "string") {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
  }

  // Sanitize sessionId to prevent argument injection
  if (sessionId !== undefined && (typeof sessionId !== "string" || !/^[\w-]+$/.test(sessionId))) {
    return Response.json({ error: "Invalid sessionId format" }, { status: 400 });
  }

  const agentType = agent === "openclaw" ? "openclaw" : "claude";

  if (agentType === "claude") {
    return streamClaude(message, sessionId);
  } else {
    return streamOpenClaw(message, sessionId);
  }
}

function streamClaude(message: string, sessionId?: string): Response {
  const args = [
    "-p",
    "--verbose",
    "--model", "sonnet",
    "--output-format", "stream-json",
    "--allowedTools", "Bash,Read,Glob,Grep,WebSearch,WebFetch",
    "--no-session-persistence",
  ];

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  args.push(message);

  const child = spawn("claude", args, {
    cwd: PROJECT_ROOT,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Close stdin immediately to prevent "no stdin data" warning
  child.stdin.end();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        // Parse stream-json lines and extract content
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text") {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`
                  ));
                } else if (block.type === "tool_use") {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: "tool", name: block.name, input: block.input })}\n\n`
                  ));
                }
              }
            } else if (event.type === "result") {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  result: event.result,
                  sessionId: event.session_id,
                  cost: event.total_cost_usd,
                })}\n\n`
              ));
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "error", content: text })}\n\n`
          ));
        }
      });

      child.on("close", () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`
        ));
        controller.close();
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

function streamOpenClaw(message: string, sessionId?: string): Response {
  // OpenClaw: `openclaw run -p "message"` or pipe stdin
  // Adapt based on actual OpenClaw CLI — for now mirrors claude pattern
  const args = ["run", "-p"];

  if (sessionId) {
    args.push("--session", sessionId);
  }

  args.push(message);

  const child = spawn("openclaw", args, {
    cwd: PROJECT_ROOT,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Close stdin immediately
  child.stdin.end();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "text", content: text })}\n\n`
        ));
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "error", content: text })}\n\n`
          ));
        }
      });

      child.on("close", () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", content: `OpenClaw not found: ${err.message}. Install from https://github.com/openclaw/openclaw` })}\n\n`
        ));
        controller.close();
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
