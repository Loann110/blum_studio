// One shared Playwright Chromium, lazily started, closed on exit.
// Playwright resolves its own pinned browser build, so the driver and the
// browser always match (no manual executable hunt needed).
// Chromium is NOT installed with the npm package: the first export or launch
// downloads it once (scripts/install-chromium.mjs), with a clear message.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { root } from "../paths.js";

let browser: Browser | null = null;
let starting: Promise<Browser> | null = null;

function executablePresent(): boolean {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

function installOnce(): void {
  console.error("[blum-studio] Chromium is missing: downloading it now (one-time download, about 170 MB)...");
  const res = spawnSync(process.execPath, [path.join(root(), "scripts", "install-chromium.mjs")], { stdio: "inherit" });
  if (res.status !== 0 || !executablePresent()) {
    throw new Error(
      "Chromium is missing and the download failed (offline?). Reconnect and retry the export, or run `node scripts/install-chromium.mjs` by hand.",
    );
  }
  console.error("[blum-studio] Chromium is ready.");
}

async function launch(): Promise<Browser> {
  if (!executablePresent()) installOnce();
  try {
    return await chromium.launch({ headless: true });
  } catch (e) {
    // The executable check above races a parallel download: retry once after
    // installing rather than failing on a half-present browser.
    if (!executablePresent() || /executable doesn.t exist/i.test((e as Error).message)) {
      installOnce();
      return chromium.launch({ headless: true });
    }
    throw e;
  }
}

export async function getOrLaunchBrowser(): Promise<Browser> {
  if (browser) return browser;
  if (!starting) {
    starting = launch().then(
      (b) => {
        browser = b;
        starting = null;
        return b;
      },
      (e) => {
        starting = null;
        throw e;
      },
    );
  }
  return starting;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

process.on("exit", () => {
  browser?.close().catch(() => {});
});
