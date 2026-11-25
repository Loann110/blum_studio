// Background removal for the MCP: runs ui/cutout (the editor's own code) in
// the shared Chromium. The page has no server, so a private origin is
// answered from disk by page.route.
import fs from "node:fs";
import path from "node:path";
import { getOrLaunchBrowser } from "./browser.js";
import { assetsDir, uiDir } from "../paths.js";

const ORIGIN = "http://blum-cutout.local";

const FILES: Record<string, () => string> = {
  "/js/cutout.js": () => path.join(uiDir(), "dist", "cutout.js"),
  "/js/ort/ort.wasm.min.mjs": () => path.join(uiDir(), "dist", "ort", "ort.wasm.min.mjs"),
  "/js/ort/ort-wasm-simd-threaded.mjs": () => path.join(uiDir(), "dist", "ort", "ort-wasm-simd-threaded.mjs"),
  "/js/ort/ort-wasm-simd-threaded.wasm": () => path.join(uiDir(), "dist", "ort", "ort-wasm-simd-threaded.wasm"),
  "/assets/models/u2netp.onnx": () => path.join(assetsDir(), "models", "u2netp.onnx"),
};

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
};

/** PNG bytes of `image` with its background made transparent. */
export async function removeBackground(image: Buffer): Promise<Buffer> {
  const browser = await getOrLaunchBrowser();
  const page = await browser.newPage();
  try {
    await page.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: '<!doctype html><script src="/js/cutout.js"></script>' });
      } else if (url.pathname === "/input") {
        await route.fulfill({ contentType: "application/octet-stream", body: image });
      } else if (FILES[url.pathname]) {
        const file = FILES[url.pathname]();
        if (!fs.existsSync(file)) {
          await route.fulfill({ status: 404, body: "missing (run npm run build in ui/)" });
          return;
        }
        await route.fulfill({ contentType: TYPES[path.extname(file)] ?? "application/octet-stream", body: fs.readFileSync(file) });
      } else {
        await route.fulfill({ status: 404, body: "" });
      }
    });
    await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
    const dataUrl = await page.evaluate(async () => {
      const g = globalThis as unknown as { BlumCutout: { removeBackground(src: string): Promise<string> } };
      return g.BlumCutout.removeBackground("/input");
    });
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  } finally {
    await page.close().catch(() => {});
  }
}
