// Designs over HTTP: list, get, create, delete, rename, duplicate, state, mtime.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { liveServer, textItem, useTempDesigns } from "./helpers.js";
import { blankDesign, createDesign, getDesign, saveDesign } from "../store.js";

useTempDesigns("designs");

test("create and state keep unicode names", async () => {
  const c = await liveServer();
  try {
    const made = (await (await c.post("/api/designs", { name: "Fête d'été — 21 h", format: "story" })).json()) as {
      id: string;
    };
    const state = await c.get(`/api/designs/${made.id}/state`);
    assert.equal(state.status, 200);
    const body = state.json() as { design: { name: string }; updated: number };
    assert.equal(body.design.name, "Fête d'été — 21 h");
    assert.ok(body.updated > 0);
  } finally {
    await c.close();
  }
});

test("get one design and 404 on unknown", async () => {
  const c = await liveServer();
  try {
    const made = createDesign("Single", "post");
    const res = await c.get(`/api/designs/${made.id}`);
    assert.equal(res.status, 200);
    assert.equal((res.json() as { design: { format: string } }).design.format, "post");
    assert.equal((await c.get("/api/designs/nope")).status, 404);
  } finally {
    await c.close();
  }
});

test("delete removes the design and its history", async () => {
  const c = await liveServer();
  try {
    const made = (await (await c.post("/api/designs", { name: "Doomed" })).json()) as { id: string };
    const del = await c.del(`/api/designs/${made.id}`);
    assert.equal(del.status, 200);
    assert.deepEqual(del.json(), { deleted: made.id });
    assert.equal((await c.get(`/api/designs/${made.id}/state`)).status, 404);
    assert.equal((await c.del("/api/designs/nope-123")).status, 404);
  } finally {
    await c.close();
  }
});

test("rename validates the name", async () => {
  const c = await liveServer();
  try {
    const made = (await (await c.post("/api/designs", { name: "Rename Me" })).json()) as { id: string };
    const renamed = await c.put(`/api/designs/${made.id}`, { name: "Renamed" });
    assert.equal(renamed.status, 200);
    const listed = (await (await c.get("/api/designs")).json()) as Array<{ id: string; name: string }>;
    assert.equal(listed.find((r) => r.id === made.id)?.name, "Renamed");
    assert.equal((await c.put(`/api/designs/${made.id}`, { name: "  " })).status, 400);
  } finally {
    await c.close();
  }
});

test("mtime reports the file time", async () => {
  const c = await liveServer();
  try {
    const made = (await (await c.post("/api/designs", { name: "Timed" })).json()) as { id: string };
    const mtime = await c.get(`/api/designs/${made.id}/mtime`);
    assert.equal(mtime.status, 200);
    assert.ok((mtime.json() as { updated: number }).updated > 0);
    assert.equal((await c.get("/api/designs/nope/mtime")).status, 404);
  } finally {
    await c.close();
  }
});

test("list is newest first with template flags", async () => {
  const c = await liveServer();
  try {
    saveDesign("example-probe-designs", blankDesign("Old Sample", "post"));
    const first = (await (await c.post("/api/designs", { name: "First" })).json()) as { id: string };
    const second = (await (await c.post("/api/designs", { name: "Second" })).json()) as { id: string };
    const listed = (await (await c.get("/api/designs")).json()) as Array<{
      id: string;
      name: string;
      format: string;
      items: number;
      updated: number;
      template: boolean;
    }>;
    const ids = listed.map((r) => r.id);
    assert.ok(ids.indexOf(second.id) < ids.indexOf(first.id));
    assert.ok(ids.indexOf(first.id) < ids.indexOf("example-probe-designs"));
    const byId = Object.fromEntries(listed.map((r) => [r.id, r]));
    assert.equal(byId["example-probe-designs"].template, true);
    assert.equal(byId[first.id].template, false);
    assert.equal(byId[first.id].items, 0);
    assert.ok(byId[first.id].updated > 0);
  } finally {
    await c.close();
  }
});

test("list skips broken files", async () => {
  const c = await liveServer();
  try {
    const dir = process.env.BLUM_DESIGNS as string;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "broken.json"), "{nope", "utf-8");
    fs.writeFileSync(path.join(dir, "notes.txt"), "hi", "utf-8");
    const made = (await (await c.post("/api/designs", { name: "Only" })).json()) as { id: string };
    const listed = (await (await c.get("/api/designs")).json()) as Array<{ id: string }>;
    assert.ok(listed.some((r) => r.id === made.id));
    assert.ok(!listed.some((r) => r.id === "broken"));
  } finally {
    await c.close();
  }
});

test("duplicate copies content under a fresh id", async () => {
  const c = await liveServer();
  try {
    const source = (await (await c.post("/api/designs", { name: "Source Story" })).json()) as { id: string };
    assert.equal((await c.post(`/api/designs/${source.id}/ops`, { ops: [{ op: "add", item: textItem("t", "Hi") }] })).status, 200);
    const res = await c.post(`/api/designs/${source.id}/duplicate`, {});
    assert.equal(res.status, 200);
    const body = res.json() as { id: string; design: { name: string; format: string; items: unknown[] } };
    assert.ok(body.id !== source.id);
    assert.equal(body.design.name, "Source Story copy");
    const items = (await (await c.get(`/api/designs/${source.id}/state`)).json() as { design: { items: unknown[] } }).design.items;
    assert.equal(items[0] && (items[0] as { props: { text: string } }).props.text, "Hi");
    assert.deepEqual(body.design.items, items);
    const named = (await (await c.post(`/api/designs/${source.id}/duplicate`, { name: "From Template" })).json()) as {
      id: string;
      design: { name: string };
    };
    assert.equal(named.design.name, "From Template");
    assert.ok(named.id.startsWith("from-template-"));
    assert.equal((await c.post("/api/designs/nope-123/duplicate", {})).status, 404);
  } finally {
    await c.close();
  }
});

test("duplicate rejects broken json but accepts an empty body", async () => {
  const c = await liveServer();
  try {
    const source = (await (await c.post("/api/designs", { name: "Dupe Me" })).json()) as { id: string };
    const guard = { "X-Blum-Request": "1", origin: c.base };
    const broken = await c.raw(`/api/designs/${source.id}/duplicate`, {
      method: "POST",
      headers: { ...guard, "content-type": "text/plain" },
      body: "{oops",
    });
    assert.equal(broken.status, 400);
    const empty = await c.raw(`/api/designs/${source.id}/duplicate`, { method: "POST", headers: guard });
    assert.equal(empty.status, 200);
    assert.equal((empty.json() as { design: { name: string } }).design.name, "Dupe Me copy");
  } finally {
    await c.close();
  }
});

test("create reports storage failures as 500, not 400", async () => {
  const c = await liveServer();
  const dir = process.env.BLUM_DESIGNS as string;
  try {
    assert.equal((await c.post("/api/designs", { name: "Bad", format: "banner" })).status, 400);
    const blocker = path.join(dir, "blocker");
    fs.writeFileSync(blocker, "x", "utf-8");
    process.env.BLUM_DESIGNS = blocker; // mkdir fails: unwritable designs home
    assert.equal((await c.post("/api/designs", { name: "Doomed" })).status, 500);
  } finally {
    process.env.BLUM_DESIGNS = dir;
    await c.close();
  }
});

test("duplicate template keeps the original", async () => {
  const c = await liveServer();
  try {
    saveDesign("example-probe-dupe", blankDesign("Sample", "post"));
    const res = await c.post("/api/designs/example-probe-dupe/duplicate", {});
    assert.equal(res.status, 200);
    assert.equal(getDesign("example-probe-dupe").name, "Sample");
    assert.equal((res.json() as { design: { format: string } }).design.format, "post");
  } finally {
    await c.close();
  }
});
