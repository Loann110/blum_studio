// Start Blum Studio and open it in the default browser (any OS).
// Port: BLUM_PORT (default 8092). Set BLUM_NO_OPEN=1 to skip the browser.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Same default as server/paths.ts designsDir(): from a git clone keep designs
// next to the code, from an installed package use the user's folder.
export function defaultDesignsDir(pkgRoot) {
  if (process.env.BLUM_DESIGNS) return process.env.BLUM_DESIGNS;
  try {
    if (fs.existsSync(path.join(pkgRoot, ".git"))) return path.join(pkgRoot, "designs");
  } catch {
    // An unreadable root falls through to the user folder.
  }
  return path.join(os.homedir(), "BlumStudio", "designs");
}

export async function startStudio(pkgRoot = here) {
  const server = path.join(pkgRoot, "server", "dist", "server.js");
  if (!fs.existsSync(server)) {
    console.error("[blum-studio] Not set up yet: run `npm run setup` first.");
    process.exit(1);
  }

  // Chromium is not installed with the package: fetch it on first launch.
  spawnSync(process.execPath, [path.join(pkgRoot, "scripts", "install-chromium.mjs")], { stdio: "inherit" });

  // Example designs are read-only samples; copying never overwrites a file already there.
  const designs = defaultDesignsDir(pkgRoot);
  process.env.BLUM_DESIGNS = designs;
  fs.cpSync(path.join(pkgRoot, "examples"), designs, { recursive: true, force: false });

  const url = `http://127.0.0.1:${process.env.BLUM_PORT || "8092"}/`;
  const child = spawn(process.execPath, [server], { cwd: pkgRoot, stdio: "inherit", env: { ...process.env, BLUM_ROOT: pkgRoot } });
  console.log(`Blum Studio: ${url}  (editor: ${url}editor/). Ctrl+C stops it.`);

  if (!process.env.BLUM_NO_OPEN) {
    const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    // Opening the browser is a convenience: a missing opener must not stop the server.
    setTimeout(() => spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref(), 800);
  }

  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
  child.on("exit", (code) => process.exit(code ?? 0));
}

if (process.argv[1]?.endsWith("start.mjs")) {
  void startStudio();
}
