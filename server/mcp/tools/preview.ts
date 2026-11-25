// Preview: PNG images the client can look at, single and board.
import fs from "node:fs";
import { getOrLaunchBrowser } from "../../export/browser.js";
import { fileUrl, renderHtml } from "../../export/png.js";
import { tmpFile, type Design } from "../../store.js";
import { pageOf } from "../../../ui/engine/index.js";
import { loadDesign, toolError, type Content } from "../trust.js";

const png = (data: string): Content => ({ type: "image", data, mimeType: "image/png" });

// Base64 PNG of a design dict at `width` px (region crops first).
export async function previewPng(design: Design, width: number, region: unknown): Promise<string> {
  const d = design as unknown as { format?: string; width?: number; height?: number };
  const size = pageOf(d.format ?? "story", d.width, d.height);
  const browser = await getOrLaunchBrowser();
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const pageFile = tmpFile(".html");
  fs.writeFileSync(pageFile, renderHtml(design), "utf-8");
  try {
    await page.goto(fileUrl(pageFile), { waitUntil: "load" });
    await page.waitForTimeout(900);
    const shot = await page.locator("#stage .blum-stage").screenshot();
    const b64 = (shot as Buffer).toString("base64");
    const run = (page.evaluate as unknown as (
      fn: (arg: [string, number, unknown, number]) => Promise<string>,
      arg: [string, number, unknown, number],
    ) => Promise<string>).bind(page);
    return await run(
      ([img64, want, box, designWidth]) => {
        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            let sx = 0;
            let sy = 0;
            let sw = img.width;
            let sh = img.height;
            if (Array.isArray(box)) {
              try {
                const nums = (box as unknown[]).slice(0, 4).map(Number);
                if (nums.every((n) => Number.isFinite(n))) {
                  const k = img.width / designWidth;
                  sx = Math.max(0, nums[0] * k);
                  sy = Math.max(0, nums[1] * k);
                  sw = Math.min(img.width - sx, nums[2] * k);
                  sh = Math.min(img.height - sy, nums[3] * k);
                }
              } catch {
                // a bad region falls back to the whole stage
              }
            }
            const w = Math.max(64, want);
            const scale = Math.min(1, w / sw, 4096 / sh);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(sw * scale));
            canvas.height = Math.max(1, Math.round(sh * scale));
            const ctx = canvas.getContext("2d") as unknown as { drawImage(i: unknown, a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number): void };
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png").split(",", 2)[1]);
          };
          img.onerror = () => reject(new Error("could not decode the preview"));
          img.src = `data:image/png;base64,${img64}`;
        });
      },
      [b64, width, Array.isArray(region) ? region : null, size.width],
    );
  } finally {
    await page.close().catch(() => {});
    try {
      fs.unlinkSync(pageFile);
    } catch {
      // temp page stays; the OS temp dir is not part of the product
    }
  }
}

export async function previewTool(id: unknown, width: unknown = 400, region: unknown = null): Promise<string | Content[]> {
  const { design, err } = loadDesign(id);
  if (err) {
    try {
      return "error: " + (JSON.parse(err) as { error: string }).error;
    } catch {
      return "error: unknown design";
    }
  }
  let want = 400;
  try {
    want = Number(width);
    if (!Number.isFinite(want)) want = 400;
  } catch {
    want = 400;
  }
  want = Math.max(64, Math.min(1080, Math.trunc(want)));
  try {
    return [png(await previewPng(design as Design, want, Array.isArray(region) ? region : null))];
  } catch (e) {
    return `error: preview failed: ${(e as Error).message} (need Chromium? it should be in %LOCALAPPDATA%\\ms-playwright)`;
  }
}

export async function previewBoardTool(ids: unknown, width: unknown = 135): Promise<string | Content[]> {
  if (!Array.isArray(ids) || !ids.length) {
    return toolError("design_ids must be a non-empty list of design ids (at most 12)");
  }
  if (ids.length > 12) {
    return toolError(`preview_board takes at most 12 designs, got ${ids.length} (split the board)`);
  }
  let want = 135;
  try {
    want = Number(width);
    if (!Number.isFinite(want)) want = 135;
  } catch {
    want = 135;
  }
  want = Math.max(64, Math.min(270, Math.trunc(want)));
  const rows: unknown[] = [];
  const images: Content[] = [];
  for (const raw of ids) {
    const { design, err } = loadDesign(raw);
    if (err) {
      rows.push({ id: String(raw).slice(0, 80), error: (JSON.parse(err) as { error: string }).error });
      continue;
    }
    try {
      const shot = await previewPng(design as Design, want, null);
      rows.push({
        id: raw,
        name: (design as Record<string, unknown>).name ?? "",
        format: (design as Record<string, unknown>).format ?? "story",
        image: images.length + 1,
      });
      images.push(png(shot));
    } catch (e) {
      rows.push({ id: raw, error: `preview failed: ${(e as Error).message}` });
    }
  }
  return [{ type: "text", text: JSON.stringify(rows) }, ...images];
}
