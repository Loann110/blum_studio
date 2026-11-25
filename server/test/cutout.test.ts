// Background removal: the shared Chromium runs ui/cutout on a drawn subject.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeBrowser, getOrLaunchBrowser } from "../export/browser.js";
import { removeBackground } from "../export/cutout.js";
import { createDesignTool } from "../mcp/tools/designs.js";
import { importImageTool } from "../mcp/tools/media.js";
import { pngSize, useTempDesigns } from "./helpers.js";

useTempDesigns("cutout");
after(() => closeBrowser());

// A dark disc on a pale background: an easy salient subject.
async function drawnSubject(): Promise<Buffer> {
  const page = await (await getOrLaunchBrowser()).newPage();
  try {
    const url = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 300;
      const g = c.getContext("2d") as CanvasRenderingContext2D;
      g.fillStyle = "#f2efe8";
      g.fillRect(0, 0, 400, 300);
      g.fillStyle = "#c0392b";
      g.beginPath();
      g.arc(200, 150, 90, 0, Math.PI * 2);
      g.fill();
      return c.toDataURL("image/png");
    });
    return Buffer.from(url.split(",")[1], "base64");
  } finally {
    await page.close();
  }
}

// Alpha at (x, y) of a PNG, read back in the browser.
async function alphaAt(png: Buffer, points: Array<[number, number]>): Promise<number[]> {
  const page = await (await getOrLaunchBrowser()).newPage();
  try {
    return await page.evaluate(async ([b64, pts]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d") as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0);
      return (pts as Array<[number, number]>).map(([x, y]) => g.getImageData(x, y, 1, 1).data[3]);
    }, [png.toString("base64"), points] as const);
  } finally {
    await page.close();
  }
}

test("removeBackground keeps the subject and clears the background", async () => {
  const out = await removeBackground(await drawnSubject());
  assert.deepEqual(pngSize(out), [400, 300]);
  const [centre, corner] = await alphaAt(out, [[200, 150], [10, 10]]);
  assert.ok(centre > 200, `subject alpha ${centre}`);
  assert.ok(corner < 60, `background alpha ${corner}`);
});

test("import_image remove_background stores a cut-out PNG", async () => {
  const made = JSON.parse(createDesignTool("Cutout", "story")) as { id: string };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "blum-cutout-")), "disc.png");
  fs.writeFileSync(file, await drawnSubject());
  const got = JSON.parse(await importImageTool(made.id, file, "disc", true)) as { src: string; path: string };
  assert.match(got.src, /^media\/.*disc-cutout\.png$/);
  assert.deepEqual(pngSize(fs.readFileSync(got.path)), [400, 300]);
});
