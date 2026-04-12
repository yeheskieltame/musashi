import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";
import { MUSASHI_SYSTEM_PROMPT } from "@/lib/musashi-system-prompt";

// ─────────────────────────────────────────────────────────────────────────────
// MUSASHI chat API — routes user messages to either Claude Code or OpenClaw as
// the LLM runtime. Both runtimes receive the same MUSASHI persona primer so
// behavior is consistent regardless of which tab the user picked.
//
// Claude Code adapter:
//   Uses `claude -p --append-system-prompt <primer>` + `--resume <id>` and
//   pipes the user message via stdin. Sessions persist to ~/.claude so
//   subsequent turns can resume with context.
//
// OpenClaw adapter:
//   Uses `openclaw --log-level silent agent --local --agent main --json
//   --message <msg> [--session-id <id>]`. OpenClaw's `agent` command has NO
//   --system-prompt flag; the primer is prepended to the *first* user message
//   (the one without a session id). Subsequent turns reuse the session which
//   already has the primer in its history. Output goes to stderr (not stdout)
//   along with log lines, so we buffer stderr, extract the trailing JSON
//   payload, and stream its `payloads[].text` back as a single SSE chunk.
//   Errors from OpenClaw (auth failure, missing config) are surfaced as
//   actionable setup instructions instead of opaque 500s.
// ─────────────────────────────────────────────────────────────────────────────

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

  const { message, agent, sessionId: rawSessionId } = body;

  if (!message || typeof message !== "string") {
    return Response.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
  }

  // null / "" / missing → no session. Only validate actual string IDs.
  let sessionId: string | undefined;
  if (typeof rawSessionId === "string" && rawSessionId.length > 0) {
    if (!/^[\w-]+$/.test(rawSessionId)) {
      return Response.json({ error: "Invalid sessionId format" }, { status: 400 });
    }
    sessionId = rawSessionId;
  }

  const agentType = agent === "openclaw" ? "openclaw" : "claude";
  return agentType === "claude"
    ? streamClaude(message, sessionId)
    : streamOpenClaw(message, sessionId);
}

// ─────────────────────────────────────────────────────────────── Claude Code ─

function streamClaude(message: string, sessionId?: string): Response {
  // NOTES:
  //   - Session persistence MUST stay on (do not pass --no-session-persistence),
  //     otherwise --resume fails next turn with "No conversation found".
  //   - The user message is always piped via stdin, never as a positional arg.
  //     Claude Code parses `--resume <uuid> "<msg>"` inconsistently and can
  //     emit "Input must be provided either through stdin or as a prompt
  //     argument". stdin works for both fresh and resumed conversations.
  //   - --append-system-prompt injects the MUSASHI primer on top of the
  //     default Claude Code system prompt, so the runtime behaves as MUSASHI
  //     even on turn 1 when no prior context exists.
  const args = [
    "-p",
    "--verbose",
    "--model", "sonnet",
    "--output-format", "stream-json",
    "--allowedTools", "Bash,Read,Glob,Grep,WebSearch,WebFetch",
    "--append-system-prompt", MUSASHI_SYSTEM_PROMPT,
  ];

  if (sessionId) args.push("--resume", sessionId);

  const child = spawn("claude", args, {
    cwd: PROJECT_ROOT,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write(message);
  child.stdin.end();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text") {
                  sendEvent({ type: "text", content: block.text });
                } else if (block.type === "tool_use") {
                  sendEvent({ type: "tool", name: block.name, input: block.input });
                }
              }
            } else if (event.type === "result") {
              sendEvent({
                type: "done",
                result: event.result,
                sessionId: event.session_id,
                cost: event.total_cost_usd,
              });
            }
          } catch {
            // non-JSON line, skip
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) sendEvent({ type: "error", content: text });
      });

      child.on("close", () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      child.on("error", (err) => {
        sendEvent({ type: "error", content: err.message });
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

// ─────────────────────────────────────────────────────────────────── OpenClaw ─

interface OpenClawPayload {
  text?: string;
  mediaUrl?: string | null;
}
interface OpenClawResult {
  payloads?: OpenClawPayload[];
  meta?: {
    aborted?: boolean;
    agentMeta?: {
      sessionId?: string;
      model?: string;
      provider?: string;
    };
    stopReason?: string;
  };
}

/** Extract the last complete top-level JSON object from a mixed stderr blob. */
function extractTrailingJson(raw: string): OpenClawResult | null {
  // OpenClaw emits log lines then a pretty-printed JSON at the end. We walk
  // from the end backwards to find the matching `{...}` of the final object.
  const end = raw.lastIndexOf("}");
  if (end < 0) return null;

  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = end; i >= 0; i--) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) { start = i; break; }
    }
  }
  if (start < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as OpenClawResult;
  } catch {
    return null;
  }
}

function openClawSetupHelp(reason: string): string {
  return [
    `OpenClaw runtime is installed but can't run an agent turn.`,
    `Reason: ${reason}`,
    ``,
    `First-time setup (one command each):`,
    `  openclaw configure                     # credentials + model provider key`,
    `  openclaw skills install musashi        # install the MUSASHI skill from ClawHub`,
    `  openclaw agent --local --agent main \\`,
    `    --message "musashi scan base"        # smoke test`,
    ``,
    `For an immediate interactive demo without OpenClaw, switch to the`,
    `**Claude Code** tab — it runs the same MUSASHI primer via the local`,
    `\`musashi-core\` binary and already has credentials wired.`,
  ].join("\n");
}

function streamOpenClaw(message: string, sessionId?: string): Response {
  // Prepend the MUSASHI primer to the first turn's user message since
  // OpenClaw's `agent` command has no --system-prompt flag. Subsequent turns
  // share the session's history which already contains the primer.
  const content = sessionId
    ? message
    : `${MUSASHI_SYSTEM_PROMPT}\n\n---\n\nUser: ${message}`;

  const args = [
    "--log-level", "silent",
    "agent",
    "--local",
    "--agent", "main",
    "--json",
    "--message", content,
  ];
  if (sessionId) args.push("--session-id", sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const finish = () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      // Quick user-facing status so they don't stare at a blinking cursor
      // during OpenClaw's multi-second model cold start.
      sendEvent({ type: "text", content: "Spinning up OpenClaw local agent...\n\n" });

      let child;
      try {
        child = spawn("openclaw", args, {
          cwd: PROJECT_ROOT,
          env: childEnv,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (e) {
        sendEvent({ type: "error", content: openClawSetupHelp((e as Error).message) });
        finish();
        return;
      }
      child.stdin.end();

      let stderrBuf = "";
      let stdoutBuf = "";

      child.stdout.on("data", (c: Buffer) => { stdoutBuf += c.toString(); });
      child.stderr.on("data", (c: Buffer) => { stderrBuf += c.toString(); });

      child.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          sendEvent({
            type: "error",
            content: "OpenClaw CLI not found on this machine. Install it from https://github.com/openclaw/openclaw, then `openclaw configure` and `openclaw skills install musashi`. Meanwhile use the Claude Code tab for the interactive demo.",
          });
        } else {
          sendEvent({ type: "error", content: openClawSetupHelp(err.message) });
        }
        finish();
      });

      child.on("close", (code) => {
        // JSON payload lives in stderr (OpenClaw mixes logs + final JSON there).
        // Stdout is usually empty but we check it too just in case a future
        // version moves things around.
        const raw = stderrBuf + stdoutBuf;
        const parsed = extractTrailingJson(raw);

        if (!parsed) {
          sendEvent({
            type: "error",
            content: `OpenClaw exited with code ${code} but produced no parseable JSON payload.\n\nLast stderr bytes:\n${raw.slice(-600)}`,
          });
          finish();
          return;
        }

        const payloadText = (parsed.payloads ?? [])
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("\n");
        const stopReason = parsed.meta?.stopReason;
        const newSessionId = parsed.meta?.agentMeta?.sessionId;

        // Auth / setup failure — recognize it and give actionable help instead
        // of just relaying OpenClaw's raw "HTTP 401" blurb.
        if (
          stopReason === "error" &&
          /401|authentication|credentials|unauthorized|api key/i.test(payloadText)
        ) {
          sendEvent({ type: "text", content: "\n" });
          sendEvent({
            type: "text",
            content: openClawSetupHelp(
              `OpenClaw reported: ${payloadText.split("\n")[0] || "auth failure"}`
            ),
          });
          sendEvent({ type: "done", result: "", sessionId: null, cost: 0 });
          finish();
          return;
        }

        if (stopReason === "error") {
          sendEvent({ type: "text", content: "\n" });
          sendEvent({ type: "error", content: payloadText || "OpenClaw reported an error." });
          finish();
          return;
        }

        // Success path — stream the full reply as a single text chunk plus the
        // session id so the client can resume on the next turn.
        sendEvent({ type: "text", content: "\n" });
        sendEvent({ type: "text", content: payloadText });
        sendEvent({
          type: "done",
          result: payloadText,
          sessionId: newSessionId ?? null,
          cost: 0,
        });
        finish();
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
