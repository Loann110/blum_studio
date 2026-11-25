// AI agent catalogue: one data entry per agent, argv arrays only.
// Adding an agent (Gemini CLI…) is one entry here, nothing else.
// <root> always comes from paths.root(), never from a request.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { root } from "../paths.js";
import { commandText, runCommand, type CommandResult, type PlanStep } from "./run.js";
import { appInstalled, configConnect, configConnected, configDisconnect, cursorFile, desktopFile, SERVER_NAME } from "./config-file.js";

export interface AgentState {
  installed: boolean;
  version?: string;
  error?: string;
}

export interface AgentAdapter {
  id: string;
  name: string;
  icon: string; // key rendered by the Settings page (terminal or monitor)
  installUrl?: string;
  skipNote: string; // CLI line when the agent is absent
  connectNote: string; // CLI line after a successful connect
  detect(): Promise<AgentState>;
  status(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  connectSteps(): Promise<PlanStep[]>;
  disconnectSteps(): Promise<PlanStep[]>;
}

/* ---- shared bits ---- */

function blumRoot(): string {
  return root();
}

function mcpScript(): string {
  const script = path.join(blumRoot(), "server", "dist", "mcp.js");
  if (!fs.existsSync(script)) throw new Error("server/dist/mcp.js is missing: run `npm run setup` first.");
  return script;
}

function blumEnv(): string {
  return `BLUM_ROOT=${blumRoot()}`;
}

// stdout plus stderr, for error messages.
function outputOf(result: CommandResult): string {
  return commandText(result);
}

function timeoutError(name: string): Error {
  return new Error(`${name} did not answer within 15 s.`);
}

async function probe(name: string, program: string, args: string[]): Promise<AgentState> {
  const run = await runCommand(program, args);
  if (run.timeout) return { installed: false, error: `${name} did not answer within 15 s.` };
  if (run.missing || run.status !== 0) return { installed: false };
  const version = run.stdout.split("\n")[0]?.trim();
  return { installed: true, version: version || undefined };
}

async function statusOf(name: string, program: string, args: string[]): Promise<boolean> {
  const run = await runCommand(program, args);
  if (run.timeout) throw timeoutError(name);
  return run.status === 0;
}

// Remove-then-add: re-running a connect replaces the entry instead of failing.
async function runSteps(name: string, steps: PlanStep[]): Promise<void> {
  for (const step of steps) {
    if (step.kind === "config") {
      if (step.action === "merge") configConnect(step.file, step.app);
      else configDisconnect(step.file, step.app);
      continue;
    }
    const run = await runCommand(step.program, step.args);
    if (run.timeout) throw timeoutError(name);
    if (run.status !== 0 && !step.ignoreError) throw new Error(outputOf(run) || `${name}: command failed.`);
  }
}

function tolerantRemove(program: string, args: string[]): PlanStep {
  return { kind: "run", program, args, ignoreError: true };
}

/* ---- Muse: PATH first, then the default install spot (Windows) ---- */

async function resolveMuse(): Promise<{ program: string; version?: string } | null> {
  const onPath = await runCommand("muse", ["--version"]);
  if (onPath.timeout) throw timeoutError("Muse");
  if (!onPath.missing && onPath.status === 0) {
    const version = onPath.stdout.split("\n")[0]?.trim();
    return { program: "muse", version: version || undefined };
  }
  // No documented macOS/Linux install spot (muse --help says nothing): PATH only there.
  if (os.platform() !== "win32") return null;
  const local = process.env.LOCALAPPDATA;
  if (!local) return null;
  const fallback = path.join(local, "Programs", "muse", "muse.cmd");
  const probeFallback = await runCommand(fallback, ["--version"]);
  if (probeFallback.timeout) throw timeoutError("Muse");
  if (probeFallback.missing || probeFallback.status !== 0) return null;
  const version = probeFallback.stdout.split("\n")[0]?.trim();
  return { program: fallback, version: version || undefined };
}

/* ---- the catalogue ---- */

const claudeCode: AgentAdapter = {
  id: "claude-code",
  name: "Claude Code",
  icon: "terminal",
  installUrl: "https://claude.com/claude-code",
  skipNote: "`claude` CLI not found, skipped.",
  connectNote: "registered. Restart Claude Code to use it.",
  detect: () => probe("Claude Code", "claude", ["--version"]),
  status: () => statusOf("Claude Code", "claude", ["mcp", "get", SERVER_NAME]),
  connectSteps: async () => {
    const script = mcpScript();
    return [
      tolerantRemove("claude", ["mcp", "remove", SERVER_NAME, "-s", "user"]),
      { kind: "run", program: "claude", args: ["mcp", "add", SERVER_NAME, "-s", "user", "-e", blumEnv(), "--", "node", script] },
    ];
  },
  disconnectSteps: async () => [{ kind: "run", program: "claude", args: ["mcp", "remove", SERVER_NAME, "-s", "user"] }],
  async connect(): Promise<void> {
    return runSteps("Claude Code", await this.connectSteps());
  },
  async disconnect(): Promise<void> {
    return runSteps("Claude Code", await this.disconnectSteps());
  },
};

const codex: AgentAdapter = {
  id: "codex",
  name: "Codex",
  icon: "terminal",
  installUrl: "https://github.com/openai/codex",
  skipNote: "`codex` CLI not found, skipped.",
  connectNote: "registered. Restart Codex to use it.",
  detect: () => probe("Codex", "codex", ["--version"]),
  status: () => statusOf("Codex", "codex", ["mcp", "get", SERVER_NAME]),
  connectSteps: async () => {
    const script = mcpScript();
    return [
      tolerantRemove("codex", ["mcp", "remove", SERVER_NAME]),
      { kind: "run", program: "codex", args: ["mcp", "add", SERVER_NAME, "--env", blumEnv(), "--", "node", script] },
    ];
  },
  disconnectSteps: async () => [{ kind: "run", program: "codex", args: ["mcp", "remove", SERVER_NAME] }],
  async connect(): Promise<void> {
    return runSteps("Codex", await this.connectSteps());
  },
  async disconnect(): Promise<void> {
    return runSteps("Codex", await this.disconnectSteps());
  },
};

const muse: AgentAdapter = {
  id: "muse",
  name: "Muse",
  icon: "terminal",
  // No install link: only "Not installed" (no invented URL).
  skipNote: "`muse` CLI not found, skipped.",
  connectNote: "registered. Restart Muse to use it.",
  detect: async () => {
    try {
      const found = await resolveMuse();
      return found ? { installed: true, version: found.version } : { installed: false };
    } catch (error) {
      return { installed: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  status: async () => {
    const found = await resolveMuse();
    if (!found) return false;
    return statusOf("Muse", found.program, ["mcp", "get", SERVER_NAME, "--json"]);
  },
  connectSteps: async () => {
    const found = await resolveMuse();
    if (!found) throw new Error("Muse is not installed.");
    const script = mcpScript();
    return [
      tolerantRemove(found.program, ["mcp", "remove", SERVER_NAME, "--user"]),
      { kind: "run", program: found.program, args: ["mcp", "add", SERVER_NAME, "-e", blumEnv(), "--user", "--", "node", script] },
    ];
  },
  disconnectSteps: async () => {
    const found = await resolveMuse();
    if (!found) throw new Error("Muse is not installed.");
    return [{ kind: "run", program: found.program, args: ["mcp", "remove", SERVER_NAME, "--user"] }];
  },
  async connect(): Promise<void> {
    await runSteps("Muse", await muse.connectSteps());
  },
  async disconnect(): Promise<void> {
    await runSteps("Muse", await muse.disconnectSteps());
  },
};

/* ---- apps configured by a JSON file (Claude Desktop, Cursor) ---- */

function configApp(id: string, name: string, file: () => string, installUrl?: string): AgentAdapter {
  return {
    id,
    name,
    icon: "monitor",
    installUrl,
    skipNote: "not installed, skipped.",
    connectNote: `added (backup: ${path.basename(file())}.bak). Restart ${name}.`,
    detect: async () => ({ installed: appInstalled(file()) }),
    status: async () => configConnected(file()),
    connectSteps: async () => {
      mcpScript();
      return [{ kind: "config", app: name, file: file(), action: "merge" }];
    },
    disconnectSteps: async () => [{ kind: "config", app: name, file: file(), action: "remove" }],
    async connect(): Promise<void> {
      return runSteps(name, await this.connectSteps());
    },
    async disconnect(): Promise<void> {
      return runSteps(name, await this.disconnectSteps());
    },
  };
}

const claudeDesktop = configApp("claude-desktop", "Claude Desktop", desktopFile);
const cursor = configApp("cursor", "Cursor", cursorFile, "https://cursor.com");

export const ADAPTERS: AgentAdapter[] = [claudeCode, codex, muse, claudeDesktop, cursor];
