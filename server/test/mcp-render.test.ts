// MCP preview/export: small PNGs, boards, full exports, post format.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeBrowser } from "../export/browser.js";
import { createDesignTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { exportPdfTool, exportPngTool } from "../mcp/tools/export.js";
import { previewBoardTool, previewTool } from "../mcp/tools/preview.js";
import { pngSize, useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-render");
after(() => closeBrowser());

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

function text(id: string): Record<string, unknown> {
  return { id, name: id, type: "text", x: 540, y: 420, width: 900, height: 200, props: { text: "Hello", font: "Inter", size: 96, weight: 700, color: "#111111" } };
}

test("preview is a small png", async () => {
  const made = JSON.parse(createDesignTool("Seen", "story")) as { id: string };
  await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]);
  const parts = (await previewTool(made.id)) as Array<{ type: string; data: string }>;
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, "image");
  const [w, h] = pngSize(Buffer.from(parts[0].data, "base64"));
  assert.ok(w <= 400 && h > 0, `${w}x${h}`);
  assert.equal(await previewTool("no-such-id"), "error: unknown design 'no-such-id' (use list_designs to see ids)");
  assert.ok(Array.isArray(await previewTool(made.id, "huge")));
});

test("preview board rows and caps", async () => {
  const first = JSON.parse(createDesignTool("Board A", "story")) as { id: string };
  const [head, ...images] = (await previewBoardTool([first.id, "no-such-id"])) as Array<{ type: string; text?: string }>;
  const rows = JSON.parse(head.text ?? "") as Array<{ image?: number; name?: string; error?: string }>;
  assert.ok(rows[0].image === 1 && rows[0].name === "Board A");
  assert.ok((rows[1].error ?? "").includes("unknown design"));
  assert.deepEqual(images.map((p) => p.type), ["image"]);
  assert.ok(err((await previewBoardTool(Array(13).fill(first.id))) as string).includes("at most 12"));
  assert.ok(err((await previewBoardTool([])) as string).includes("non-empty list"));
});

test("export writes 1080x1920", async () => {
  const made = JSON.parse(createDesignTool("Exported", "story")) as { id: string };
  await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-exp-"));
  const out = path.join(dir, "out.png");
  const got = JSON.parse(await exportPngTool(made.id, out)) as { path: string };
  assert.equal(got.path, out);
  assert.deepEqual(pngSize(fs.readFileSync(out)), [1080, 1920]);
  assert.ok(err(await exportPngTool(made.id, path.join(dir, "out.jpg"))).includes("must end with '.png'"));
  assert.ok(err(await exportPngTool(made.id, path.join(dir, "nodir", "out.png"))).includes("does not exist"));
  assert.ok(err(await exportPngTool("no-such-id")).includes("unknown design"));
});

test("export a5 is 1748x2480 at 2x", async () => {
  const made = JSON.parse(createDesignTool("Flyer", "a5")) as { id: string };
  await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-a5-"));
  const out = path.join(dir, "a5.png");
  const got = JSON.parse(await exportPngTool(made.id, out)) as { path: string };
  assert.equal(got.path, out);
  assert.deepEqual(pngSize(fs.readFileSync(out)), [1748, 2480]);
});

test("export_pdf keeps the exact page size with vector text", async () => {
  const made = JSON.parse(createDesignTool("Flyer", "a5")) as { id: string };
  await applyOpsTool(made.id, [{ op: "add", item: text("t1") }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-pdf-"));
  const out = path.join(dir, "a5.pdf");
  const got = JSON.parse(await exportPdfTool(made.id, out)) as { path: string };
  assert.equal(got.path, out);
  const raw = fs.readFileSync(out, "latin1");
  const box = raw.match(/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  assert.ok(box, "pdf has a MediaBox");
  const nums = (box as RegExpMatchArray).slice(1, 5).map(Number);
  const w = nums[2] - nums[0];
  const h = nums[3] - nums[1];
  // Chromium quantizes mm to whole rendering units: within 1 pt (~0.35 mm).
  assert.ok(Math.abs(w - (148 * 72) / 25.4) < 1, `width ${w}`);
  assert.ok(Math.abs(h - (210 * 72) / 25.4) < 1, `height ${h}`);
  assert.ok(raw.includes("/Font"), "pdf embeds a font (selectable text)");
  assert.equal(raw.match(/\/Type\s*\/Page[^s]/g)?.length, 1);
  assert.ok(err(await exportPdfTool(made.id, path.join(dir, "a5.png"))).includes("must end with '.pdf'"));
});

test("export post is 1080x1350", async () => {
  const made = JSON.parse(createDesignTool("Affiche", "post")) as { id: string };
  await applyOpsTool(made.id, [
    { op: "set_background", background: { kind: "pattern", pattern: "dots", patternColor: "#111111" } },
    { op: "add", item: { id: "t1", name: "T", type: "text", x: 540, y: 420, width: 900, height: 200, props: { text: "Samedi 21 h", font: "Inter", size: 96, color: "#111111" } } },
    { op: "lock", id: "t1", locked: true },
    { op: "lock", id: "t1", locked: false },
  ]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-post-"));
  const out = path.join(dir, "post.png");
  const got = JSON.parse(await exportPngTool(made.id, out)) as { path: string };
  assert.equal(got.path, out);
  assert.deepEqual(pngSize(fs.readFileSync(out)), [1080, 1350]);
});
