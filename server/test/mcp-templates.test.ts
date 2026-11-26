// MCP templates: example-* designs refuse every MCP write, stay readable.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkDesignTool } from "../mcp/tools/check.js";
import { createDesignTool, getDesignTool } from "../mcp/tools/designs.js";
import { importImageTool } from "../mcp/tools/media.js";
import { applyOpsTool, redoTool, undoTool } from "../mcp/tools/ops.js";
import { drawSvgTool } from "../mcp/tools/vector.js";
import { mediaDir } from "../paths.js";
import { blankDesign, designPath, saveDesign } from "../store.js";
import { tinyPng, useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-templates");

const ID = "example-s6-guard";
const SQUARE = '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/></svg>';

function text(id: string): Record<string, unknown> {
  return { id, name: id, type: "text", x: 540, y: 960, width: 900, height: 200, props: { text: "Hello", font: "Inter", size: 96, weight: 700, color: "#111111" } };
}

test("example designs refuse MCP writes and stay byte-identical", async () => {
  saveDesign(ID, blankDesign("Sample"));
  const before = fs.readFileSync(designPath(ID));
  const shot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "blum-mcp-tpl-")), "hero.png");
  fs.writeFileSync(shot, tinyPng());
  const replies = [
    await applyOpsTool(ID, [{ op: "add", item: text("t1") }]),
    await undoTool(ID),
    await redoTool(ID),
    await importImageTool(ID, shot, "hero"),
    (await drawSvgTool(ID, SQUARE, 540, 960, 100, 100)) as string,
  ];
  for (const reply of replies) {
    assert.equal(typeof reply, "string", "a refused write answers with text, not an image");
    const body = JSON.parse(reply) as { ok?: boolean; error?: string };
    assert.equal(body.ok, false, reply.slice(0, 200));
    assert.match(body.error ?? "", /example/);
    assert.match(body.error ?? "", /create_design/);
  }
  assert.deepEqual(fs.readFileSync(designPath(ID)), before);
  assert.ok(!fs.existsSync(mediaDir()) || fs.readdirSync(mediaDir()).every((f) => !f.startsWith(ID)));
  assert.ok(!(await getDesignTool(ID)).includes('"ok":false'));
  const report = JSON.parse(await checkDesignTool(ID)) as { score: number };
  assert.equal(typeof report.score, "number");
});

test("a design named Example is a draft, not a template", async () => {
  const made = JSON.parse(createDesignTool("Example menu", "story")) as { id: string };
  assert.ok(!made.id.startsWith("example-"), made.id);
  assert.ok((await applyOpsTool(made.id, [{ op: "add", item: text("t1") }])).includes('"ok":true'));
});
