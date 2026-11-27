// MCP check/resources: lint findings, scores, listings.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { checkDesignTool, polishScoreTool } from "../mcp/tools/check.js";
import { createDesignTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { listResourcesTool } from "../mcp/tools/resources.js";
import { useTempDesigns } from "./helpers.js";
import { closeBrowser } from "../export/browser.js";

useTempDesigns("mcp-check");
after(() => closeBrowser());

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

test("check reports findings and score", async () => {
  const made = JSON.parse(createDesignTool("Checked", "story")) as { id: string };
  const report = JSON.parse(await checkDesignTool(made.id)) as { findings: unknown[]; score: number };
  assert.deepEqual(new Set(Object.keys(report)), new Set(["findings", "score"]));
  assert.equal(typeof report.score, "number");
  assert.ok(err(await checkDesignTool("no-such-id")).includes("unknown design"));
});

test("polish score matches check", async () => {
  const made = JSON.parse(createDesignTool("Scored", "story")) as { id: string };
  await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "t1", name: "t1", type: "text", x: 540, y: 420, width: 900, height: 200, props: { text: "Hello", font: "Inter", size: 96, weight: 700, color: "#111111" } },
  }]);
  const score = JSON.parse(await polishScoreTool(made.id)) as { score: number; errors: number; warnings: number };
  const report = JSON.parse(await checkDesignTool(made.id)) as { findings: Array<{ level: string }>; score: number };
  assert.equal(score.score, report.score);
  assert.equal(score.errors, report.findings.filter((f) => f.level === "error").length);
  assert.equal(score.warnings, report.findings.filter((f) => f.level === "warn").length);
  assert.ok(err(await polishScoreTool("no-such-id")).includes("unknown design"));
});

test("resources kinds and bad kind", () => {
  for (const kind of ["fonts", "stickers", "photos", "masks", "categories"]) {
    assert.ok(Array.isArray(JSON.parse(listResourcesTool(kind))), kind);
  }
  assert.ok((JSON.parse(listResourcesTool("fonts")) as string[]).includes("Fraunces"));
  assert.ok((JSON.parse(listResourcesTool("stickers")) as Array<{ id: string }>).some((r) => r.id === "blum/pineapple.svg"));
  assert.ok((JSON.parse(listResourcesTool("masks")) as string[]).includes("rect"));
  assert.ok(err(listResourcesTool("sounds")).includes("fonts|"));
  assert.ok(err(listResourcesTool("palettes")).includes("fonts|"));
  assert.ok(err(listResourcesTool("fonts", 123)).includes("must be text"));
});

test("text overflow uses the real font and the wrap", async () => {
  const made = JSON.parse(createDesignTool("Wrap", "story")) as { id: string };
  const title = (id: string, height: number) => ({
    id, name: id, type: "text", x: 540, y: 900, width: 700, height,
    props: { text: "Plus fort chaque jour, dans ta salle", font: "Inter", size: 96, weight: 700, color: "#111111" },
  });
  await applyOpsTool(made.id, [{ op: "add", item: title("fits", 380) }]);
  let report = JSON.parse(await checkDesignTool(made.id)) as { findings: Array<{ check: string }> };
  assert.ok(!report.findings.some((f) => f.check === "text_overflow"), JSON.stringify(report));
  await applyOpsTool(made.id, [{ op: "update", id: "fits", patch: { height: 110 } }]);
  report = JSON.parse(await checkDesignTool(made.id)) as { findings: Array<{ check: string }> };
  assert.ok(report.findings.some((f) => f.check === "text_overflow"), JSON.stringify(report));
});

test("short box reports overflow when the width fits", async () => {
  const made = JSON.parse(createDesignTool("Short", "story")) as { id: string };
  await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "short", name: "short", type: "text", x: 540, y: 900, width: 900, height: 40, props: { text: "Hi", font: "Inter", size: 96, color: "#111111" } },
  }]);
  const report = JSON.parse(await checkDesignTool(made.id)) as { findings: Array<{ check: string; item: string }> };
  assert.ok(report.findings.some((f) => f.check === "text_overflow" && f.item === "short"), JSON.stringify(report));
});

test("notes alone keep the score at 100", async () => {
  const made = JSON.parse(createDesignTool("Notes", "story")) as { id: string };
  await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "empty", name: "empty", type: "text", x: 540, y: 900, width: 700, height: 200, props: { text: "", font: "Inter", size: 96, color: "#111111" } },
  }]);
  const report = JSON.parse(await checkDesignTool(made.id)) as { findings: Array<{ level: string }>; score: number };
  assert.ok(report.findings.length > 0 && report.findings.every((f) => f.level === "info"), JSON.stringify(report));
  assert.equal(report.score, 100);
  assert.equal((JSON.parse(await polishScoreTool(made.id)) as { score: number }).score, 100);
});
