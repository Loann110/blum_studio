// Tiny HTTP helpers: JSON bodies, JSON/file/error replies, multipart upload.
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { UnknownDesign, getDesign } from "./store.js";

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(text);
}

export function fail(res: ServerResponse, status: number, detail: string): void {
  sendJson(res, status, { detail });
}

function header(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Only the local app may change state: the custom header forces a CORS
// preflight a web attacker can never pass (this server sends no CORS
// headers), and the page's own Origin must match. Otherwise: 403.
export function postAllowed(req: IncomingMessage): boolean {
  if (header(req.headers["x-blum-request"]) !== "1") return false;
  const host = header(req.headers.host);
  const port = host.split(":").pop() ?? "";
  if (!port || Number.isNaN(Number(port))) return false;
  const origin = header(req.headers.origin);
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

/** The design, or null after answering 404 (unknown id) or 500 (unreadable). */
export function needDesign(res: ServerResponse, id: string): Record<string, unknown> | null {
  try {
    return getDesign(id) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof UnknownDesign) fail(res, 404, "unknown design");
    else fail(res, 500, (e as Error).message);
    return null;
  }
}

export function sendFile(res: ServerResponse, file: string, type: string, name?: string): void {
  const stat = fs.statSync(file);
  const head: Record<string, string> = {
    "content-type": type,
    "content-length": String(stat.size),
  };
  if (name) head["content-disposition"] = `inline; filename="${name}"`;
  res.writeHead(200, head);
  fs.createReadStream(file).pipe(res);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export function mimeFor(file: string): string {
  return TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export function readBody(req: IncomingMessage, limit = 30_000_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body is larger than 30 MB"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req, 10_000_000);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf-8"));
  } catch {
    throw new Error("body must be valid JSON");
  }
}

export interface UploadedFile {
  filename: string;
  data: Buffer;
}

// Minimal multipart parser: finds the part named "file", keeps its bytes.
export function parseMultipart(body: Buffer, contentType: string): UploadedFile {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!m) throw new Error("multipart field 'file' is missing");
  const sep = Buffer.from(`--${(m[1] ?? m[2]).trim()}`);
  const end = Buffer.from(`--${(m[1] ?? m[2]).trim()}--`);
  let start = body.indexOf(sep);
  while (start >= 0) {
    if (body.subarray(start, start + end.length).equals(end)) break;
    let head = start + sep.length;
    if (body[head] === 0x0d && body[head + 1] === 0x0a) head += 2;
    const gap = body.indexOf(Buffer.from("\r\n\r\n"), head);
    if (gap < 0) break;
    const headers = body.subarray(head, gap).toString("latin1");
    const disp = /name="([^"]*)"(?:;\s*filename="([^"]*)")?/.exec(headers);
    let next = body.indexOf(sep, gap + 4);
    if (next < 0) next = body.length;
    let data = body.subarray(gap + 4, next);
    if (data.length >= 2 && data[data.length - 2] === 0x0d) data = data.subarray(0, -2);
    if (disp?.[1] === "file") {
      return { filename: disp[2] || "image", data: Buffer.from(data) };
    }
    start = next;
  }
  throw new Error("multipart field 'file' is missing");
}
