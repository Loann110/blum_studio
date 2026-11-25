// Resources: fonts, stickers, photos and masks for the UI.
// One place for the listings both the MCP server and the HTTP API serve.
import fs from "node:fs";
import { photosFile, renderFontsCss, stickersDir } from "./paths.js";

export const MASKS = ["rect", "circle", "arch", "star", "blob", "heart"];

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

let fontsCssCache: string | null = null;
function fontsCss(): string {
  if (fontsCssCache === null) fontsCssCache = fs.readFileSync(renderFontsCss(), "utf-8");
  return fontsCssCache;
}

export function listFonts(query = ""): string[] {
  const names = new Set<string>();
  for (const m of fontsCss().matchAll(/font-family: "([^"]+)"/g)) names.add(m[1]);
  const q = query.toLowerCase();
  return [...names].filter((n) => n.toLowerCase().includes(q)).sort();
}

export type StickerEntry = Record<string, unknown>;

// The catalogue is the manifest minus entries whose file is gone, rebuilt at
// most every STICKERS_TTL_MS: deleting a sticker file drops it everywhere
// (editor, Resources, MCP) without a restart and without dead tiles.
export const STICKERS_TTL_MS = 2000;
let stickersCache: { at: number; dir: string; list: StickerEntry[] } | null = null;
function allStickers(): StickerEntry[] {
  const dir = stickersDir();
  if (stickersCache && stickersCache.dir === dir && Date.now() - stickersCache.at < STICKERS_TTL_MS) return stickersCache.list;
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf-8")) as unknown;
  } catch {
    throw new Error("stickers/manifest.json is not valid JSON");
  }
  const raw = manifest && typeof manifest === "object" && "stickers" in (manifest as Record<string, unknown>)
    ? (manifest as { stickers: unknown }).stickers
    : manifest;
  const list = (Array.isArray(raw) ? (raw as StickerEntry[]) : [])
    .filter((e) => e && typeof e === "object" && fs.existsSync(`${dir}/${stickerFile(e)}`));
  stickersCache = { at: Date.now(), dir, list };
  return list;
}

export function stickerMatches(entry: StickerEntry, query: string): boolean {
  if (!query) return true;
  const folded = fold(query);
  const kw = Array.isArray(entry.keywords) ? (entry.keywords as unknown[]).join(" ") : "";
  const hay = [entry.id, entry.file, entry.label, entry.category, entry.pack, kw]
    .map((v) => String(v ?? ""))
    .join(" ");
  return folded.split(/\s+/).every((part) => fold(hay).includes(part));
}

export function searchStickers(query = "", limit = 200): StickerEntry[] {
  return allStickers().filter((e) => e && typeof e === "object" && stickerMatches(e, query)).slice(0, Math.max(1, limit));
}

export function stickerCategories(): string[] {
  return [...new Set(allStickers().map((e) => String(e.category ?? "")).filter(Boolean))].sort();
}

export function listPhotos(query = "", limit = 100): unknown[] {
  let photos: unknown[];
  try {
    photos = JSON.parse(fs.readFileSync(photosFile(), "utf-8")) as unknown[];
  } catch {
    throw new Error(`${photosFile()} is not valid JSON`);
  }
  if (query) photos = photos.filter((p) => fold(JSON.stringify(p)).includes(query));
  return photos.slice(0, Math.max(1, limit));
}

export function stickerFile(entry: StickerEntry): string {
  return String(entry.file ?? entry.id ?? "");
}
