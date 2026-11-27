// Usage: per-design agent estimates recorded by MCP, served over HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { deleteRoute, usageRoute } from "../routes/designs.js";
import { createDesign } from "../store.js";
import fs from "node:fs";
import path from "node:path";
import { designsDir } from "../paths.js";
import { newSession, saveSession } from "../sessions.js";
import { calibration, forgetUsage, measuredUsage, readUsage, recordUsage } from "../usage.js";
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

// Context re-read at the cache price, returned tokens written to it once.
function expectedUsd(input: number, back: number, out: number): number {
  return (input * 0.3 + back * 3.75 + out * 15) / 1e6;
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
  assert.equal(first.usd, expectedUsd(first.input, first.back, first.out));
  assert.equal(first.active, 0);

  // A second call re-reads the base prompt and everything returned so far.
  await recordUsage(id, args, "x".repeat(400));
  const second = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  assert.equal(second.calls, 2);
  assert.equal(second.out, written * 2);
  assert.equal(second.back, first.back + 100);
  assert.equal(second.input, 20000 + 20000 + first.back);
  assert.equal(second.first, first.first);
  assert.equal(second.usd, expectedUsd(second.input, second.back, second.out));
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
  assert.deepEqual((await usage()).body, { ...readUsage(id), measured: null, calibration: { factor: 1, samples: 0 } });

  // The HTTP delete removes the sidecar too.
  assert.equal((await reply((res) => deleteRoute({} as IncomingMessage, res, id))).status, 200);
  assert.equal(readUsage(id), null);
  assert.deepEqual((await usage()).body, {});
});

function sidecar(id: string): string {
  return path.join(designsDir(), ".usage", `${id}.json`);
}

test("a pause between two calls counts five minutes at most", async () => {
  const id = createDesign("Usage pause", "story").id;
  await recordUsage(id, {}, "ok");
  const record = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  // The agent came back an hour later.
  fs.writeFileSync(sidecar(id), JSON.stringify({ ...record, last: record.last - 3600 }), "utf-8");
  await recordUsage(id, {}, "ok");
  const after = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  assert.equal(after.active, 300);
});

test("records written before active time read their whole span", () => {
  const id = createDesign("Usage legacy", "story").id;
  fs.mkdirSync(path.dirname(sidecar(id)), { recursive: true });
  fs.writeFileSync(sidecar(id), JSON.stringify({ calls: 2, first: 100, last: 160, out: 1, back: 1, input: 1, usd: 0.1 }), "utf-8");
  const legacy = readUsage(id) as NonNullable<ReturnType<typeof readUsage>>;
  assert.equal(legacy.active, 60);
  // The stored price of an old formula is ignored: one formula for every record.
  assert.equal(legacy.usd, expectedUsd(1, 1, 1));
});

test("console runs give measured figures and calibrate the estimate", async () => {
  const id = createDesign("Usage measured", "story").id;
  await recordUsage(id, {}, "ok");
  const estimate = (readUsage(id) as NonNullable<ReturnType<typeof readUsage>>).usd;
  const session = newSession("Measured", "claude-code", "story");
  session.designIds.push(id);
  session.transcript.push({ time: 1, kind: "done", usage: { tokens: 200000, cached: 180000, costUsd: 0.3, ms: 45000, turns: 11 } });
  saveSession(session);

  assert.deepEqual(measuredUsage(id), { tokens: 200000, cached: 180000, costUsd: 0.3, ms: 45000, runs: 1, designs: 1 });
  const cal = calibration();
  assert.equal(cal.samples, 1);
  assert.equal(cal.factor, 0.3 / estimate);
  const body = (await reply((res) => usageRoute({} as IncomingMessage, res, id))).body as { measured: unknown };
  assert.deepEqual(body.measured, measuredUsage(id));
});
