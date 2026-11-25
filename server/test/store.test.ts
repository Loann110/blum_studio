// Store: JSON designs, atomic writes, magic-byte image checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { blankDesign, createDesign, deleteDesign, getDesign, importImage, listDesigns, saveDesign, UnknownDesign } from "../store.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("store");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

test("create and get roundtrip", () => {
  const made = createDesign("Party", "story");
  assert.ok(made.id.startsWith("party-"));
  const back = getDesign(made.id);
  assert.equal(back.name, "Party");
  assert.equal(back.format, "story");
});

test("create rejects bad format", () => {
  assert.throws(() => createDesign("X", "banner"), /format must be one of story/);
});

test("list designs and save refuses invalid", () => {
  createDesign("One", "story");
  createDesign("Two", "post");
  const names = new Set(listDesigns().map((d) => d.name));
  assert.ok(names.has("One") && names.has("Two"));
  const made = createDesign("Bad", "story");
  const design = getDesign(made.id) as Record<string, unknown>;
  design.format = "banner";
  assert.throws(() => saveDesign(made.id, design), /invalid design/);
});

test("unknown design raises", () => {
  assert.throws(() => getDesign("nope-123"), UnknownDesign);
});

test("delete design", () => {
  const made = createDesign("Temp", "story");
  deleteDesign(made.id);
  const dir = process.env.BLUM_DESIGNS as string;
  assert.ok(!fs.existsSync(path.join(dir, `${made.id}.json`)));
  assert.ok(listDesigns().every((d) => d.id !== made.id));
  assert.throws(() => getDesign(made.id), UnknownDesign);
  assert.throws(() => deleteDesign(made.id), UnknownDesign);
});

test("import png ok, text rejected, unknown design rejected", async () => {
  const made = createDesign("Media", "story");
  const got = await importImage(made.id, PNG, "cake.png");
  assert.ok(got.src.startsWith("media/"));
  assert.ok(got.src.endsWith(".png"));
  await assert.rejects(importImage(made.id, Buffer.from("hello world"), "note.txt"), /not a PNG/);
  await assert.rejects(importImage("nope-123", JPG, "a.jpg"), UnknownDesign);
});

test("svg detected", async () => {
  const made = createDesign("Media", "story");
  const got = await importImage(made.id, Buffer.from('<svg xmlns="x"></svg>'), "icon");
  assert.ok(got.src.endsWith(".svg"));
});

test("accents roundtrip as utf-8", () => {
  const made = createDesign("Fête d'été — 21 h", "story");
  const design = getDesign(made.id) as unknown as { name: string; items: Array<Record<string, unknown>> };
  assert.equal(design.name, "Fête d'été — 21 h");
  design.items.push({
    id: "t",
    name: "t",
    type: "text",
    x: 540,
    y: 400,
    width: 900,
    height: 200,
    props: { text: "Fête d'été — 21 h", font: "Fraunces", size: 120, color: "#111111" },
  });
  saveDesign(made.id, design as never);
  const raw = fs.readFileSync(path.join(process.env.BLUM_DESIGNS as string, `${made.id}.json`));
  assert.ok(raw.includes(Buffer.from("Fête d'été — 21 h", "utf-8")));
  const back = getDesign(made.id) as unknown as { items: Array<{ props: { text: string } }> };
  assert.equal(back.items[0].props.text, "Fête d'été — 21 h");
});

test("blank design rejects bad format", () => {
  assert.throws(() => blankDesign("X", "banner"), /format must be one of story/);
});
