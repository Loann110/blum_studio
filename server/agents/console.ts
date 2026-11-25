// Console agents: which CLI may draw in the Create console, and the exact
// argv to launch it. Only Claude Code is offered: it alone has all three,
// verified with --help — per-launch MCP wiring (--mcp-config plus
// --strict-mcp-config), tool restriction (--allowedTools) and non-interactive
// resume (--resume). Other agents (Codex, Muse...) use Blum through Settings.
import path from "node:path";
import { ADAPTERS } from "./adapters.js";
import { root } from "../paths.js";

export const CONSOLE_AGENT_IDS = ["claude-code"] as const;
export type ConsoleAgentId = (typeof CONSOLE_AGENT_IDS)[number];

// Claude Code names MCP tools mcp__<server>__<tool>: keep Blum alone.
export const BLUM_TOOL_PREFIX = "mcp__blum-studio__*";
export const READ_UPLOADS = "Read(./**)";

export interface ConsoleAgent {
  id: string;
  name: string;
  version?: string;
  installed: boolean;
  usable: boolean; // offered in the console menu
  reason?: string; // why it cannot run (not installed)
}

export async function consoleAgents(): Promise<ConsoleAgent[]> {
  const out: ConsoleAgent[] = [];
  for (const id of CONSOLE_AGENT_IDS) {
    const adapter = ADAPTERS.find((a) => a.id === id);
    if (!adapter) continue;
    let installed = false;
    let version: string | undefined;
    try {
      const found = await adapter.detect();
      installed = found.installed;
      version = found.version;
    } catch {
      installed = false;
    }
    out.push({
      id,
      name: adapter.name,
      version,
      installed,
      usable: installed,
      reason: installed ? undefined : `${adapter.name} is not installed.`,
    });
  }
  return out;
}

/* ---- launch argv (claude-code only) ---- */

export interface LaunchSpec {
  program: string;
  args: string[];
  env: Record<string, string>;
}

function mcpScript(): string {
  return path.join(root(), "server", "dist", "mcp.js");
}

// BLUM_SESSION reaches the MCP process Claude starts, so the designs it
// creates are attributed to this Create session (the server's own memory is
// another process and never sees them). BLUM_DESIGNS keeps both on one folder.
function mcpConfig(sessionId?: string): string {
  const env: Record<string, string> = { BLUM_ROOT: root() };
  if (sessionId) env.BLUM_SESSION = sessionId;
  if (process.env.BLUM_DESIGNS) env.BLUM_DESIGNS = process.env.BLUM_DESIGNS;
  return JSON.stringify({ mcpServers: { "blum-studio": { command: "node", args: [mcpScript()], env } } });
}

// The prompt is one argv element, verbatim: no shell, no interpolation.
export function claudeLaunch(prompt: string, resumeId?: string, sessionId?: string): LaunchSpec {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    mcpConfig(sessionId),
    "--strict-mcp-config",
    "--allowedTools",
    BLUM_TOOL_PREFIX,
    // Read-only, and only inside the working dir: the uploads folder.
    READ_UPLOADS,
  ];
  if (resumeId) args.push("--resume", resumeId);
  return { program: "claude", args, env: { BLUM_ROOT: root() } };
}

/* ---- stream-json events ---- */

export interface ConsoleEvent {
  time: number;
  kind: "text" | "tool" | "done" | "error";
  text?: string;
  tool?: string;
  agentSessionId?: string;
}

function eventOf(parsed: Record<string, unknown>, now: number): ConsoleEvent | null {
  const agentSessionId = typeof parsed.session_id === "string" ? parsed.session_id : undefined;
  const type = parsed.type;
  if (type === "assistant") {
    const content = (parsed.message as { content?: unknown[] } | undefined)?.content;
    if (!Array.isArray(content)) return null;
    const texts: string[] = [];
    let tool: string | undefined;
    for (const part of content) {
      if (typeof part !== "object" || !part) continue;
      const kind = (part as { type?: string }).type;
      if (kind === "text" && typeof (part as { text?: string }).text === "string") {
        texts.push((part as { text: string }).text);
      } else if (kind === "tool_use" && typeof (part as { name?: string }).name === "string") {
        tool = (part as { name: string }).name;
      }
    }
    if (tool) return { time: now, kind: "tool", tool, agentSessionId };
    if (texts.length) return { time: now, kind: "text", text: texts.join("\n"), agentSessionId };
    return null;
  }
  if (type === "result") {
    const text = typeof parsed.result === "string" ? parsed.result : "Done.";
    const error = parsed.is_error === true || parsed.subtype === "error";
    return { time: now, kind: error ? "error" : "done", text, agentSessionId };
  }
  return null;
}

// One stdout line to zero or one transcript event. Non-JSON lines are kept
// as plain text so nothing the agent says is silently dropped.
export function parseStreamLine(line: string, now = Date.now()): ConsoleEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { time: now, kind: "text", text: trimmed };
  }
  if (typeof parsed !== "object" || !parsed) return null;
  return eventOf(parsed as Record<string, unknown>, now);
}

export function agentSessionOf(line: string): string | null {
  try {
    const parsed = JSON.parse(line) as { session_id?: unknown };
    return typeof parsed?.session_id === "string" ? parsed.session_id : null;
  } catch {
    return null;
  }
}
