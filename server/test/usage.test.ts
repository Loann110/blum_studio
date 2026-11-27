// Usage: per-design agent estimates recorded by MCP, served over HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { deleteRoute, usageRoute } from "../routes/designs.js";
import { createDesign } from "../store.js";
import { forgetUsage, readUsage, recordUsage } from "../usage.js";
import type { Content } from "../mcp/trust.js";
import { useTempDesigns } from "./helpers.js";

/** Runs a route against a fake response; the route only writes JSON. */
function reply(run: (res: ServerResponse) => Promise<void>): Promise<{ status: number; body: unknown }> {
  let status = 0;
  let body = "";
  const res = {
    writeHead(code: number) {
      status = code;
      return res;
    },
    end(text?: string) {
      body = text ?? "";
    },
  } as unknown as ServerResponse;
  return run(res).then(() => ({ status, body: body ? JSON.parse(body) : undefined }));
}

useTempDesigns("usage");

function expectedUsd(input: number, out: number): number {
  return (input * 3 + out * 15) / 1e6;
}

test("records calls, written and returned tokens, time and dollars", async () => {
  const id = createDesign("Usage math", "story").id;
  assert.equal(readUsage(id), null);

  const args = { design_id: id, ops: [] };
  const written = Math.round(JSON.stringify(args).length / 4);
  await recordUsage(id, args, "ok");
  const first = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  assert.equal(first.calls, 1);
  assert.equal(first.out, written);
  assert.equal(first.back, Math.round("ok".length / 4));
  assert.equal(first.input, 20000); // BASE, nothing returned before it
  assert.ok(first.first <= first.last);
  assert.equal(first.usd, expectedUsd(first.input, first.out));

  // A second call re-reads the base prompt and everything returned so far.
  await recordUsage(id, args, "x".repeat(400));
  const second = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  assert.equal(second.calls, 2);
  assert.equal(second.out, written * 2);
  assert.equal(second.back, first.back + 100);
  assert.equal(second.input, 20000 + 20000 + first.back);
  assert.equal(second.first, first.first);
  assert.equal(second.usd, expectedUsd(second.input, second.out));
});

test("a returned image adds about 1600 tokens", async () => {
  const id = createDesign("Usage image", "story").id;
  const out = [
    { type: "text" as const, text: "x".repeat(400) },
    { type: "image" as const, data: "abc", mimeType: "image/png" },
  ] satisfies Content[];
  await recordUsage(id, {}, out);
  assert.equal((readUsage(id) as NonNullable<ReturnType<typeof readUsage>>).back, 100 + 1600);
});

test("a missing design records nothing and never throws", async () => {
  await recordUsage("no-such-design", {}, "ok");
  assert.equal(readUsage("no-such-design"), null);
});

test("forget removes the sidecar", async () => {
  const id = createDesign("Usage forget", "story").id;
  await recordUsage(id, {}, "ok");
  assert.ok(readUsage(id));
  forgetUsage(id);
  assert.equal(readUsage(id), null);
});

test("usage route answers {} without a record and serves it after", async () => {
  const id = createDesign("Usage route", "story").id;
  const usage = (): Promise<{ status: number; body: unknown }> =>
    reply((res) => usageRoute({} as IncomingMessage, res, id));
  assert.deepEqual((await usage()).body, {});
  await recordUsage(id, {}, "ok");
  assert.deepEqual((await usage()).body, readUsage(id));

  // The HTTP delete removes the sidecar too.
  assert.equal((await reply((res) => deleteRoute({} as IncomingMessage, res, id))).status, 200);
  assert.equal(readUsage(id), null);
  assert.deepEqual((await usage()).body, {});
});
