// Export: design JSON -> PDF via the shared renderer printed in Chromium.
// Text stays vector (selectable) and fonts embed; the paper matches the
// page exactly (print sizes in mm, screen sizes in px at 96 dpi).
import fs from "node:fs";
import path from "node:path";
import { pageOf } from "../../ui/engine/index.js";
import { fileUrl, renderHtml } from "./png.js";
import { getDesign, tmpFile } from "../store.js";
import { getOrLaunchBrowser } from "./browser.js";
import { designsDir } from "../paths.js";

// Paper size for page.pdf(): print formats use their exact mm size so the
// PDF page is e.g. 148x210 mm for A5; screen pages map px at 96 dpi.
export function paperSize(design: { format?: string; width?: number; height?: number }): { width: string; height: string } {
  const page = pageOf(design.format ?? "story", design.width, design.height);
  if (page.kind === "print" && page.mm) {
    return { width: `${page.mm[0]}mm`, height: `${page.mm[1]}mm` };
  }
  return { width: `${page.width / 96}in`, height: `${page.height / 96}in` };
}

// CSS px width the page lays out at: the paper width, so the design fills
// exactly one page. Print rounds design px from mm, which can overshoot the
// paper by a fraction of a px (a blank second page): 1 px narrower avoids it.
export function layoutWidthPx(design: { format?: string; width?: number; height?: number }): number {
  const page = pageOf(design.format ?? "story", design.width, design.height);
  if (page.kind === "print" && page.mm) {
    return Math.max(1, Math.floor((page.mm[0] * 96) / 25.4) - 1);
  }
  return page.width;
}

export async function exportPdf(id: string, out?: string | null): Promise<string> {
  const design = getDesign(id) as unknown as { format?: string; width?: number; height?: number };
  const target = out ?? path.join(designsDir(), `${id}.pdf`);
  const page = pageOf(design.format ?? "story", design.width, design.height);
  const cssW = layoutWidthPx(design);
  const cssH = Math.ceil((cssW * page.height) / page.width);
  const html = renderHtml(design as never, cssW);
  const pageFile = tmpFile(".html");
  fs.writeFileSync(pageFile, html, "utf-8");
  const paper = paperSize(design);
  const browser = await getOrLaunchBrowser();
  const pg = await browser.newPage({ viewport: { width: cssW, height: cssH } });
  try {
    await pg.goto(fileUrl(pageFile), { waitUntil: "load" });
    await pg.waitForTimeout(900);
    await pg.pdf({
      path: target,
      width: paper.width,
      height: paper.height,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await pg.close().catch(() => {});
    try {
      fs.unlinkSync(pageFile);
    } catch {
      // temp page stays; the OS temp dir is not part of the product
    }
  }
  return target;
}
