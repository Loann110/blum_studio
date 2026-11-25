// Cross-site requests: a web page on another origin must not be able to change
// designs through the local API (a "simple" text/plain POST needs no preflight).
import test from "node:test";
import assert from "node:assert/strict";
import { liveServer, textItem, useTempDesigns } from "./helpers.js";
import { createDesign, getDesign } from "../store.js";

useTempDesigns("csrf");

const addText = JSON.stringify({ ops: [{ op: "add", item: textItem("evil") }] });

test("design writes from another site are refused and change nothing", async () => {
  const c = await liveServer();
  try {
    const { id } = createDesign("Guarded", "story");
    const foreign = { "content-type": "text/plain", origin: "http://evil.example" };
    const attempts: Array<[string, string, string?]> = [
      ["POST", "/api/designs", JSON.stringify({ name: "spam" })],
      ["POST", `/api/designs/${id}/ops`, addText],
      ["POST", `/api/designs/${id}/undo`],
      ["POST", `/api/designs/${id}/redo`],
      ["POST", `/api/designs/${id}/sync`, JSON.stringify({ design: { items: [] } })],
      ["POST", `/api/designs/${id}/duplicate`, "{}"],
      ["POST", `/api/designs/${id}/export`, "{}"],
      ["POST", `/api/designs/${id}/media`, JSON.stringify({ url: "https://example.com/x.png" })],
      ["PUT", `/api/designs/${id}`, JSON.stringify({ name: "renamed" })],
      ["DELETE", `/api/designs/${id}`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await c.raw(path, { method, headers: foreign, body });
      assert.equal(res.status, 403, `${method} ${path} must be refused`);
      // No header and no origin at all (a form post or a script tag) is refused too.
      const bare = await c.raw(path, { method, headers: { "content-type": "text/plain" }, body });
      assert.equal(bare.status, 403, `${method} ${path} without the header must be refused`);
    }
    const after = getDesign(id) as unknown as { name: string; items: unknown[] };
    assert.equal(after.name, "Guarded");
    assert.equal(after.items.length, 0);
  } finally {
    await c.close();
  }
});

test("the same writes from the app itself still work", async () => {
  const c = await liveServer();
  try {
    const { id } = createDesign("Mine", "story");
    const res = await c.post(`/api/designs/${id}/ops`, { ops: [{ op: "add", item: textItem("ok") }] });
    assert.equal(res.status, 200);
    assert.equal((getDesign(id) as unknown as { items: unknown[] }).items.length, 1);
  } finally {
    await c.close();
  }
});
