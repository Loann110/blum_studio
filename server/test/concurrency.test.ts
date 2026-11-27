// Concurrency: independent writers (two MCP processes, HTTP + MCP) keep every item.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createDesign, getDesign, listDesigns } from "../store.js";
import { applyOpsTool, undoTool } from "../mcp/tools/ops.js";
import { liveServer, useTempDesigns, type Res } from "./helpers.js";

interface McpClient {
  call(name: string, args: Record<string, unknown>): Promise<string>;
  stop(): void;
}

// One MCP server over stdio, driven with raw JSON-RPC like scripts/mcp_check.mjs.
async function launchMcp(dir: string): Promise<McpClient> {
  const mcpJs = path.join(process.cwd(), "server", "dist", "mcp.js");
  assert.ok(fs.existsSync(mcpJs), `missing ${mcpJs} (build the server first)`);
  const child = spawn(process.execPath, [mcpJs], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, BLUM_DESIGNS: dir },
  });
  let nextId = 1;
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  let buf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString();
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as Record<string, unknown>;
      if (typeof msg.id !== "number") continue; // server notifications carry no id
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg);
      }
    }
  });
  // A dead child must fail the test, not hang it on never-answered calls.
  const failAll = (reason: string): void => {
    for (const resolve of pending.values()) resolve({ error: { message: reason } });
    pending.clear();
  };
  child.on("error", (e: Error) => failAll(e.message));
  child.on("close", () => failAll("mcp process exited"));
  const send = (method: string, params: unknown): Promise<Record<string, unknown>> => {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  };
  const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const res = await send("tools/call", { name, arguments: args });
    if (res.error) throw new Error(`${name}: ${JSON.stringify(res.error)}`);
    const content = ((res.result ?? {}) as { content?: Array<{ text?: string }> }).content ?? [];
    return content.map((c) => c.text ?? "").join("");
  };
  const hello = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "concurrency-test", version: "0.0.1" },
  });
  if (hello.error) throw new Error(`initialize: ${JSON.stringify(hello.error)}`);
  child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  return { call, stop: () => {
    child.stdin?.end();
    child.kill();
  } };
}

function shape(id: string, n: number): Record<string, unknown> {
  return {
    id,
    name: id,
    type: "shape",
    x: 100 + n,
    y: 100,
    width: 50,
    height: 50,
    props: { shape: "rect", fill: "#111111" },
  };
}

function mustOk(reply: string): void {
  assert.notEqual((JSON.parse(reply) as { ok?: boolean }).ok, false, reply.slice(0, 300));
}

function assertNoLocks(dir: string): void {
  assert.ok(!fs.readdirSync(dir).some((f) => f.endsWith(".lock")), "lock files left behind");
  assert.ok(listDesigns().every((r) => !r.id.endsWith(".lock")));
}

test("two MCP processes adding items concurrently lose nothing", async () => {
  const dir = useTempDesigns("concurrency-mcp");
  const { id } = createDesign("Racy", "story");
  const first = await launchMcp(dir);
  const second = await launchMcp(dir);
  const total = 25;
  try {
    const pending: Array<Promise<string>> = [];
    for (let n = 0; n < total; n++) {
      pending.push(first.call("apply_ops", { design_id: id, ops: [{ op: "add", item: shape(`a${n}`, n) }] }));
      pending.push(second.call("apply_ops", { design_id: id, ops: [{ op: "add", item: shape(`b${n}`, n) }] }));
    }
    for (const reply of await Promise.all(pending)) mustOk(reply);
  } finally {
    first.stop();
    second.stop();
  }
  const items = (getDesign(id) as { items: Array<{ id: string }> }).items;
  assert.equal(items.length, total * 2);
  assert.equal(new Set(items.map((i) => i.id)).size, total * 2);
  const undone = JSON.parse(await undoTool(id)) as { undone: boolean; design: { items: unknown[] } };
  assert.equal(undone.undone, true);
  assert.equal(undone.design.items.length, total * 2 - 1);
  assertNoLocks(dir);
});

test("HTTP server and an MCP process writing concurrently lose nothing", async () => {
  const dir = useTempDesigns("concurrency-http");
  const c = await liveServer();
  try {
    const made = (await (await c.post("/api/designs", { name: "Racy", format: "story" })).json()) as { id: string };
    const mcp = await launchMcp(dir);
    const total = 25;
    try {
      const http: Array<Promise<Res>> = [];
      const calls: Array<Promise<string>> = [];
      for (let n = 0; n < total; n++) {
        http.push(c.post(`/api/designs/${made.id}/ops`, { ops: [{ op: "add", item: shape(`h${n}`, n) }] }));
        calls.push(mcp.call("apply_ops", { design_id: made.id, ops: [{ op: "add", item: shape(`m${n}`, n) }] }));
      }
      for (const r of await Promise.all(http)) assert.equal(r.status, 200, r.text.slice(0, 300));
      for (const reply of await Promise.all(calls)) mustOk(reply);
    } finally {
      mcp.stop();
    }
    const state = (await (await c.get(`/api/designs/${made.id}/state`)).json()) as {
      design: { items: Array<{ id: string }> };
    };
    assert.equal(state.design.items.length, total * 2);
    assert.equal(new Set(state.design.items.map((i) => i.id)).size, total * 2);
    const undone = (await (await c.post(`/api/designs/${made.id}/undo`)).json()) as {
      undone: boolean;
      design: { items: unknown[] };
    };
    assert.equal(undone.undone, true);
    assert.equal(undone.design.items.length, total * 2 - 1);
    assertNoLocks(dir);
  } finally {
    await c.close();
  }
});

test("a stale lock from a dead pid is recovered", async () => {
  const dir = useTempDesigns("concurrency-stale");
  const { id } = createDesign("Stale", "story");
  const dead = spawn(process.execPath, ["-e", ""]);
  await new Promise<void>((resolve) => {
    dead.on("close", () => resolve());
  });
  const pid = dead.pid;
  assert.ok(typeof pid === "number");
  const lock = path.join(dir, `${id}.lock`);
  fs.writeFileSync(lock, JSON.stringify({ pid, at: Date.now(), nonce: "stale" }), "utf-8");
  assert.ok(listDesigns().some((r) => r.id === id));
  assert.ok(listDesigns().every((r) => !r.id.endsWith(".lock")));
  mustOk(await applyOpsTool(id, [{ op: "add", item: shape("s0", 0) }]));
  assert.equal((getDesign(id) as { items: unknown[] }).items.length, 1);
  assert.ok(!fs.existsSync(lock));
});
