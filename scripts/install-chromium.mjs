// Ensure the Playwright Chromium used for exports is installed.
// A no-op when the browser is already there; otherwise downloads it once.
// Run at studio launch and before the first export, with a clear message.
// Usage: node scripts/install-chromium.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The published package carries playwright-core as a dependency; a git clone
// only has it under ui/. Try the package root first, then the ui folder.
// (The cli.js subpath is not in the exports map, so resolve it through the
// package.json next door.)
function resolvePlaywright() {
  for (const base of [path.join(pkgRoot, "package.json"), path.join(pkgRoot, "ui", "package.json")]) {
    try {
      const require = createRequire(base);
      const pkgFile = require.resolve("playwright-core/package.json");
      const core = require("playwright-core");
      if (typeof core?.chromium?.executablePath !== "function") continue;
      return { cli: path.join(path.dirname(pkgFile), "cli.js"), core };
    } catch {
      // No usable playwright-core next to this base: try the next one.
    }
  }
  return null;
}

const found = resolvePlaywright();
if (!found) {
  console.error("[blum-studio] playwright-core is not installed: run `npm run setup` first.");
  process.exit(1);
}

let exe = null;
try {
  exe = found.core.chromium.executablePath();
} catch {
  // The driver cannot tell where the browser should be: install it.
}
if (exe && fs.existsSync(exe)) {
  console.log(`[blum-studio] Chromium is ready (${exe}).`);
  process.exit(0);
}

console.error("[blum-studio] Chromium is missing: downloading it now (one-time download, about 170 MB)...");
const res = spawnSync(process.execPath, [found.cli, "install", "--only-shell", "chromium"], { stdio: "inherit" });
if (res.status !== 0) {
  console.error("[blum-studio] Chromium download failed (offline?). Retry with a connection.");
  process.exit(1);
}
console.log("[blum-studio] Chromium installed.");
