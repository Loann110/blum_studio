// Text measurement in the export page: canvas measureText over our fonts.
// Replaces blumcore.fit_text_size and the lint font cache.
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Page } from "playwright-core";
import { getOrLaunchBrowser } from "./browser.js";
import { guardRenderPage } from "./guard.js";
import { fontsDir, renderFontsCss } from "../paths.js";

function fileUrl(p: string): string {
  return "file:///" + p.replace(/\\/g, "/");
}

let page: Page | null = null;
let ready: Promise<Page> | null = null;

async function measurePage(): Promise<Page> {
  if (page) return page;
  if (!ready) {
    ready = (async () => {
      const browser = await getOrLaunchBrowser();
      const p = await browser.newPage();
      // Same font files as the export page, pointed at local files. A real
      // file:// page (not setContent): opaque origins cannot load file fonts.
      const css = fs.readFileSync(renderFontsCss(), "utf-8").split("/assets/fonts/").join(`${fileUrl(fontsDir())}/`);
      const file = path.join(tmpdir(), `blum-measure-${process.pid}.html`);
      fs.writeFileSync(
        file,
        `<!doctype html><html><head><style>${css}</style></head><body><canvas id="c"></canvas></body></html>`,
        "utf-8",
      );
      await guardRenderPage(p, file);
      await p.goto(fileUrl(file), { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready.then(() => {}));
      page = p;
      ready = null;
      return p;
    })();
  }
  return ready;
}

// Width of one line in design px, or null when the family is unknown.
export async function measureLine(
  text: string,
  font: string,
  size: number,
  weight: number,
  italic: boolean,
  letterSpacing: number,
): Promise<number | null> {
  if (!text || !(size > 0)) return 0;
  const p = await measurePage();
  return p.evaluate(
    async ([t, family, px, w, style, ls]) => {
      const canvas = document.getElementById("c") as unknown as {
        getContext(k: string): CanvasRenderingContext2D;
      };
      const ctx = canvas.getContext("2d");
      // Faces load only when used: load first, an empty result means an unknown family.
      try {
        const faces = await document.fonts.load(`${style} ${w} ${px}px "${family}"`, t);
        if (!faces.length) return null;
      } catch {
        return null;
      }
      ctx.font = `${style} ${w} ${px}px "${family}"`;
      try {
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
      } catch {
        // older engine: measure without tracking
      }
      return ctx.measureText(t).width;
    },
    [text, font, size, weight, italic ? "italic" : "normal", letterSpacing] as unknown as string,
  );
}

// Greedy word wrap at `maxWidth` (explicit newlines kept): line count and the
// widest line, or null when the family is unknown.
export async function wrapText(
  text: string,
  font: string,
  size: number,
  weight: number,
  italic: boolean,
  letterSpacing: number,
  maxWidth: number,
): Promise<{ lines: number; widest: number } | null> {
  if (!text || !(size > 0)) return { lines: 0, widest: 0 };
  const p = await measurePage();
  return p.evaluate(
    async ([t, family, px, w, style, ls, max]) => {
      const canvas = document.getElementById("c") as unknown as { getContext(k: string): CanvasRenderingContext2D };
      const ctx = canvas.getContext("2d");
      try {
        const faces = await document.fonts.load(`${style} ${w} ${px}px "${family}"`, t);
        if (!faces.length) return null;
      } catch {
        return null;
      }
      ctx.font = `${style} ${w} ${px}px "${family}"`;
      try {
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
      } catch {
        // older engine: measure without tracking
      }
      let lines = 0;
      let widest = 0;
      for (const para of t.split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const next = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(next).width > Number(max)) {
            widest = Math.max(widest, ctx.measureText(line).width);
            lines++;
            line = word;
          } else {
            line = next;
          }
        }
        widest = Math.max(widest, ctx.measureText(line).width);
        lines++;
      }
      return { lines, widest };
    },
    [text, font, size, weight, italic ? "italic" : "normal", letterSpacing, maxWidth] as unknown as string,
  );
}

// Largest size <= start whose single line fits max_width (same bisection as C++).
export async function fitTextSize(
  text: string,
  font: string,
  startSize: number,
  weight: number,
  style: string,
  letterSpacing: number,
  maxWidth: number,
): Promise<number | null> {
  if (!(startSize > 0) || !(maxWidth > 0)) return startSize;
  const italic = style === "italic";
  const full = await measureLine(text, font, startSize, weight, italic, letterSpacing);
  if (full === null) return null;
  if (full <= maxWidth) return startSize;
  let lo = 1;
  let hi = startSize;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const w = await measureLine(text, font, mid, weight, italic, letterSpacing);
    if (w === null) return hi;
    if (w <= maxWidth) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 2) / 2;
}
