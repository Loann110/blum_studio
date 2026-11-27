// Ingredients: new fields ride MCP ops into the renderer (real Chromium page,
// same bundle as the PNG export).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { closeBrowser, getOrLaunchBrowser } from "../export/browser.js";
import { createDesignTool, getDesignTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { listResourcesTool } from "../mcp/tools/resources.js";
import { renderHtml } from "../export/png.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("ingredients");
after(() => closeBrowser());

function ok(reply: string): Record<string, unknown> {
  const body = JSON.parse(reply) as { ok?: boolean };
  assert.notEqual(body.ok, false, reply.slice(0, 300));
  return body as Record<string, unknown>;
}

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

test("new fields apply and render", async () => {
  const made = JSON.parse(createDesignTool("Ingredients", "story")) as { id: string };
  ok(await applyOpsTool(made.id, [
    { op: "set_background", background: { kind: "color", color: "#1a1a2e", grain: 40 } },
    {
      op: "add", item: {
        id: "tex", name: "tex", type: "image", x: 540, y: 960, width: 1080, height: 1920,
        blend: "multiply", props: { src: "textures/paper-white.jpg", fit: "cover" },
      },
    },
    {
      op: "add", item: {
        id: "cut", name: "cut", type: "photo", x: 540, y: 700, width: 600, height: 600,
        props: {
          src: "textures/linen.jpg", mask: "rect",
          outlineColor: "#ffffff", outlineWidth: 10,
        },
      },
    },
    {
      op: "add", item: {
        id: "doodle", name: "doodle", type: "sticker", x: 540, y: 1500, width: 220, height: 220,
        props: { sticker: "blum-doodles/curved-arrow.svg", tint: "#ffd60a" },
      },
    },
    {
      op: "add", item: {
        id: "star", name: "star", type: "photo", x: 540, y: 300, width: 300, height: 300,
        props: { src: "textures/canvas.jpg", mask: "star" },
      },
    },
    {
      op: "add", item: {
        id: "big", name: "big", type: "text", x: 540, y: 1200, width: 900, height: 220,
        props: {
          text: "J-6", font: "Oswald", size: 200, weight: 700, align: "center",
          color: "#ffffff", textFill: "textures/watercolor-wash.jpg",
        },
      },
    },
  ]));
  const full = JSON.parse(await getDesignTool(made.id, false)) as {
    background: { grain: number }; items: Array<{ blend?: string; props: Record<string, unknown> }>;
  };
  assert.equal(full.background.grain, 40);
  // Same page the PNG export screenshots: the bundle renders client-side.
  const page = await (await getOrLaunchBrowser()).newPage();
  try {
    await page.setContent(renderHtml(full as unknown as Parameters<typeof renderHtml>[0]), { waitUntil: "load" });
    const html = await page.evaluate(() => document.getElementById("stage")?.innerHTML ?? "");
    assert.ok(html.includes("mix-blend-mode:multiply"), "blend renders");
    assert.ok(html.includes("drop-shadow("), "outline renders");
    assert.ok(html.includes("clip-path:url(#bClip-star)"), "star mask renders");
    assert.ok(html.includes("background-clip:text"), "textFill renders");
    assert.ok(html.includes("bGrain"), "grain renders");
    assert.ok(html.includes("blum-doodles/curved-arrow.svg"), "doodle renders");
    assert.ok(html.includes("Oswald"), "new font renders");
  } finally {
    await page.close();
  }
});

test("bad new values fail", async () => {
  const made = JSON.parse(createDesignTool("Bad", "story")) as { id: string };
  ok(await applyOpsTool(made.id, [{
    op: "add", item: {
      id: "s", name: "s", type: "shape", x: 540, y: 960, width: 200, height: 200,
      props: { shape: "rect", fill: "#111111" },
    },
  }]));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "s", patch: { blend: "fry" } }])).includes("blend must be"));
  assert.ok(err(await applyOpsTool(made.id, [{ op: "update", id: "s", patch: { outlineWidth: 5 } }])).includes("unknown field"));
  assert.ok(err(await applyOpsTool(made.id, [
    { op: "set_background", background: { kind: "color", color: "#000000", grain: 101 } },
  ])).includes("grain must be within"));
});

test("resources list the new assets", async () => {
  assert.ok((JSON.parse(await listResourcesTool("fonts", "Oswald")) as string[]).includes("Oswald"));
  assert.ok((JSON.parse(await listResourcesTool("fonts", "Barlow Condensed")) as string[]).includes("Barlow Condensed"));
  const masks = JSON.parse(await listResourcesTool("masks")) as string[];
  assert.ok(masks.includes("star") && masks.includes("blob") && masks.includes("heart"));
  const curved = JSON.parse(await listResourcesTool("stickers", "curved")) as Array<{ id: string }>;
  assert.ok(curved.some((e) => e.id.includes("blum-doodles/")), "curved search finds doodles");
  const en = JSON.parse(await listResourcesTool("stickers", "arrow")) as Array<{ id: string }>;
  assert.ok(en.some((e) => e.id.includes("blum-doodles/")), "english search finds doodles");
  const phone = JSON.parse(await listResourcesTool("stickers", "phone")) as Array<{ id: string }>;
  assert.ok(phone.some((e) => e.id.includes("phone-doodle")), "phone doodle is searchable");
});
