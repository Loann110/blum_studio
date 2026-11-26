// Store: designs as JSON files, images in media/. Atomic writes, magic-byte checks.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDesign } from "../ui/engine/index.js";
import { CUSTOM_MAX, CUSTOM_MIN, FORMATS, findFormat, validCustom } from "../ui/engine/index.js";
import { assetsDir, designsDir, mediaDir } from "./paths.js";
import { studioVersion } from "./version.js";

export type Design = Record<string, unknown>;

// Thrown for unknown ids (404); validation failures are InvalidDesign (400);
// anything else (unreadable or unwritable disk) propagates to the 500 handler.
export class UnknownDesign extends Error {}

export class InvalidDesign extends Error {}

// One promise chain per design: concurrent writers never interleave.
const chains = new Map<string, Promise<unknown>>();
export function withDesignLock<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = chains.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn) as Promise<T>;
  chains.set(id, next.catch(() => {}));
  return next;
}

/* ---- magic bytes ---- */

const MAGIC: Array<[Buffer, string]> = [
  [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ".png"],
  [Buffer.from([0xff, 0xd8, 0xff]), ".jpg"],
  [Buffer.from("RIFF"), ".webp"],
  [Buffer.from("GIF87a"), ".gif"],
  [Buffer.from("GIF89a"), ".gif"],
];

export function sniffImage(data: Buffer): string | null {
  for (const [magic, ext] of MAGIC) {
    if (data.subarray(0, magic.length).equals(magic)) {
      if (ext === ".webp" && data.subarray(8, 12).toString() !== "WEBP") continue;
      return ext;
    }
  }
  const head = data.subarray(0, 512).toString("latin1").replace(/^[\s\0]+/, "");
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && data.subarray(0, 2048).includes("<svg"))) {
    return ".svg";
  }
  return null;
}

/* ---- ids ---- */

export function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
  // example-* ids are the shipped templates: a design named "Example ..." must not pose as one.
  return /^example(-|$)/.test(slug) ? `design-${slug}` : slug;
}

/* ---- atomic write ---- */

// Windows refuses to open a file while a rename replaces it: retry briefly
// so a read racing a save (editor poll, MCP read) does not fail.
export function readStable(file: string): string {
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      return fs.readFileSync(file, "utf-8");
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e;
      last = e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  throw last;
}

// Rapid successive saves can collide with a scan holding the destination:
// retry briefly instead of failing the request.
function replaceAtomicallySync(tmp: string, target: string): void {
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      fs.renameSync(tmp, target);
      return;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== "EPERM") throw e;
      last = e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw last;
}

async function replaceAtomically(tmp: string, target: string): Promise<void> {
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      await fs.promises.rename(tmp, target);
      return;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== "EPERM") throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw last;
}

/* ---- designs ---- */

export function blankDesign(name: string, format = "story", width?: number, height?: number): Design {
  if (format === "custom") {
    if (!validCustom(width, height)) {
      throw new InvalidDesign(`custom format needs width and height between ${CUSTOM_MIN} and ${CUSTOM_MAX} px`);
    }
    return {
      version: 1,
      name,
      format,
      width: Math.round(width as number),
      height: Math.round(height as number),
      background: { kind: "color", color: "#ffffff" },
      items: [],
    };
  }
  if (!findFormat(format)) throw new InvalidDesign(`format must be one of ${FORMATS.map((f) => f.id).join("|")}|custom`);
  return {
    version: 1,
    name,
    format,
    background: { kind: "color", color: "#ffffff" },
    items: [],
  };
}

export function designPath(id: string): string {
  return path.join(designsDir(), `${id}.json`);
}

export function isTemplateId(id: string): boolean {
  return id.startsWith("example-");
}

export function createDesign(name: string, format = "story", width?: number, height?: number): { id: string; design: Design } {
  const id = `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;
  const design = blankDesign(name, format, width, height);
  saveDesign(id, design);
  return { id, design };
}

export function getDesign(id: string): Design {
  const file = designPath(id);
  if (!fs.existsSync(file)) throw new UnknownDesign(`unknown design '${id}'`);
  const design = JSON.parse(readStable(file)) as Design;
  const problems = validateDesign(design);
  if (problems.length) throw new Error(`design '${id}' is invalid: ${problems[0]}`);
  return design;
}

export function saveDesign(id: string, design: Design): void {
  const problems = validateDesign(design);
  if (problems.length) throw new InvalidDesign(`invalid design: ${problems[0]}`);
  fs.mkdirSync(designsDir(), { recursive: true });
  const tmp = path.join(designsDir(), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(design, null, 2), "utf-8");
    replaceAtomicallySync(tmp, designPath(id));
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // the temp file stays; it is namespaced and ignored by list_designs
    }
    throw e;
  }
}

export function deleteDesign(id: string): void {
  const file = designPath(id);
  if (!fs.existsSync(file)) throw new UnknownDesign(`unknown design '${id}'`);
  fs.unlinkSync(file);
}

export function duplicateDesign(id: string, name?: string | null): { id: string; design: Design } {
  if (!fs.existsSync(designPath(id))) throw new UnknownDesign(`unknown design '${id}'`);
  const design = JSON.parse(JSON.stringify(getDesign(id))) as Design;
  const base = String(name ?? `${String(design.name ?? id)} copy`).trim();
  design.name = base || "Untitled";
  const fresh = `${slugify(String(design.name))}-${crypto.randomBytes(3).toString("hex")}`;
  saveDesign(fresh, design);
  return { id: fresh, design };
}

export interface DesignRow {
  id: string;
  name: unknown;
  format: unknown;
  width?: unknown;
  height?: unknown;
  items: number;
  updated: number;
  template: boolean;
}

export function listDesigns(): DesignRow[] {
  if (!fs.existsSync(designsDir())) return [];
  const out: DesignRow[] = [];
  for (const file of fs.readdirSync(designsDir())) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(designsDir(), file);
    try {
      const design = JSON.parse(readStable(full)) as Record<string, unknown>;
      if (!design || typeof design !== "object") continue;
      const items = design.items;
      out.push({
        id: path.basename(file, ".json"),
        name: design.name ?? path.basename(file, ".json"),
        format: design.format ?? "story",
        width: design.width,
        height: design.height,
        items: Array.isArray(items) ? items.length : 0,
        updated: fs.statSync(full).mtimeMs / 1000,
        template: isTemplateId(path.basename(file, ".json")),
      });
    } catch {
      continue; // corrupt files are skipped, never listed
    }
  }
  out.sort((a, b) => b.updated - a.updated);
  return out;
}

/* ---- media ---- */

export async function downloadImage(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": `blum-studio/${studioVersion()}` }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export function designMtimeMs(id: string): number {
  return fs.statSync(designPath(id)).mtimeMs / 1000;
}

export async function importImage(id: string, data: Buffer, filename: string): Promise<{ src: string; path: string }> {
  if (!fs.existsSync(designPath(id))) throw new UnknownDesign(`unknown design '${id}'`);
  const ext = sniffImage(data);
  if (!ext) throw new Error("not a PNG, JPEG, WebP, GIF or SVG image");
  if (data.length > 25_000_000) throw new Error("image is larger than 25 MB");
  fs.mkdirSync(mediaDir(), { recursive: true });
  const stem = path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  let target = path.join(mediaDir(), `${id}-${stem}${ext}`);
  for (let i = 2; i < 1000 && fs.existsSync(target); i++) {
    target = path.join(mediaDir(), `${id}-${stem}-${i}${ext}`);
  }
  const tmp = path.join(mediaDir(), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    await fs.promises.writeFile(tmp, data);
    await replaceAtomically(tmp, target);
  } catch (e) {
    try {
      await fs.promises.unlink(tmp);
    } catch {
      // same namespaced-temp rule as designs
    }
    throw e;
  }
  return { src: `media/${path.basename(target)}`, path: target };
}

export { assetsDir };

export function tmpFile(suffix: string): string {
  return path.join(os.tmpdir(), `blum-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
}
