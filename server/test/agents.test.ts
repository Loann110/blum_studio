// Agent routes: list, connect/disconnect with a fake runner, unknown ids,
// the two CSRF refusals, and Claude Desktop on a temp dir only.
// Never touches the user's real agent configs: every command goes through
// the fake, and desktop files live under os.tmpdir().
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand, setRunner, type CommandResult, type Runner } from "../agents/run.js";
import { configConnect, configConnected, configDisconnect } from "../agents/config-file.js";
import { root } from "../paths.js";
import { liveServer, useTempDesigns } from "./helpers.js";

useTempDesigns("agents");

after(() => setRunner(null));

function ok(stdout = ""): CommandResult {
  return { status: 0, stdout, stderr: "", missing: false, timeout: false };
}

function failed(text: string): CommandResult {
  return { status: 1, stdout: "", stderr: text, missing: false, timeout: false };
}

function absent(): CommandResult {
  return { status: 127, stdout: "", stderr: "", missing: true, timeout: false };
}

function scripted(map: Record<string, CommandResult>, calls: Array<{ program: string; args: string[] }>): Runner {
  return async (program: string, args: string[]) => {
    calls.push({ program, args });
    return map[`${program} ${args.join(" ")}`] ?? absent();
  };
}

// Every POST in these tests carries the headers the real Settings page sends.
function agentHeaders(base: string): Record<string, string> {
  return { "X-Blum-Request": "1", origin: new URL(base).origin };
}

test("list reports every known agent with its install state", async () => {
  const calls: Array<{ program: string; args: string[] }> = [];
  setRunner(
    scripted(
      {
        "claude --version": ok("2.1.329 (Claude Code)\n"),
        "claude mcp get blum-studio": failed("No MCP server named."),
        "codex --version": ok("codex-cli 0.166.0\n"),
        "codex mcp get blum-studio": failed("No MCP server named."),
      },
      calls,
    ),
  );
  const client = await liveServer();
  try {
    const res = await client.get("/api/agents");
    assert.equal(res.status, 200);
    const agents = res.json() as Array<Record<string, unknown>>;
    assert.deepEqual(
      agents.map((a) => a.id),
      ["claude-code", "codex", "muse", "claude-desktop", "cursor"],
    );
    const claude = agents[0];
    assert.equal(claude.name, "Claude Code");
    assert.equal(claude.installed, true);
    assert.equal(claude.connected, false);
    assert.match(String(claude.version), /Claude Code/);
    assert.equal(claude.installUrl, "https://claude.com/claude-code");
    const codex = agents[1];
    assert.equal(codex.installed, true);
    assert.equal(codex.connected, false);
    const muse = agents[2];
    assert.equal(muse.installed, false);
    assert.equal(muse.connected, false);
    assert.equal(muse.installUrl, undefined);
    const desktop = agents[3];
    assert.equal(typeof desktop.installed, "boolean");
    assert.equal(typeof desktop.connected, "boolean");
  } finally {
    await client.close();
  }
});

test("connect runs remove then add with array args", async () => {
  const calls: Array<{ program: string; args: string[] }> = [];
  const blumRoot = root();
  const addArgs = ["mcp", "add", "blum-studio", "-s", "user", "-e", `BLUM_ROOT=${blumRoot}`, "--", "node", path.join(blumRoot, "server", "dist", "mcp.js")];
  const map: Record<string, CommandResult> = {
    "claude --version": ok("x"),
    "claude mcp get blum-studio": failed("no"),
    "claude mcp remove blum-studio -s user": ok("removed"),
  };
  map[["claude", ...addArgs].join(" ")] = ok("added");
  setRunner(scripted(map, calls));
  const client = await liveServer();
  try {
    const res = await client.raw("/api/agents/claude-code/connect", {
      method: "POST",
      headers: { ...agentHeaders(client.base), "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), { ok: true });
    const blumRoot = root();
    const script = path.join(blumRoot, "server", "dist", "mcp.js");
    assert.deepEqual(calls, [
      { program: "claude", args: ["mcp", "remove", "blum-studio", "-s", "user"] },
      {
        program: "claude",
        args: ["mcp", "add", "blum-studio", "-s", "user", "-e", `BLUM_ROOT=${blumRoot}`, "--", "node", script],
      },
    ]);
  } finally {
    await client.close();
  }
});

test("disconnect runs remove, connect failure is a 500 with the agent output", async () => {
  const calls: Array<{ program: string; args: string[] }> = [];
  const blumRoot = root();
  const codexAdd = ["mcp", "add", "blum-studio", "--env", `BLUM_ROOT=${blumRoot}`, "--", "node", path.join(blumRoot, "server", "dist", "mcp.js")];
  const map: Record<string, CommandResult> = {
    "claude mcp remove blum-studio -s user": ok("removed"),
    "codex mcp remove blum-studio": ok("removed"),
  };
  map[["codex", ...codexAdd].join(" ")] = failed("add broke");
  setRunner(scripted(map, calls));
  const client = await liveServer();
  try {
    const headers = { ...agentHeaders(client.base), "content-type": "application/json" };
    const down = await client.raw("/api/agents/codex/disconnect", { method: "POST", headers, body: "{}" });
    assert.equal(down.status, 200);
    assert.deepEqual(calls, [{ program: "codex", args: ["mcp", "remove", "blum-studio"] }]);
    const up = await client.raw("/api/agents/codex/connect", { method: "POST", headers, body: "{}" });
    assert.equal(up.status, 500);
    assert.match(String((up.json() as { detail: string }).detail), /add broke/);
  } finally {
    await client.close();
  }
});

test("unknown agent id is a 404", async () => {
  setRunner(scripted({}, []));
  const client = await liveServer();
  try {
    const headers = { ...agentHeaders(client.base), "content-type": "application/json" };
    assert.equal((await client.raw("/api/agents/nope/connect", { method: "POST", headers, body: "{}" })).status, 404);
    assert.equal((await client.raw("/api/agents/nope/disconnect", { method: "POST", headers, body: "{}" })).status, 404);
  } finally {
    await client.close();
  }
});

test("POST without the Settings header is a 403", async () => {
  setRunner(scripted({ "claude mcp get blum-studio": ok("yes") }, []));
  const client = await liveServer();
  try {
    const res = await client.raw("/api/agents/claude-code/connect", {
      method: "POST",
      headers: { origin: new URL(client.base).origin, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 403);
  } finally {
    await client.close();
  }
});

test("POST with a foreign Origin is a 403", async () => {
  const calls: Array<{ program: string; args: string[] }> = [];
  setRunner(scripted({ "claude mcp get blum-studio": ok("yes") }, calls));
  const client = await liveServer();
  try {
    const res = await client.raw("/api/agents/claude-code/connect", {
      method: "POST",
      headers: { "X-Blum-Request": "1", origin: "http://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 403);
    assert.deepEqual(calls, []);
  } finally {
    await client.close();
  }
});

test("the real runner finds programs on PATH and runs argv arrays", async () => {
  setRunner(null);
  const run = await runCommand("node", ["--version"]);
  assert.equal(run.missing, false);
  assert.equal(run.timeout, false);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /v\d+\./);
});

test("a silent agent shows its timeout instead of hanging the list", async () => {
  setRunner(async () => ({ status: 1, stdout: "", stderr: "", missing: false, timeout: true }));
  const client = await liveServer();
  try {
    const agents = (await (await client.get("/api/agents")).json()) as Array<Record<string, unknown>>;
    const claude = agents[0];
    assert.equal(claude.installed, false);
    assert.match(String(claude.error), /did not answer within 15 s/);
  } finally {
    await client.close();
  }
});

/* ---- JSON MCP config files (Claude Desktop, Cursor) on a temp dir ---- */

function tempConfig(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "blum-config-")), "mcp.json");
}

test("config connect merges, backs up, and disconnect removes", () => {
  const file = tempConfig();
  const before = { mcpServers: { other: { command: "node", args: ["x.js"], env: {} } } };
  fs.writeFileSync(file, JSON.stringify(before, null, 2));
  configConnect(file, "Cursor");
  const merged = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
  };
  assert.deepEqual(merged.mcpServers.other, before.mcpServers.other);
  assert.equal(merged.mcpServers["blum-studio"].command, "node");
  assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.bak`, "utf-8")), before);
  assert.equal(configConnected(file), true);
  configDisconnect(file, "Cursor");
  const after = JSON.parse(fs.readFileSync(file, "utf-8")) as { mcpServers: Record<string, unknown> };
  assert.deepEqual(after.mcpServers, before.mcpServers);
  assert.equal(configConnected(file), false);
});

test("config connect creates the file when missing, disconnect is a no-op", () => {
  const file = tempConfig();
  configConnect(file, "Cursor");
  assert.equal(configConnected(file), true);
  assert.equal(fs.existsSync(`${file}.bak`), false);
  fs.unlinkSync(file);
  configDisconnect(file, "Cursor");
  assert.equal(fs.existsSync(file), false);
});

test("config never overwrites invalid JSON", () => {
  const file = tempConfig();
  fs.writeFileSync(file, "{ not json");
  assert.throws(() => configConnect(file, "Cursor"), /not valid JSON/);
  assert.throws(() => configDisconnect(file, "Cursor"), /not valid JSON/);
  assert.equal(fs.readFileSync(file, "utf-8"), "{ not json");
  assert.equal(fs.existsSync(`${file}.bak`), false);
});
