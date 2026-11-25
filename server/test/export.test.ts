// Export over HTTP: render shell, gallery endpoints, PNG export.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { closeTo, liveServer, pixelAt, pngSize, useTempDesigns } from "./helpers.js";
import { renderHtml } from "../export/png.js";
import { createDesign, getDesign } from "../store.js";
import { closeBrowser } from "../export/browser.js";

useTempDesigns("export");
after(() => closeBrowser());

function sample(): Record<string, unknown> {
  return {
    version: 1,
    name: "Export me",
    format: "story",
    background: { kind: "color", color: "#a855f7" },
    items: [
      {
        id: "title",
        name: "Title",
        type: "text",
        x: 540,
        y: 500,
        width: 900,
        height: 200,
        props: { text: "Hello", font: "Fraunces", size: 120, weight: 700, align: "center", color: "#ffffff" },
      },
    ],
  };
}

test("render html has the stage", () => {
  const html = renderHtml(sample());
  assert.ok(html.includes("blum-stage"));
  assert.ok(html.includes("Hello"));
  assert.ok(html.includes("BlumRender"));
});

test("gallery api lists and gets designs", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Listed", "story");
    const listed = (await (await c.get("/api/designs")).json()) as Array<{ id: string }>;
    assert.ok(listed.some((d) => d.id === made.id));
    const res = await c.get(`/api/designs/${made.id}`);
    assert.equal(res.status, 200);
    assert.equal((res.json() as { design: { format: string } }).design.format, "story");
  } finally {
    await c.close();
  }
});

test("index serves Create and /designs serves the gallery", async () => {
  const c = await liveServer();
  try {
    const res = await c.get("/");
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('id="prompt"'));
    assert.ok(res.text.includes('id="agent-menu"'));
    const designs = await c.get("/designs");
    assert.equal(designs.status, 200);
    assert.ok(designs.text.includes("<h1>Designs</h1>"));
    assert.ok(designs.text.includes('id="new-story"'));
    assert.ok(designs.text.includes('id="new-post"'));
    assert.ok(!designs.text.includes('id="search"'));
    const resources = await c.get("/resources");
    assert.equal(resources.status, 200);
    for (const tab of ["Stickers", "Fonts", "Photos"]) assert.ok(resources.text.includes(tab));
    const started = await c.get("/getting-started");
    assert.equal(started.status, 200);
    assert.equal(started.text.split('class="step"').length - 1, 3);
  } finally {
    await c.close();
  }
});

test("create accepts any format and custom sizes", async () => {
  const c = await liveServer();
  try {
    const a5 = (await (await c.post("/api/designs", { name: "Flyer", format: "a5" })).json()) as {
      design: { format: string };
    };
    assert.equal(a5.design.format, "a5");
    const custom = (await (await c.post("/api/designs", { name: "Wide", format: "custom", width: 1200, height: 628 })).json()) as {
      design: { format: string; width: number; height: number };
    };
    assert.equal(custom.design.format, "custom");
    assert.deepEqual([custom.design.width, custom.design.height], [1200, 628]);
    assert.equal(await (await c.post("/api/designs", { name: "Bad", format: "banner" })).status, 400);
    assert.equal(await (await c.post("/api/designs", { name: "Tiny", format: "custom", width: 50, height: 800 })).status, 400);
  } finally {
    await c.close();
  }
});

test("png keeps the page size, print at 2x", async () => {
  const c = await liveServer();
  try {
    const { saveDesign } = await import("../store.js");
    const a5 = createDesign("Flyer", "a5");
    const design = getDesign(a5.id);
    design.items = sample().items as unknown[];
    (design.items as Array<Record<string, unknown>>)[0].x = 437;
    saveDesign(a5.id, design as never);
    const png = await c.get(`/api/designs/${a5.id}/png`);
    assert.equal(png.status, 200);
    assert.deepEqual(pngSize(await png.bytes()), [1748, 2480]);
    const wide = createDesign("Wide", "custom", 1200, 628);
    const custom = await c.get(`/api/designs/${wide.id}/png`);
    assert.equal(custom.status, 200);
    assert.deepEqual(pngSize(await custom.bytes()), [1200, 628]);
  } finally {
    await c.close();
  }
});

test("pdf route keeps the exact page size with vector text", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Flyer", "a5");
    const design = getDesign(made.id);
    design.items = sample().items as unknown[];
    (await import("../store.js")).saveDesign(made.id, design as never);
    const res = await c.get(`/api/designs/${made.id}/pdf`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    const raw = Buffer.from(await res.bytes()).toString("latin1");
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
    assert.equal((await c.get("/api/designs/missing/pdf")).status, 404);
  } finally {
    await c.close();
  }
});

test("export writes a 1080x1920 png", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Exported", "story");
    const design = getDesign(made.id);
    design.items = sample().items as unknown[];
    (await import("../store.js")).saveDesign(made.id, design as never);
    const res = await c.post(`/api/designs/${made.id}/export`);
    assert.equal(res.status, 200);
    const body = res.json() as { path: string; url: string };
    assert.ok(body.path.endsWith(".png"));
    assert.equal(body.url, `/api/designs/${made.id}/png`);
    const png = await c.get(body.url);
    assert.equal(png.status, 200);
    assert.equal(png.headers.get("content-type"), "image/png");
    assert.deepEqual(pngSize(await png.bytes()), [1080, 1920]);
  } finally {
    await c.close();
  }
});

test("png paints the background and a placed shape where they belong", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Pixels", "post");
    const design = getDesign(made.id) as unknown as {
      background: unknown;
      items: Array<Record<string, unknown>>;
    };
    design.background = { kind: "color", color: "#0000ff" };
    design.items = [
      {
        id: "block",
        name: "block",
        type: "shape",
        x: 540,
        y: 540,
        width: 400,
        height: 400,
        props: { shape: "rect", fill: "#ff0000" },
      },
    ];
    (await import("../store.js")).saveDesign(made.id, design as never);
    const bytes = await (await c.get(`/api/designs/${made.id}/png`)).bytes();
    const [w, h] = pngSize(bytes);
    assert.deepEqual(await pixelAt(bytes, Math.floor(w / 2), Math.floor(h / 2)), [255, 0, 0]);
    assert.ok(closeTo(await pixelAt(bytes, 10, 10), [0, 0, 255]), "corner shows the page background");
  } finally {
    await c.close();
  }
});

test("check reports findings and a score", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Checked", "story");
    const res = await c.get(`/api/designs/${made.id}/check`);
    assert.equal(res.status, 200);
    const body = res.json() as { findings: unknown[]; score: number };
    assert.ok(Array.isArray(body.findings));
    assert.ok(typeof body.score === "number");
  } finally {
    await c.close();
  }
});

test("resources list fonts, stickers, categories, photos, masks", async () => {
  const c = await liveServer();
  try {
    const fonts = (await (await c.get("/api/resources?kind=fonts")).json()) as string[];
    assert.ok(fonts.includes("Inter"));
    const hits = (await (await c.get("/api/resources?kind=stickers&query=pineapple")).json()) as Array<{ id: string }>;
    assert.ok(hits.some((h) => h.id === "blum/pineapple.svg"));
    const cats = (await (await c.get("/api/resources?kind=categories")).json()) as string[];
    assert.ok(cats.includes("Fruits"));
    const photos = (await (await c.get("/api/resources?kind=photos&query=sea")).json()) as unknown[];
    assert.ok(photos.length > 0);
    assert.ok(((await (await c.get("/api/resources?kind=masks")).json()) as string[]).includes("arch"));
    assert.equal((await c.get("/api/resources?kind=nope")).status, 400);
    assert.equal((await c.get("/api/resources?kind=palettes")).status, 400);
  } finally {
    await c.close();
  }
});
