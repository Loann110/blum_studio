// npm run connect: register Blum Studio in every installed AI agent.
// Same module as the Settings page. --dry-run shows what would change.
// Re-running is safe: an existing entry is removed first, then re-added.
import fs from "node:fs";
import path from "node:path";
import { ADAPTERS } from "./adapters.js";
import { SERVER_NAME } from "./config-file.js";
import { root } from "../paths.js";
import type { PlanStep } from "./run.js";

// Double quotes work for cmd.exe, PowerShell and sh alike (paths carry no quotes).
function quote(part: string): string {
  return /[\s"]/.test(part) ? `"${part}"` : part;
}

function describeStep(step: PlanStep): string {
  if (step.kind === "config") {
    return step.action === "merge" ? `add "${SERVER_NAME}" to ${step.file}` : `remove "${SERVER_NAME}" from ${step.file}`;
  }
  return [step.program, ...step.args].map(quote).join(" ");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const mcp = path.join(root(), "server", "dist", "mcp.js");
  if (!fs.existsSync(mcp)) {
    console.error("[connect] server/dist/mcp.js is missing: run `npm run setup` first.");
    process.exit(1);
  }
  let done = 0;
  for (const agent of ADAPTERS) {
    const found = await agent.detect();
    if (!found.installed) {
      console.log(`[connect] ${agent.name}: ${agent.skipNote}`);
      continue;
    }
    if (dryRun) {
      for (const step of await agent.connectSteps()) {
        if (step.kind === "run" && step.ignoreError) continue;
        console.log(`[connect] ${agent.name}: would run  ${describeStep(step)}`);
      }
    } else {
      try {
        await agent.connect();
      } catch (error) {
        console.error(`[connect] ${agent.name}: connection failed.\n${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      console.log(`[connect] ${agent.name}: "${SERVER_NAME}" ${agent.connectNote}`);
    }
    done++;
  }
  if (!done) {
    console.log(`[connect] No agent found. Any MCP client works: command "node", argument "${mcp}", env BLUM_ROOT="${root()}".`);
  }
}

void main();
