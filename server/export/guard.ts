// Render guard: Chromium may only load our files, data: and public http(s).
import path from "node:path";
import type { Page } from "playwright-core";
import { resolvePublicAddresses } from "../download.js";
import { assetsDir, mediaDir } from "../paths.js";

function inside(file: string, dir: string): boolean {
  return file === dir || file.startsWith(dir + path.sep);
}

function filePath(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "file:") return null;
  if (u.host !== "" && u.host !== "localhost") return null;
  let p: string;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  return path.resolve(p);
}

// Our fonts, textures, stickers and media: anything else stays out.
export function isAllowedFileUrl(url: string): boolean {
  const p = filePath(url);
  if (!p) return false;
  return inside(p, path.resolve(assetsDir())) || inside(p, path.resolve(mediaDir()));
}

export async function guardRenderPage(page: Page, allowedFile?: string): Promise<void> {
  const assets = path.resolve(assetsDir());
  const media = path.resolve(mediaDir());
  const extra = allowedFile ? path.resolve(allowedFile) : null;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("data:")) {
      await route.continue();
      return;
    }
    if (url.startsWith("file:")) {
      const p = filePath(url);
      if (p && (inside(p, assets) || inside(p, media) || (extra !== null && p === extra))) {
        await route.continue();
      } else {
        await route.abort();
      }
      return;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        await resolvePublicAddresses(new URL(url).hostname);
        await route.continue();
      } catch {
        await route.abort();
      }
      return;
    }
    await route.abort();
  });
}
