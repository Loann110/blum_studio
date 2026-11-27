// MCP ops: batch apply, silent-shape rejection, stickers, undo/redo.
import test from "node:test";
import assert from "node:assert/strict";
import { createDesignTool, getDesignTool } from "../mcp/tools/designs.js";
import { applyOpsTool, redoTool, undoTool } from "../mcp/tools/ops.js";
import { checkDesignTool } from "../mcp/tools/check.js";
import { getDesign } from "../store.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-ops");

function ok(reply: string): Record<string, unknown> {
  const body = JSON.parse(reply) as { ok?: boolean };
  assert.notEqual(body.ok, false, reply.slice(0, 300));
  return body as Record<string, unknown>;
}

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

function make(name = "Probe"): { id: string } {
  return JSON.parse(createDesignTool(name, "story")) as { id: string };
}

function text(id: string): Record<string, unknown> {
  return { id, name: id, type: "text", x: 540, y: 420, width: 900, height: 200, props: { text: "Hello", font: "Inter", size: 96, weight: 700, color: "#111111" } };
}

test("batch applies and failed batch changes nothing", async () => {
  const made = make("Batched");
  const out = ok(await applyOpsTool(made.id, [
    { op: "add", item: text("a") },
    { op: "add", item: text("b") },
    { op: "update", id: "a", patch: { x: 100 } },
  ]));
  assert.deepEqual(out, { ok: true, ids: ["a", "b"] });
  assert.ok(err(await applyOpsTool(made.id, [])).includes("non-empty list"));
  assert.ok(err(await applyOpsTool(made.id, [{ no: "op" }])).includes("ops[0]"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "ghost", patch: { x: 1 } }])).includes("nothing was applied"));
  const ids = (JSON.parse(await getDesignTool(made.id, false)) as { items: Array<{ id: string }> }).items.map((i) => i.id);
  assert.deepEqual(ids, ["a", "b"]);
});

test("apply survives an editor save", async () => {
  const made = make("Shared");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("mine") }]));
  const disk = getDesign(made.id) as unknown as { items: unknown[] };
  disk.items.push(text("theirs"));
  const { saveDesign } = await import("../store.js");
  saveDesign(made.id, disk as never); // the editor's concurrent save
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("more") }]));
  const ids = new Set(((JSON.parse(await getDesignTool(made.id, false)) as { items: Array<{ id: string }> }).items.map((i) => i.id)));
  assert.deepEqual(ids, new Set(["mine", "theirs", "more"]));
});

test("undo redo round trip", async () => {
  const { createDesign } = await import("../store.js");
  const raw = createDesign("No history", "story");
  assert.equal((JSON.parse(await undoTool(raw.id)) as { undone: boolean }).undone, false);
  assert.equal((JSON.parse(await redoTool(raw.id)) as { redone: boolean }).redone, false);
  const made = make("Undo me");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]));
  const undone = JSON.parse(await undoTool(made.id)) as { undone: boolean; design: { items: unknown[] } };
  assert.equal(undone.undone, true);
  assert.deepEqual(undone.design.items, []);
  const redone = JSON.parse(await redoTool(made.id)) as { redone: boolean; design: { items: Array<{ id: string }> } };
  assert.equal(redone.redone, true);
  assert.deepEqual(redone.design.items.map((i) => i.id), ["t1"]);
  assert.ok(err(await undoTool("no-such-id")).includes("unknown design"));
  assert.ok(err(await redoTool("no-such-id")).includes("unknown design"));
});

test("a second undo after one batch reports nothing to undo", async () => {
  const made = make("One batch");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]));
  const undone = JSON.parse(await undoTool(made.id)) as { undone: boolean; design: { items: unknown[] } };
  assert.equal(undone.undone, true);
  assert.deepEqual(undone.design.items, []);
  assert.equal((JSON.parse(await undoTool(made.id)) as { undone: boolean }).undone, false);
  const redone = JSON.parse(await redoTool(made.id)) as { redone: boolean; design: { items: Array<{ id: string }> } };
  assert.equal(redone.redone, true);
  assert.deepEqual(redone.design.items.map((i) => i.id), ["t1"]);
});

test("rejects silent noops", async () => {
  const made = make("Strict");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "t1" }])).includes("patch"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "t1", patch: {} }])).includes("patch"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "t1", patch: "x" }])).includes("patch"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "set_background", background: { kind: "color" } }])).includes("color"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "set_background", background: "white" }])).includes("background"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "add", item: [1, 2] }])).includes("item"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "lock", id: "t1" }])).includes("'lock' needs"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "remove" }])).includes("'remove' needs"));
  const ids = ((JSON.parse(await getDesignTool(made.id, false)) as { items: Array<{ id: string }> }).items.map((i) => i.id));
  assert.deepEqual(ids, ["t1"]);
});

test("rejects unknown stickers and bad fits", async () => {
  const made = make("Stickers");
  const good = { id: "s1", name: "S", type: "sticker", x: 540, y: 900, width: 200, height: 200, props: { sticker: "blum/pineapple.svg" } };
  ok(await applyOpsTool(made.id, [{ op: "add", item: good }]));
  const bad = { id: "s2", name: "S", type: "sticker", x: 540, y: 900, width: 200, height: 200, props: { sticker: "nope/missing.svg" } };
  assert.ok(err(await applyOpsTool(made.id, [{ op: "add", item: bad }])).includes("sticker"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "s1", patch: { sticker: "nope/x.svg" } }])).includes("sticker"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "apply_palette", palette: { ink: "#111111" } }])).includes("unknown op"));
  assert.ok(
    err(
      await applyOpsTool(made.id, [{
        op: "add",
        item: { id: "p1", name: "P", type: "photo", x: 540, y: 900, width: 200, height: 200, props: { mask: "rect", fit: "stretch" } },
      }]),
    ).includes("fit must be"),
  );
  const stray = { id: "s3", name: "S", type: "sticker", x: 540, y: 900, width: 200, height: 200, props: "flat" };
  assert.equal((JSON.parse(await applyOpsTool(made.id, [{ op: "add", item: stray }])) as { ok: boolean }).ok, false);
  const ids = ((JSON.parse(await getDesignTool(made.id, false)) as { items: Array<{ id: string }> }).items.map((i) => i.id));
  assert.deepEqual(ids, ["s1"]);
});

test("broken file is a clean error", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = process.env.BLUM_DESIGNS as string;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "broken-1.json"),
    JSON.stringify({ version: 1, name: "Broken", format: "banner", background: { kind: "color", color: "#ffffff" }, items: [] }),
    "utf-8",
  );
  for (const reply of [
    await getDesignTool("broken-1"),
    await applyOpsTool("broken-1", [{ op: "remove", id: "x" }]),
    await undoTool("broken-1"),
    await checkDesignTool("broken-1"),
  ]) {
    assert.ok(reply.includes("invalid"), reply.slice(0, 200));
  }
});
