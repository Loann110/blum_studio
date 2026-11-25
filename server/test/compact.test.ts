// Compact replies: one line per object, touched ids per batch.
import test from "node:test";
import assert from "node:assert/strict";
import { compactDesign, touchedIds, walkIds } from "../mcp/compact.js";
import { applyOps } from "../../ui/engine/index.js";

function design(): Record<string, unknown> {
  return {
    version: 1,
    name: "Demo",
    format: "story",
    background: { kind: "color", color: "#fdf6ec" },
    items: [
      {
        id: "title",
        name: "Title",
        type: "text",
        x: 540,
        y: 330,
        width: 900,
        height: 150,
        angle: 0,
        opacity: 1.0,
        locked: false,
        visible: true,
        props: { text: "Fête d'été — 21 h", font: "Fraunces", size: 96, weight: 700, align: "center", color: "#1b1b1f" },
      },
      {
        id: "photo",
        name: "Photo",
        type: "photo",
        x: 540,
        y: 1050,
        width: 700,
        height: 700,
        angle: 0,
        opacity: 1.0,
        locked: false,
        visible: true,
        props: { mask: "arch", src: "media/a.jpg", fit: "cover", cornerRadius: 24 },
      },
    ],
  };
}

test("compact is short and readable", () => {
  const short = compactDesign(design() as never);
  assert.ok(short.includes("title text"));
  assert.ok(short.includes("Fête d'été — 21 h"));
  assert.ok(short.includes("photo photo arch media/a.jpg"));
  assert.equal(short.split("\n").length, 3); // canvas + 2 items
  assert.ok(short.length < 500);
});

test("touched ids cover op kinds", () => {
  const before = new Set(["title"]);
  const after = new Set(["title", "title-2", "group-1"]);
  const ops = [
    { op: "update", id: "title", patch: { x: 1 } },
    { op: "group", ids: ["title", "title-2"], name: "group-1" },
  ];
  assert.deepEqual(touchedIds(ops, before, after), ["title", "title-2", "group-1"]);
});

test("walk ids reaches group children", () => {
  assert.deepEqual(walkIds([{ id: "g", items: [{ id: "kid", items: [] }] }]), new Set(["g", "kid"]));
});

test("arrange stacks in safe zone", () => {
  const item = (i: string) => ({
    id: i,
    name: i,
    type: "text",
    x: 0,
    y: 0,
    width: 900,
    height: 150,
    props: { text: i, font: "Inter", size: 64, color: "#111111" },
  });
  const base = {
    version: 1,
    name: "t",
    format: "story",
    background: { kind: "color", color: "#ffffff" },
    items: [item("a"), item("b")],
  };
  const out = applyOps(base, [{ op: "arrange", layout: { stack: "column", items: ["a", "b"], align: "center" } }]) as {
    items: Array<{ y: number; x: number }>;
  };
  const ys = out.items.map((i) => i.y);
  assert.ok(ys[0] < ys[1]);
  assert.ok(out.items.every((i) => i.x === 540));
  assert.throws(() => applyOps(base, [{ op: "arrange" }]));
});
