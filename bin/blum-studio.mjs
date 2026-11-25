#!/usr/bin/env node
// Published entry point: `blum-studio` starts the studio, `blum-studio mcp`
// runs the MCP server over stdio for agent configurations.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.BLUM_ROOT ??= pkgRoot;

const mcp = process.argv[2] === "mcp";
const target = mcp ? path.join(pkgRoot, "server", "dist", "mcp.js") : path.join(pkgRoot, "scripts", "start.mjs");
const child = spawn(process.execPath, [target, ...process.argv.slice(mcp ? 3 : 2)], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
