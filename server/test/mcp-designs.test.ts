// MCP designs: entry points, create/duplicate/delete/list/get.
import test from "node:test";
import assert from "node:assert/strict";
import { ITEM_EXAMPLES } from "../mcp/item-examples.js";
import { toolResult } from "../mcp/main.js";
import { apiInfoTool, createDesignTool, deleteDraftTool, getDesignTool, listDesignsTool, listFormatsTool, overviewTool, styleGuideTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { previewTool } from "../mcp/tools/preview.js";
import { blankDesign, saveDesign } from "../store.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-designs");

function ok(reply: string): Record<string, unknown> {
  const body = JSON.parse(reply) as { ok?: boolean };
  assert.notEqual(body.ok, false, reply.slice(0, 300));
  return body as Record<string, unknown>;
}

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

function make(name = "Probe", format = "story"): { id: string } {
  return JSON.parse(createDesignTool(name, format)) as { id: string };
}

function text(id: string): Record<string, unknown> {
  return { id, name: id, type: "text", x: 540, y: 420, width: 900, height: 200, props: { text: "Hello", font: "Inter", size: 96, weight: 700, color: "#111111" } };
}

test("overview states rules and stays compact", () => {
  const out = overviewTool();
  assert.ok(out.includes("list_formats") && out.includes("check_design"));
  assert.ok(out.length <= 650);
});

test("docs name only topics and rules that exist", () => {
  // Every style topic the overview and the tool description promise answers.
  for (const topic of ["composition", "hierarchy", "type", "color", "photo", "depth", "finish", "avoid", "types"]) {
    assert.ok(!styleGuideTool(topic).includes('"ok":false'), topic);
  }
  assert.ok(overviewTool().includes("composition") && !overviewTool().includes("grid"));
  const lint = apiInfoTool("lint");
  assert.ok(lint.includes("list_formats") && !lint.includes("<30px"));
  assert.ok(lint.includes("never lower") && lint.includes("covered"));
  assert.ok(apiInfoTool("ops").includes("2 or more"));
});

test("api_info topics and bad topic", () => {
  for (const topic of ["formats", "ops", "lint", "resources", "export"]) {
    assert.ok(!apiInfoTool(topic).includes("Unknown"), topic);
  }
  assert.ok(apiInfoTool("formats") !== apiInfoTool("ops"));
  assert.ok(apiInfoTool("nope").includes("Unknown topic"));
  assert.ok(apiInfoTool(123).includes("Unknown topic"));
});

test("style_guide full and topics", () => {
  assert.ok(styleGuideTool().includes("Composition") && styleGuideTool().includes("Avoid"));
  assert.ok(styleGuideTool().includes("Type picker"));
  assert.ok(!styleGuideTool().includes("Dotted leaders"));
  assert.ok(styleGuideTool("type").includes("30 px"));
  assert.ok(styleGuideTool("types").includes("Type picker"));
  assert.ok(styleGuideTool("type:quote").includes("25 words"));
  assert.ok(styleGuideTool("nope").includes("Unknown topic"));
});

test("create happy and bad format", () => {
  const made = make("Summer drop", "post");
  assert.equal((made as unknown as { design: { format: string } }).design.format, "post");
  assert.ok(err(createDesignTool("X", "banner")).includes("story"));
  assert.equal((JSON.parse(createDesignTool("   ")) as { design: { name: string } }).design.name, "Untitled");
  assert.ok(err(createDesignTool(123, "story")).includes("must be text"));
});

test("create any format: a5 and custom", () => {
  const a5 = JSON.parse(createDesignTool("Flyer", "a5")) as { design: { format: string } };
  assert.equal(a5.design.format, "a5");
  const custom = JSON.parse(createDesignTool("Wide", "custom", 1200, 628)) as {
    design: { format: string; width: number; height: number };
  };
  assert.equal(custom.design.format, "custom");
  assert.deepEqual([custom.design.width, custom.design.height], [1200, 628]);
  assert.ok(err(createDesignTool("Small", "custom", 50, 800)).includes("100 and 4000"));
  assert.ok(err(createDesignTool("NoSize", "custom")).includes("width and height"));
});

test("list_formats shows every page size", () => {
  const rows = JSON.parse(listFormatsTool()) as Array<{ id: string; width: number | null; height: number | null }>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.deepEqual([byId.get("story")?.width, byId.get("story")?.height], [1080, 1920]);
  assert.deepEqual([byId.get("a5")?.width, byId.get("a5")?.height], [874, 1240]);
  assert.ok(byId.has("custom"));
  assert.ok(rows.length >= 14);
});

test("always from scratch: overview says so", () => {
  assert.ok(overviewTool().toLowerCase().includes("start from create_design"));
});

test("delete removes design and history", async () => {
  const made = make("Gone");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]));
  assert.deepEqual(JSON.parse(await deleteDraftTool(made.id)), { deleted: made.id });
  assert.ok(err(await getDesignTool(made.id)).includes("unknown design"));
  assert.ok(err(await deleteDraftTool(made.id)).includes("unknown design"));
  assert.ok(err(await deleteDraftTool("")).includes("bad design id"));
});

test("list shows newest first", () => {
  const first = make("First");
  const second = make("Second");
  const rows = JSON.parse(listDesignsTool()) as Array<{ id: string }>;
  const ids = rows.map((r) => r.id);
  assert.ok(ids.includes(first.id) && ids.includes(second.id));
  assert.equal(rows[0].id, second.id);
});

test("get compact and full", async () => {
  const made = make("Read me");
  ok(await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]));
  const short = await getDesignTool(made.id);
  assert.ok(short.includes("t1") && short.split("\n").length === 2);
  const full = JSON.parse(await getDesignTool(made.id, false)) as { items: Array<{ props: { text: string } }> };
  assert.equal(full.items[0].props.text, "Hello");
  assert.ok(err(await getDesignTool("no-such-id")).includes("unknown design"));
  assert.ok(err(await getDesignTool("../evil")).includes("bad design id"));
});

test("tool failures flag isError, successes do not", async () => {
  const made = make("Flagged");
  const failed = toolResult(await getDesignTool("no-such-id"));
  assert.equal(failed.isError, true);
  assert.deepEqual(failed.content, [{ type: "text", text: await getDesignTool("no-such-id") }]);
  assert.equal(toolResult(apiInfoTool("nope")).isError, true);
  assert.equal(toolResult(styleGuideTool("nope")).isError, true);
  assert.equal(toolResult(await previewTool("no-such-id")).isError, true);
  const good = toolResult(await getDesignTool(made.id));
  assert.equal(good.isError, undefined);
  assert.equal(good.content.length, 1);
});

test("samples are hidden from list and never deleted", async () => {
  saveDesign("example-probe-starter", blankDesign("S"));
  const rows = JSON.parse(listDesignsTool()) as Array<{ id: string }>;
  assert.ok(rows.every((r) => r.id !== "example-probe-starter"));
  assert.ok(err(await deleteDraftTool("example-probe-starter")).toLowerCase().includes("example"));
});

test("every api_info items example adds cleanly", async () => {
  const doc = apiInfoTool("items");
  for (const [what, item] of Object.entries(ITEM_EXAMPLES)) {
    assert.ok(doc.includes(what), what);
    const made = make(`Example ${what}`);
    const out = JSON.parse(await applyOpsTool(made.id, [{ op: "add", item }])) as { ok?: boolean; error?: string };
    assert.equal(out.ok, true, `${what}: ${out.error}`);
  }
});
