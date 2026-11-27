// MCP errors: friendly tool messages surface, one JSON shape, topics ignore case.
import test from "node:test";
import assert from "node:assert/strict";
import { designId, designIds, operationsSchema } from "../mcp/schemas.js";
import { apiInfoTool, createDesignTool, styleGuideTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { previewTool } from "../mcp/tools/preview.js";
import { listResourcesTool } from "../mcp/tools/resources.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-errors");

test("friendly errors surface as one JSON shape", async () => {
  assert.equal(designId.safeParse("../../x").success, true);
  assert.equal(operationsSchema.safeParse([]).success, true);
  assert.equal(designIds.safeParse([]).success, true);
  const made = JSON.parse(createDesignTool("Err", "story")) as { id: string };
  const opsErr = (JSON.parse(await applyOpsTool(made.id, [])) as { error: string }).error;
  assert.ok(opsErr.includes("non-empty list"));
  const idErr = (JSON.parse(await applyOpsTool("../../x", [{ op: "remove", id: "x" }])) as { error: string }).error;
  assert.ok(idErr.includes("use the id from create_design"));
  const kindErr = (JSON.parse(listResourcesTool("emoji")) as { error: string }).error;
  assert.ok(kindErr.includes("unknown kind"));
  const previewErr = JSON.parse(await previewTool("no-such-id") as string) as { ok: boolean };
  assert.equal(previewErr.ok, false);
  const apiErr = JSON.parse(apiInfoTool("nope")) as { ok: boolean; error: string };
  assert.equal(apiErr.ok, false);
  assert.ok(apiErr.error.includes("items"));
  const styleErr = JSON.parse(styleGuideTool("nope")) as { ok: boolean; error: string };
  assert.equal(styleErr.ok, false);
  assert.ok(styleErr.error.includes("type"));
  assert.ok(apiInfoTool("ITEMS").length > 100 && !apiInfoTool("ITEMS").includes("Unknown"));
  assert.ok(styleGuideTool("TYPE").length > 100 && !JSON.stringify(styleGuideTool("TYPE")).includes("Unknown"));
  const photoErr = (JSON.parse(await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "p1", name: "P", type: "photo", x: 540, y: 900, width: 200, height: 200, props: { src: "/tmp/x.png" } },
  }])) as { error: string }).error;
  assert.ok(photoErr.includes("import_image") && photoErr.includes("media/"));
  const imageErr = (JSON.parse(await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "i1", name: "I", type: "image", x: 540, y: 900, width: 200, height: 200, props: { src: "C:\\pics\\x.png" } },
  }])) as { error: string }).error;
  assert.ok(imageErr.includes("import_image") && imageErr.includes("media/"));
  const fillErr = (JSON.parse(await applyOpsTool(made.id, [{
    op: "add",
    item: { id: "t1", name: "T", type: "text", x: 540, y: 900, width: 200, height: 200, props: { text: "Hi", textFill: "file:///tmp/x.png" } },
  }])) as { error: string }).error;
  assert.ok(fillErr.includes("import_image") && fillErr.includes("media/"));
  const bgErr = (JSON.parse(await applyOpsTool(made.id, [{
    op: "set_background", background: { kind: "image", image: "/tmp/bg.png" },
  }])) as { error: string }).error;
  assert.ok(bgErr.includes("import_image") && bgErr.includes("media/"));
});
