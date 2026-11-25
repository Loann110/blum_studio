// Ops over HTTP: apply, reject, undo/redo, sync, concurrent writes, check.
import test from "node:test";
import assert from "node:assert/strict";
import { liveServer, textItem, useTempDesigns } from "./helpers.js";
import { clearHistoryCache } from "../histories.js";

useTempDesigns("ops");

async function make(base: string, name = "Tour", format = "story"): Promise<string> {
  const res = await fetch(`${base}/api/designs`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Blum-Request": "1", origin: new URL(base).origin },
    body: JSON.stringify({ name, format }),
  });
  assert.equal(res.status, 200);
  return ((await res.json()) as { id: string }).id;
}

test("ops apply and reject", async () => {
  const c = await liveServer();
  try {
    const id = await make(c.base);
    const res = await c.post(`/api/designs/${id}/ops`, { ops: [{ op: "add", item: textItem("t", "Hi") }] });
    assert.equal(res.status, 200);
    assert.equal(
      ((res.json() as { design: { items: Array<{ props: { text: string } }> } }).design.items[0].props.text),
      "Hi",
    );
    const bad = await c.post(`/api/designs/${id}/ops`, { ops: [{ op: "update", id: "missing", patch: { x: 1 } }] });
    assert.equal(bad.status, 400);
    assert.equal((await c.post(`/api/designs/${id}/ops`, { ops: [] })).status, 400);
  } finally {
    await c.close();
  }
});

test("first undo reverts the batch", async () => {
  const c = await liveServer();
  try {
    const id = await make(c.base);
    await c.post(`/api/designs/${id}/ops`, { ops: [{ op: "add", item: textItem("t") }] });
    const undone = (await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean; design: { items: unknown[] } };
    assert.equal(undone.undone, true);
    assert.deepEqual(undone.design.items, []);
    const redone = (await (await c.post(`/api/designs/${id}/redo`)).json()) as { redone: boolean; design: { items: unknown[] } };
    assert.equal(redone.redone, true);
    assert.equal(redone.design.items.length, 1);
    assert.equal(((await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean }).undone, true);
    assert.equal(((await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean }).undone, true);
    assert.equal(((await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean }).undone, false);
  } finally {
    await c.close();
  }
});

test("undo works after the in-memory cache is dropped", async () => {
  const c = await liveServer();
  try {
    const id = await make(c.base);
    await c.post(`/api/designs/${id}/ops`, { ops: [{ op: "add", item: textItem("t") }] });
    clearHistoryCache(); // the other process / a restart
    const undone = (await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean; design: { items: unknown[] } };
    assert.equal(undone.undone, true);
    assert.deepEqual(undone.design.items, []);
  } finally {
    await c.close();
  }
});

test("sync seeds an empty stack but never eats an undo", async () => {
  const c = await liveServer();
  try {
    const id = await make(c.base);
    assert.equal((await c.post(`/api/designs/${id}/sync`)).status, 200);
    assert.equal(((await (await c.post(`/api/designs/${id}/undo`)).json()) as { undone: boolean }).undone, true);

    const id2 = await make(c.base, "Second");
    await c.post(`/api/designs/${id2}/ops`, { ops: [{ op: "add", item: textItem("t") }] });
    await c.post(`/api/designs/${id2}/sync`);
    await c.post(`/api/designs/${id2}/sync`);
    const undone = (await (await c.post(`/api/designs/${id2}/undo`)).json()) as { undone: boolean; design: { items: unknown[] } };
    assert.equal(undone.undone, true);
    assert.deepEqual(undone.design.items, []);
  } finally {
    await c.close();
  }
});

test("concurrent HTTP commits serialize per design", async () => {
  const c = await liveServer();
  try {
    const id = await make(c.base, "Race");
    const shape = (n: number) => ({
      op: "add",
      item: { id: `it${n}`, name: `it${n}`, type: "shape", x: 100 + n, y: 100, width: 50, height: 50, props: { shape: "rect", fill: "#111111" } },
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, n) => c.post(`/api/designs/${id}/ops`, { ops: [shape(n)] })),
    );
    assert.ok(results.every((r) => r.status === 200));
    const state = (await (await c.get(`/api/designs/${id}/state`)).json()) as { design: { items: unknown[] } };
    assert.equal(state.design.items.length, 20);
  } finally {
    await c.close();
  }
});
