// Project paths: every directory the server reads or writes, in one place.
// Functions (not constants) so tests can point BLUM_DESIGNS at a temp dir.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function root(): string {
  return path.resolve(process.env.BLUM_ROOT ?? process.cwd());
}
// The user's .env sits next to the designs folder: the repo root for a clone
// (git-ignored), ~/BlumStudio/.env for an installed package, which an update
// would wipe if it lived in the package dir.
export function envFile(): string {
  return path.join(path.dirname(designsDir()), ".env");
}
// Keys like PEXELS_API_KEY come from .env (Settings writes them there);
// variables already set in the shell win, and a missing file changes nothing.
export function loadDotEnv(): void {
  if (typeof process.loadEnvFile !== "function") return; // Node < 20.12
  try {
    process.loadEnvFile(envFile());
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
// From a git clone keep designs next to the code; from an installed package
// (no .git) the package dir is wiped on every update, so keep them in the
// user's folder instead. BLUM_DESIGNS overrides both.
export function designsDir(): string {
  const override = process.env.BLUM_DESIGNS;
  if (override) return override;
  try {
    if (fs.existsSync(path.join(root(), ".git"))) return path.join(root(), "designs");
  } catch {
    // An unreadable root falls through to the user folder.
  }
  return path.join(os.homedir(), "BlumStudio", "designs");
}
export function mediaDir(): string {
  return path.join(designsDir(), "media");
}
export function assetsDir(): string {
  return process.env.BLUM_ASSETS ?? path.join(root(), "assets");
}
export function uiDir(): string {
  return path.join(root(), "ui");
}

export function renderBundle(): string {
  return path.join(uiDir(), "dist", "render.bundle.js");
}
export function renderCss(): string {
  return path.join(uiDir(), "render", "render.css");
}
export function renderFontsCss(): string {
  return path.join(uiDir(), "render", "fonts.css");
}
export function fontsDir(): string {
  return path.join(assetsDir(), "fonts");
}
export function stickersDir(): string {
  return path.join(assetsDir(), "stickers");
}
export function designRulesFile(): string {
  return path.join(assetsDir(), "design-rules.json");
}
export function photosFile(): string {
  return path.join(assetsDir(), "photos.json");
}
