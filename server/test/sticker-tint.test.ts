// Sticker tint: the artwork renders in the tint colour (it used to be ignored).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { closeBrowser, getOrLaunchBrowser } from "../export/browser.js";
import { createDesignTool } from "../mcp/tools/designs.js";
import { applyOpsTool } from "../mcp/tools/ops.js";
import { exportPngTool } from "../mcp/tools/export.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("sticker-tint");
after(() => closeBrowser());

// Most common opaque colour inside a box of the PNG, as [r, g, b].
async function dominant(png: Buffer, box: [number, number, number, number]): Promise<number[]> {
  const page = await (await getOrLaunchBrowser()).newPage();
  try {
    return await page.evaluate(async ([b64, b]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d") as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0);
      const [x, y, w, h] = b as number[];
      const px = g.getImageData(x, y, w, h).data;
      const counts = new Map<string, number>();
      for (let i = 0; i < px.length; i += 4) {
        const k = `${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`;
        if (k !== "15,15,15") counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, z) => z[1] - a[1])[0]?.[0] ?? "15,15,15";
      return best.split(",").map((v) => Number(v) * 16);
    }, [png.toString("base64"), box] as const);
  } finally {
    await page.close();
  }
}

test("a tinted sticker renders in its tint", async () => {
  const made = JSON.parse(createDesignTool("Tint", "story")) as { id: string };
  const out = JSON.parse(await applyOpsTool(made.id, [{ op: "add", item: {
    id: "s", name: "s", type: "sticker", x: 540, y: 960, width: 600, height: 600,
    props: { sticker: "blum/pineapple.svg", tint: "#ff0000" },
  } }])) as { ok: boolean };
  assert.equal(out.ok, true);
  const got = JSON.parse(await exportPngTool(made.id)) as { path: string };
  const [r, g, b] = await dominant(fs.readFileSync(got.path), [240, 660, 600, 600]);
  assert.ok(r >= 224 && g <= 32 && b <= 32, `dominant colour ${r},${g},${b}`);
});
