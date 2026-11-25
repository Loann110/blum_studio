// Console process spawn: run one agent CLI with an argv array, never a shell
// string, and stream its stdout line by line. The prompt always travels as a
// single argv element, so `& | > " ^` cannot break out into new commands.
// Residual cmd.exe quirk (shims only): %NAME% still expands to env text,
// data only, no execution; Claude Code resolves to claude.exe, no cmd.
// Tests swap in a fake spawner; Playwright sets BLUM_CONSOLE_FAKE=1 for a
// scripted run with no real agent.
import { spawn } from "node:child_process";
import { resolveProgram } from "./run.js";

export interface SpawnOpts {
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  onLine(line: string): void;
  onStderr?(text: string): void;
}

export interface SpawnResult {
  status: number | null; // null when killed or missing
  missing: boolean;
  timedOut: boolean;
  killed: boolean;
}

export interface ActiveSpawn {
  done: Promise<SpawnResult>;
  stop: () => void; // kills the whole tree; done resolves killed
}

export type Spawner = (program: string, args: string[], opts: SpawnOpts) => ActiveSpawn;

function fakeLines(): string[] {
  return [
    `{"type":"system","subtype":"init","session_id":"fake-agent-session"}`,
    `{"type":"assistant","session_id":"fake-agent-session","message":{"content":[{"type":"text","text":"I'll create the design now."}]}}`,
    `{"type":"assistant","session_id":"fake-agent-session","message":{"content":[{"type":"tool_use","name":"create_design","input":{"name":"Console test"}}]}}`,
    `{"type":"assistant","session_id":"fake-agent-session","message":{"content":[{"type":"text","text":"The story is ready."}]}}`,
    `{"type":"result","subtype":"success","session_id":"fake-agent-session","result":"Done"}`,
  ];
}

// Scripted run for the sim page: no process, just the event shape above.
function fakeSpawn(opts: SpawnOpts): ActiveSpawn {
  let stopped = false;
  const done = new Promise<SpawnResult>((resolve) => {
    const lines = fakeLines();
    let i = 0;
    const timer = setInterval(() => {
      if (stopped) {
        clearInterval(timer);
        resolve({ status: null, missing: false, timedOut: false, killed: true });
        return;
      }
      if (i >= lines.length) {
        clearInterval(timer);
        resolve({ status: 0, missing: false, timedOut: false, killed: false });
        return;
      }
      opts.onLine(lines[i] as string);
      i += 1;
    }, 60);
  });
  return { done, stop: () => { stopped = true; } };
}

// Kill the whole tree: children outlive a plain kill (the CLI spawns the MCP).
function killTree(pid: number): void {
  try {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("error", () => undefined);
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

function realSpawn(program: string, args: string[], opts: SpawnOpts): ActiveSpawn {
  const found = resolveProgram(program);
  if (!found) {
    return {
      done: Promise.resolve({ status: null, missing: true, timedOut: false, killed: false }),
      stop: () => undefined,
    };
  }
  const file = found.viaCmd ? (process.env.ComSpec ?? "cmd.exe") : found.file;
  const argv = found.viaCmd ? ["/c", found.file, ...args] : args;
  let stopped = false;
  let childPid = 0;
  const stop = (): void => {
    stopped = true;
    if (childPid) killTree(childPid);
  };
  const done = new Promise<SpawnResult>((resolve) => {
    let done = false;
    let timedOut = false;
    const finish = (result: SpawnResult): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };
    const child = spawn(file, argv, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid as number);
      finish({ status: null, missing: false, timedOut: true, killed: true });
    }, opts.timeoutMs);
    let out = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf-8");
      const parts = out.split("\n");
      out = parts.pop() ?? "";
      for (const line of parts) opts.onLine(line.replace(/\r$/, ""));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (opts.onStderr) opts.onStderr(chunk.toString("utf-8"));
    });
    childPid = child.pid ?? 0;
    child.on("error", () => finish({ status: null, missing: true, timedOut: false, killed: false }));
    child.on("close", (code) => {
      if (out.length) opts.onLine(out.replace(/\r$/, ""));
      finish({ status: code, missing: false, timedOut, killed: timedOut || stopped });
    });
  });
  return { done, stop };
}

let active: Spawner = realSpawn;

// Tests swap in a fake; pass null to restore the real spawner.
export function setSpawner(next: Spawner | null): void {
  active = next ?? realSpawn;
}

export function isFakeConsole(): boolean {
  return process.env.BLUM_CONSOLE_FAKE === "1";
}

export function spawnAgent(program: string, args: string[], opts: SpawnOpts): ActiveSpawn {
  if (isFakeConsole()) return fakeSpawn(opts);
  return active(program, args, opts);
}
