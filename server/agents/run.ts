// Run external AI-agent programs: argv arrays only, never a shell string.
// Every command goes through runCommand, which tests replace with a fake.
// On Windows, CLI shims are .cmd files: bare names are resolved through
// PATH (+ PATHEXT) and .cmd/.bat files run via cmd.exe /c, still as argv.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const COMMAND_TIMEOUT_MS = 15_000;

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
  missing: boolean; // program not found on PATH
  timeout: boolean; // killed after COMMAND_TIMEOUT_MS
}

export type Runner = (program: string, args: string[]) => Promise<CommandResult>;

// One plan step: either run a program, or merge/remove our entry in an app's JSON MCP config.
export type PlanStep =
  | { kind: "run"; program: string; args: string[]; ignoreError?: boolean }
  | { kind: "config"; app: string; file: string; action: "merge" | "remove" };

export function commandText(result: CommandResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

function isWindows(): boolean {
  return os.platform() === "win32";
}

function needsCmd(file: string): boolean {
  const lower = file.toLowerCase();
  return isWindows() && (lower.endsWith(".cmd") || lower.endsWith(".bat"));
}

// Where Windows looks for "codex" when given without an extension.
function windowsExtensions(): string[] {
  return (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// Find the real file for a bare program name. Null means not installed.
function windowsExecutable(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.endsWith(".exe") || lower.endsWith(".com") || lower.endsWith(".cmd") || lower.endsWith(".bat");
}

// Exported for the console spawn: same argv-only resolution, streaming.
export function resolveProgram(program: string): { file: string; viaCmd: boolean } | null {
  if (program.includes("/") || program.includes("\\")) {
    if (!isFile(program)) return null;
    // An extensionless shim (npm "codex") is not runnable as-is on Windows.
    if (isWindows() && !windowsExecutable(program)) return null;
    return { file: program, viaCmd: needsCmd(program) };
  }
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const direct = path.join(dir, program);
    if (isFile(direct) && (!isWindows() || windowsExecutable(direct))) {
      return { file: direct, viaCmd: needsCmd(direct) };
    }
    if (isWindows()) {
      for (const ext of windowsExtensions()) {
        const file = direct + ext;
        if (isFile(file)) return { file, viaCmd: needsCmd(file) };
      }
    }
  }
  return null;
}

function realRunner(program: string, args: string[]): Promise<CommandResult> {
  const found = resolveProgram(program);
  if (!found) return Promise.resolve({ status: 127, stdout: "", stderr: "", missing: true, timeout: false });
  const file = found.viaCmd ? (process.env.ComSpec ?? "cmd.exe") : found.file;
  const argv = found.viaCmd ? ["/c", found.file, ...args] : args;
  return new Promise((resolve) => {
    try {
      execFile(file, argv, { timeout: COMMAND_TIMEOUT_MS, encoding: "utf8" }, (error, stdout, stderr) => {
        if (error && error.code === "ENOENT") {
          resolve({ status: 127, stdout: "", stderr: "", missing: true, timeout: false });
          return;
        }
        const timeout = Boolean(error && error.killed);
        const status = error ? (typeof error.code === "number" ? error.code : 1) : 0;
        resolve({ status, stdout: stdout ?? "", stderr: stderr ?? "", missing: false, timeout });
      });
    } catch (error) {
      resolve({ status: 1, stdout: "", stderr: String(error), missing: false, timeout: false });
    }
  });
}

let active: Runner = realRunner;

// Tests swap in a fake; pass null to restore the real runner.
export function setRunner(next: Runner | null): void {
  active = next ?? realRunner;
}

export function runCommand(program: string, args: string[]): Promise<CommandResult> {
  return active(program, args);
}
