// Store: designs as JSON files, images in media/. Atomic writes, magic-byte checks.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDesign } from "../ui/engine/index.js";
import { CUSTOM_MAX, CUSTOM_MIN, FORMATS, findFormat, validCustom } from "../ui/engine/index.js";
import { MAX_IMAGE_BYTES, downloadImage } from "./download.js";
import { assetsDir, designsDir, mediaDir } from "./paths.js";

export type Design = Record<string, unknown>;

// Thrown for unknown ids (404); validation failures are InvalidDesign (400);
// anything else (unreadable or unwritable disk) propagates to the 500 handler.
export class UnknownDesign extends Error {}

export class InvalidDesign extends Error {}

// One promise chain per design: concurrent writers never interleave.
const chains = new Map<string, Promise<unknown>>();
export function withDesignLock<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = chains.get(id) ?? Promise.resolve();
  const next = prev.then(
    () => withFileLock(id, fn),
    () => withFileLock(id, fn),
  ) as Promise<T>;
  chains.set(id, next.catch(() => {}));
  return next;
}

/* ---- inter-process lock ---- */

// The chain above orders writers inside one process, but the HTTP server and
// every MCP process write the same files: a <id>.lock file next to the
// design, held for the whole read-modify-write, orders the rest.
const LOCK_WAIT_MS = 30000;
const LOCK_STALE_MS = 10000;
const LOCK_LIVE_STALE_MS = 60000;

function lockPath(id: string): string {
  // Raw ids from HTTP URLs must not walk out of designs/.
  const safe = [...id].map((c) => (/[A-Za-z0-9_-]/.test(c) ? c : "-")).join("");
  return path.join(designsDir(), `${safe}.lock`);
}

function pidAlive(pid: unknown): boolean {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM is a live process owned by someone else; anything else is gone.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

interface LockClaim {
  pid: number;
  at: number;
  nonce: string;
}

function readClaim(file: string): { claim: LockClaim | null; mtime: number } {
  let raw = "";
  let mtime = 0;
  try {
    raw = fs.readFileSync(file, "utf-8");
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return { claim: null, mtime: 0 }; // gone mid-read: the next create wins
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LockClaim>;
    if (typeof parsed.pid === "number" && typeof parsed.at === "number" && typeof parsed.nonce === "string") {
      return { claim: parsed as LockClaim, mtime };
    }
  } catch {
    // torn by a crash mid-write: only its age can judge it
  }
  return { claim: null, mtime };
}

// Exclusive-create the lock. A delete racing our create surfaces as
// EPERM/EACCES/EBUSY on Windows instead of EEXIST, so retry those briefly
// like readStable does; a held lock answers at once.
async function claimLock(file: string, mineRaw: string): Promise<boolean> {
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      fs.writeFileSync(file, mineRaw, { flag: "wx" });
      return true;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EEXIST") return false;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  // Still racing after 200 ms with a lock file on disk: wait it out above.
  if (fs.existsSync(file)) return false;
  throw last;
}

async function withFileLock<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const file = lockPath(id);
  fs.mkdirSync(designsDir(), { recursive: true });
  const mine: LockClaim = { pid: process.pid, at: Date.now(), nonce: crypto.randomBytes(4).toString("hex") };
  const mineRaw = JSON.stringify(mine);
  const deadline = Date.now() + LOCK_WAIT_MS;
  let wait = 5;
  for (;;) {
    if (await claimLock(file, mineRaw)) break;
    if (Date.now() >= deadline) {
      throw new Error(`design '${id}' is busy: another process is writing it (gave up after ${LOCK_WAIT_MS / 1000} s)`);
    }
    // Someone holds it: steal only a stale one, else back off.
    const { claim, mtime } = readClaim(file);
    if (!claim && !mtime) continue; // released between create and read
    const age = Date.now() - (claim ? claim.at : mtime);
    // A dead owner recovers at once; a live one is trusted for a minute
    // first, so a slow write is never cut off while pid reuse still heals.
    const stale = !claim ? age > LOCK_STALE_MS : !pidAlive(claim.pid) || age > LOCK_LIVE_STALE_MS;
    if (stale) {
      // Re-read first: never unlink a lock another process just took.
      const again = readClaim(file);
      const same = claim ? again.claim?.nonce === claim.nonce : !again.claim && again.mtime === mtime;
      if (same) {
        try {
          fs.unlinkSync(file);
        } catch {
          // lost the race to release it: loop back and try again
        }
      }
      continue;
    }
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 2, 200);
  }
  try {
    return await fn();
  } finally {
    // Release only our own claim, so a stale recovery's fresh lock survives us.
    if (readClaim(file).claim?.nonce === mine.nonce) {
      for (let i = 0; i < 8; i++) {
        try {
          fs.unlinkSync(file);
          break;
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code !== "EPERM" && code !== "EACCES") break;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
      }
    }
  }
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

// An imported SVG hangs on the page as an image, but its media URL opens as
// a document on the studio origin: refuse anything that could run there.
function svgHasActiveContent(text: string): boolean {
  return (
    /<\s*\/?\s*script\b/i.test(text) ||
    /<\s*\/?\s*foreignobject\b/i.test(text) ||
    /\son[a-z]+\s*=/i.test(text) ||
    /javascript\s*:/i.test(text)
  );
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

export function designMtimeMs(id: string): number {
  return fs.statSync(designPath(id)).mtimeMs / 1000;
}

export function importImage(id: string, data: Buffer, filename: string): Promise<{ src: string; path: string }> {
  // Concurrent imports race for the media name: serialize them like design writes.
  return withDesignLock(id, () => storeImage(id, data, filename));
}

async function storeImage(id: string, data: Buffer, filename: string): Promise<{ src: string; path: string }> {
  if (!fs.existsSync(designPath(id))) throw new UnknownDesign(`unknown design '${id}'`);
  const ext = sniffImage(data);
  if (!ext) throw new Error("not a PNG, JPEG, WebP, GIF or SVG image");
  if (data.length > MAX_IMAGE_BYTES) throw new Error("image is larger than 25 MB");
  if (ext === ".svg" && svgHasActiveContent(data.toString("utf-8"))) {
    throw new Error("SVG contains active content (script, event handler, javascript: URL or foreignObject is not allowed)");
  }
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

export { assetsDir, downloadImage };

export function tmpFile(suffix: string): string {
  return path.join(os.tmpdir(), `blum-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
}
