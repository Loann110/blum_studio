// Stock photos: Pexels and Pixabay keys, search, and stock-id resolution.
// Keys live in the user's .env (see envFile) and never leave the server: the
// HTTP API reports only which services have one, never the value.
import fs from "node:fs";
import path from "node:path";
import { downloadImage, type ResolveFn } from "./download.js";
import { envFile } from "./paths.js";
import { withDesignLock } from "./store.js";

export const STOCK_SERVICES = ["pexels", "pixabay"] as const;
export type StockService = (typeof STOCK_SERVICES)[number];

// A key the service refused: shown as "invalid key", not a network error.
export class InvalidStockKey extends Error {}

export interface StockPhoto {
  id: string;
  description: string;
  width: number;
  height: number;
  color?: string;
  photographer: string;
  page: string;
  url: string;
}

export interface ResolvedStock {
  url: string;
  photographer: string;
  page: string;
}

/* ---- keys ---- */

const ENV_NAMES: Record<StockService, string> = { pexels: "PEXELS_API_KEY", pixabay: "PIXABAY_API_KEY" };

// Keys are one token of letters, digits, - or _: anything else (a newline, a
// quote, "=") could write extra lines into .env, so it is refused.
export function isValidStockKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{8,200}$/.test(key);
}

// .env is loaded at start (loadDotEnv) and kept in step on every save.
export function readKeys(): Record<StockService, string> {
  return {
    pexels: (process.env.PEXELS_API_KEY ?? "").trim(),
    pixabay: (process.env.PIXABAY_API_KEY ?? "").trim(),
  };
}

export function stockStatus(): Record<StockService, boolean> {
  const keys = readKeys();
  return { pexels: Boolean(keys.pexels), pixabay: Boolean(keys.pixabay) };
}

// Writes the key into the user's .env (other lines kept), then into this
// process. An empty key removes the line. Callers validate with isValidStockKey.
export function setStockKey(service: StockService, key: string): Promise<unknown> {
  const name = ENV_NAMES[service];
  const clean = key.trim();
  if (clean && !isValidStockKey(clean)) return Promise.reject(new Error("invalid key format"));
  // One lock for the file, like design writes, so concurrent saves never interleave.
  return withDesignLock("stock-settings", () => {
    const file = envFile();
    let lines: string[] = [];
    try {
      lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    lines = lines.filter((line) => !line.startsWith(`${name}=`));
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (clean) lines.push(`${name}=${clean}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, lines.join("\n") + "\n", { mode: 0o600 }); // owner-only on Linux/macOS
    fs.renameSync(tmp, file);
    if (clean) process.env[name] = clean;
    else delete process.env[name];
  });
}

/* ---- service calls ---- */

// Tests point these at a local server; the defaults are the official hosts.
function pexelsBase(): string {
  return process.env.PEXELS_API_BASE ?? "https://api.pexels.com/v1";
}

function pixabayBase(): string {
  return process.env.PIXABAY_API_BASE ?? "https://pixabay.com/api";
}

async function pexelsSearch(key: string, query: string, perPage: number): Promise<StockPhoto[]> {
  // Docs: https://www.pexels.com/api/documentation/#photos-search
  const url = `${pexelsBase()}/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 401 || res.status === 403) throw new InvalidStockKey("invalid key");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { photos?: Array<Record<string, unknown>> };
  return (body.photos ?? []).map((p) => {
    const src = (p.src ?? {}) as Record<string, unknown>;
    return {
      id: `pexels:${String(p.id)}`,
      description: String(p.alt ?? ""),
      width: Number(p.width),
      height: Number(p.height),
      color: typeof p.avg_color === "string" ? p.avg_color : undefined,
      photographer: String(p.photographer ?? ""),
      page: String(p.url ?? ""),
      url: String(src.large2x ?? src.original ?? ""),
    };
  });
}

async function pixabaySearch(key: string, query: string, perPage: number): Promise<StockPhoto[]> {
  // Docs: https://pixabay.com/api/docs/
  const url = `${pixabayBase()}/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=${perPage}`;
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) throw new InvalidStockKey("invalid key");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { hits?: Array<Record<string, unknown>> };
  return (body.hits ?? []).map((h) => ({
    id: `pixabay:${String(h.id)}`,
    description: String(h.tags ?? ""),
    width: Number(h.imageWidth),
    height: Number(h.imageHeight),
    photographer: String(h.user ?? ""),
    page: String(h.pageURL ?? ""),
    url: String(h.largeImageURL ?? h.webformatURL ?? ""),
  }));
}

export interface StockSearchResult {
  rows: StockPhoto[];
  notes: string[];
}

export async function searchStockPhotos(query: string): Promise<StockSearchResult> {
  const keys = readKeys();
  const rows: StockPhoto[] = [];
  const notes: string[] = [];
  const tryService = async (service: StockService, call: () => Promise<StockPhoto[]>): Promise<void> => {
    try {
      rows.push(...(await call()));
    } catch (e) {
      notes.push(`${service} unavailable: ${(e as Error).message}`);
    }
  };
  if (keys.pexels) await tryService("pexels", () => pexelsSearch(keys.pexels, query, 10));
  if (keys.pixabay) await tryService("pixabay", () => pixabaySearch(keys.pixabay, query, 10));
  return { rows, notes };
}

// One tiny search proves the key: 401/403 mean it is wrong.
export async function probeStock(service: StockService, key: string): Promise<string> {
  try {
    if (service === "pexels") await pexelsSearch(key, "a", 1);
    else await pixabaySearch(key, "a", 3); // Pixabay's per_page minimum is 3
    return "connected";
  } catch (e) {
    if (e instanceof InvalidStockKey) return "invalid key";
    return `unavailable: ${(e as Error).message}`;
  }
}

/* ---- stock id resolution ---- */

const STOCK_REF = /^(pexels|pixabay):(\d+)$/;

export function isStockRef(source: string): boolean {
  return STOCK_REF.test(source);
}

export async function resolveStockPhoto(ref: string): Promise<ResolvedStock> {
  const m = STOCK_REF.exec(ref);
  if (!m) throw new Error(`not a stock photo id: '${ref}'`);
  const service = m[1] as StockService;
  const id = m[2];
  const key = readKeys()[service];
  if (!key) throw new Error(`${service} key is not set (add it in Settings)`);
  if (service === "pexels") return resolvePexels(id, key);
  return resolvePixabay(id, key);
}

async function resolvePexels(id: string, key: string): Promise<ResolvedStock> {
  // Docs: https://www.pexels.com/api/documentation/#photos-get-specific
  const res = await fetch(`${pexelsBase()}/photos/${encodeURIComponent(id)}`, { headers: { Authorization: key } });
  if (res.status === 401 || res.status === 403) throw new InvalidStockKey("invalid key");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const p = (await res.json()) as Record<string, unknown>;
  const src = (p.src ?? {}) as Record<string, unknown>;
  return {
    url: String(src.large2x ?? src.original ?? ""),
    photographer: String(p.photographer ?? ""),
    page: String(p.url ?? ""),
  };
}

async function resolvePixabay(id: string, key: string): Promise<ResolvedStock> {
  // Docs: https://pixabay.com/api/docs/
  const res = await fetch(`${pixabayBase()}/?key=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`);
  if (res.status === 401 || res.status === 403) throw new InvalidStockKey("invalid key");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { hits?: Array<Record<string, unknown>> };
  const h = (body.hits ?? [])[0];
  if (!h) throw new Error("photo not found");
  return {
    url: String(h.largeImageURL ?? h.webformatURL ?? ""),
    photographer: String(h.user ?? ""),
    page: String(h.pageURL ?? ""),
  };
}

// Tests swap the resolver so a local fake server can serve the bytes; the
// default keeps the SSRF guard for the public stock hosts.
let imageResolve: ResolveFn | undefined;

export function setStockImageResolver(resolve: ResolveFn | undefined): void {
  imageResolve = resolve;
}

export function downloadStockImage(url: string): Promise<Buffer> {
  return downloadImage(url, imageResolve);
}
