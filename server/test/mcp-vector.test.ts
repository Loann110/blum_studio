// SVG workshop over MCP: draw_svg adds a vector, shows it, and exports it.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeBrowser } from "../export/browser.js";
import { createDesignTool, getDesignTool } from "../mcp/tools/designs.js";
import { exportPngTool } from "../mcp/tools/export.js";
import { drawSvgTool } from "../mcp/tools/vector.js";
import { closeTo, pixelAt, useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-vector");
after(() => closeBrowser());

const SQUARE = '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/></svg>';

function newDesign(): string {
  const id = (JSON.parse(createDesignTool("Workshop", "post")) as { id: string }).id;
  return id;
}

test("draw_svg adds a vector and answers with its id and a preview", async () => {
  const id = newDesign();
  const reply = (await drawSvgTool(id, SQUARE, 540, 675, 400, 400, "Red block")) as Array<{ type: string; text?: string }>;
  assert.deepEqual(reply.map((part) => part.type), ["text", "image"]);
  const { ok, id: itemId } = JSON.parse(reply[0].text ?? "") as { ok: boolean; id: string };
  assert.ok(ok && itemId.startsWith("red-block-"));
  assert.match(getDesignTool(id), /vector.*svg \d+ bytes/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-vector-"));
  const out = path.join(dir, "out.png");
  await exportPngTool(id, out);
  const png = fs.readFileSync(out);
  assert.ok(closeTo(await pixelAt(png, 540, 675), [255, 0, 0]), "the vector paints its red fill");
  assert.ok(closeTo(await pixelAt(png, 40, 40), [255, 255, 255]), "outside the vector the page shows");
});

test("draw_svg refuses hostile or broken input and changes nothing", async () => {
  const id = newDesign();
  const script = (await drawSvgTool(id, '<svg viewBox="0 0 1 1" onload="alert(1)"></svg>', 540, 675, 100, 100)) as string;
  assert.match(script, /'onload' is not allowed/);
  assert.match((await drawSvgTool(id, SQUARE, 540, 675, 0, 100)) as string, /positive width and height/);
  assert.match((await drawSvgTool(id, 42, 540, 675, 100, 100)) as string, /svg must be a string/);
  assert.match((await drawSvgTool("no-such-id", SQUARE, 540, 675, 100, 100)) as string, /unknown design/);
  assert.doesNotMatch(getDesignTool(id), /vector/);
});
