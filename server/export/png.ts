// Export: design JSON -> PNG via the shared renderer screenshotted in
// Chromium. The HTML embeds the same render bundle and CSS the gallery
// uses, so the editor, the gallery and the PNG show the same pixels.
import fs from "node:fs";
import path from "node:path";
import { pageOf } from "../../ui/engine/index.js";
import { getOrLaunchBrowser } from "./browser.js";
import { assetsDir, designsDir, fontsDir, mediaDir, renderBundle, renderCss, renderFontsCss } from "../paths.js";
import { designPath, getDesign, tmpFile, type Design } from "../store.js";

export function fileUrl(p: string): string {
  return "file:///" + path.resolve(p).replace(/\\/g, "/");
}

export function fontsCssFileUrls(): string {
  const css = fs.readFileSync(renderFontsCss(), "utf-8");
  return css.split("/assets/fonts/").join(`${fileUrl(fontsDir())}/`);
}

// Standalone page drawing one design at its page size (wrapWidthPx overrides
// the box width in CSS px: the PDF export lays out at paper size).
export function renderHtml(design: Design, wrapWidthPx?: number): string {
  const d = design as unknown as { format?: string; width?: number; height?: number };
  const { width } = pageOf(d.format ?? "story", d.width, d.height);
  const box = wrapWidthPx ?? width;
  const bundle = fs.readFileSync(renderBundle(), "utf-8");
  const css = fs.readFileSync(renderCss(), "utf-8");
  const fonts = fontsCssFileUrls();
  const payload = JSON.stringify(design).replace(/<\//g, "<\\/");
  const assetsBase = fileUrl(assetsDir());
  const mediaBase = fileUrl(mediaDir());
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>${fonts}</style>
<style>html,body{margin:0;padding:0;background:#fff;}#wrap{width:${box}px;}</style>
<style>${css}</style>
</head><body><div id="wrap"><div id="stage"></div></div>
<script>${bundle}</script>
<script>
var design = ${payload};
var html = BlumRender.renderDesign(design, {assetsBase: ${JSON.stringify(assetsBase)}, mediaBase: ${JSON.stringify(mediaBase)}});
// Safe: the payload escapes </script, and renderDesign escapes every design string.
document.getElementById('stage').innerHTML = html;
</script></body></html>`;
}

async function screenshotDesign(design: Design, target: string | null, waitMs: number): Promise<string> {
  const d = design as unknown as { format?: string; width?: number; height?: number };
  const page2 = pageOf(d.format ?? "story", d.width, d.height);
  const { width, height } = page2;
  const out = target ?? tmpFile(".png");
  const html = renderHtml(design);
  const pageFile = tmpFile(".html");
  fs.writeFileSync(pageFile, html, "utf-8");
  const browser = await getOrLaunchBrowser();
  // Print pages lay out at 150 design px/inch: capture at 2x = 300 dpi.
  const deviceScaleFactor = page2.kind === "print" ? 2 : 1;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor });
  try {
    await page.goto(fileUrl(pageFile), { waitUntil: "load" });
    // Web fonts shift glyphs after load: wait for them before the shot
    // so exports and text measurement share the same font state.
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(waitMs);
    await page.locator("#stage .blum-stage").screenshot({ path: out });
  } finally {
    await page.close().catch(() => {});
    try {
      fs.unlinkSync(pageFile);
    } catch {
      // temp page stays; the OS temp dir is not part of the product
    }
  }
  return out;
}

// Render a design to PNG at its page size (print: 2x = 300 dpi).
export async function exportPng(id: string, out?: string | null): Promise<string> {
  const design = getDesign(id);
  const target = out ?? path.join(designsDir(), `${id}.png`);
  return screenshotDesign(design, target, 1200);
}

// Screenshot one design dict.
export async function exportPngDesign(design: Design, out?: string | null): Promise<string> {
  return screenshotDesign(design, out ?? null, 1200);
}

export { designPath };
