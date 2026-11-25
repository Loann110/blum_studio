// Console argv: exact Claude Code launch, resume, stream-json parsing and the
// real spawn line splitter. No agent ever runs here: argv goes to a fake,
// and the splitter is probed with node printing partial lines.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentSessionOf, BLUM_TOOL_PREFIX, claudeLaunch, parseStreamLine, READ_UPLOADS } from "../agents/console.js";
import { setSpawner, spawnAgent } from "../agents/spawn.js";
import { root } from "../paths.js";

const DANGEROUS = `draw & | > "quote" ^caret^ %PATH% $HOME \`back\``;

test("claude launch is one argv array with the prompt verbatim", () => {
  const spec = claudeLaunch(DANGEROUS);
  assert.equal(spec.program, "claude");
  const at = spec.args.indexOf("-p");
  assert.notEqual(at, -1);
  assert.equal(spec.args[at + 1], DANGEROUS);
  assert.deepEqual(spec.args.slice(at + 2, at + 6), ["--output-format", "stream-json", "--verbose", "--mcp-config"]);
  const config = JSON.parse(spec.args[at + 6] as string) as {
    mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
  };
  const entry = config.mcpServers["blum-studio"];
  assert.equal(entry.command, "node");
  assert.deepEqual(entry.args, [path.join(root(), "server", "dist", "mcp.js")]);
  assert.equal(entry.env.BLUM_ROOT, root());
  assert.deepEqual(spec.args.slice(at + 7), ["--strict-mcp-config", "--allowedTools", BLUM_TOOL_PREFIX, READ_UPLOADS]);
  assert.equal(BLUM_TOOL_PREFIX, "mcp__blum-studio__*");
  assert.equal(spec.env.BLUM_ROOT, root());
  assert.ok(!spec.args.includes("--resume"));
});

test("resume appends the agent session id", () => {
  const spec = claudeLaunch("continue", "agent-9");
  assert.deepEqual(spec.args.slice(-2), ["--resume", "agent-9"]);
  assert.equal(spec.args[spec.args.indexOf("-p") + 1], "continue");
});

test("stream-json lines become transcript events", () => {
  const text = parseStreamLine(`{"type":"assistant","session_id":"s1","message":{"content":[{"type":"text","text":"Hi"}]}}`);
  assert.equal(text?.kind, "text");
  assert.equal(text?.text, "Hi");
  assert.equal(text?.agentSessionId, "s1");
  const tool = parseStreamLine(`{"type":"assistant","message":{"content":[{"type":"tool_use","name":"apply_ops"}]}}`);
  assert.equal(tool?.kind, "tool");
  assert.equal(tool?.tool, "apply_ops");
  const done = parseStreamLine(`{"type":"result","subtype":"success","session_id":"s1","result":"Done"}`);
  assert.equal(done?.kind, "done");
  const failed = parseStreamLine(`{"type":"result","subtype":"error","is_error":true,"result":"nope"}`);
  assert.equal(failed?.kind, "error");
  assert.equal(parseStreamLine(""), null);
  assert.equal(parseStreamLine("   "), null);
  const plain = parseStreamLine("not json at all");
  assert.equal(plain?.kind, "text");
  assert.equal(plain?.text, "not json at all");
  assert.equal(agentSessionOf(`{"type":"system","session_id":"abc"}`), "abc");
  assert.equal(agentSessionOf("nope"), null);
});

test("a dangerous prompt through cmd.exe stays one argument and runs nothing", async () => {
  if (process.platform !== "win32") return; // .cmd shims are Windows-only
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-cmd-"));
  const shim = path.join(dir, "agent.cmd");
  // Like the real npm shims: forward untouched with %*, never %~1 unquoted.
  fs.writeFileSync(shim, "@echo off\r\necho ARGS=%*\r\n", "utf-8");
  const sentinel = path.join(dir, "pwned.txt");
  const prompt = `draw & | > "${sentinel}" ^caret^ 100% sure`;
  setSpawner(null);
  const seen: string[] = [];
  const run = spawnAgent(shim, ["-p", prompt], {
    cwd: dir,
    env: {},
    timeoutMs: 10_000,
    onLine: (line) => seen.push(line),
  });
  const result = await run.done;
  assert.equal(result.status, 0);
  // The whole prompt travelled as data: metacharacters printed, not run.
  assert.ok(seen.some((line) => line.includes("draw & | >") && line.includes(sentinel) && line.includes("^caret^")));
  assert.equal(fs.existsSync(sentinel), false); // the `>` redirected nothing
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the real spawn splits stdout on newlines, even mid-chunk", async () => {
  setSpawner(null);
  const seen: string[] = [];
  const run = spawnAgent(process.execPath, ["-e", "process.stdout.write('one\\npartial');process.stdout.write('-end\\n')"], {
    cwd: process.cwd(),
    env: {},
    timeoutMs: 10_000,
    onLine: (line) => seen.push(line),
  });
  const result = await run.done;
  assert.equal(result.status, 0);
  assert.deepEqual(seen, ["one", "partial-end"]);
});

test("the real spawn times out and kills a hung process", async () => {
  setSpawner(null);
  const run = spawnAgent(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    cwd: process.cwd(),
    env: {},
    timeoutMs: 200,
    onLine: () => undefined,
  });
  const result = await run.done;
  assert.equal(result.timedOut, true);
  assert.equal(result.killed, true);
});

test("the real spawn stops on demand", async () => {
  setSpawner(null);
  const started = Date.now();
  const run = spawnAgent(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    cwd: process.cwd(),
    env: {},
    timeoutMs: 30_000,
    onLine: () => undefined,
  });
  await new Promise((r) => setTimeout(r, 200));
  run.stop();
  const result = await run.done;
  assert.equal(result.killed, true);
  assert.ok(Date.now() - started < 10_000);
});

test("a design made by the MCP process lands in the Create session", async () => {
  const { useTempDesigns } = await import("./helpers.js");
  const { newSession, readSession, saveSession } = await import("../sessions.js");
  const dir = useTempDesigns("console-attrib");
  const session = newSession("Attribution", "claude-code", "story");
  saveSession(session);
  // The MCP config Claude receives carries the session id and the designs folder.
  const spec = claudeLaunch("draw", undefined, session.id);
  const config = JSON.parse(spec.args[spec.args.indexOf("--mcp-config") + 1] as string) as {
    mcpServers: Record<string, { env: Record<string, string> }>;
  };
  const env = config.mcpServers["blum-studio"].env;
  assert.equal(env.BLUM_SESSION, session.id);
  assert.equal(env.BLUM_DESIGNS, dir);
  // A separate process, like the MCP server Claude starts, creates a design.
  const tool = path.join(root(), "server", "dist", "js", "server", "mcp", "tools", "designs.js");
  // The vendored Node types (server/node.d.ts) only describe the spawnSync options the server uses.
  const spawnSync = (await import("node:child_process")).spawnSync as unknown as (
    file: string, args: string[], opts: { env: Record<string, string | undefined>; encoding: string },
  ) => { stdout: string };
  const run = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const m = await import(${JSON.stringify("file:///" + tool.split(path.sep).join("/"))}); console.log(m.createDesignTool("Made by agent", "story"));`],
    { env: { ...process.env, ...env }, encoding: "utf-8" });
  const made = JSON.parse(run.stdout.trim().split("\n").pop() as string) as { id: string };
  assert.ok(fs.existsSync(path.join(dir, `${made.id}.json`)));
  assert.deepEqual(readSession(session.id).designIds, [made.id]);
});
