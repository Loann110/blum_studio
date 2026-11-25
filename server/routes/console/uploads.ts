// Console uploads: staged images the agent imports, and documents it reads
// (PDF or plain text) for the content of the design.
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fail, parseMultipart, sendJson } from "../../http.js";
import { sniffImage } from "../../store.js";
import { consoleDir } from "../../sessions.js";
import { guarded } from "./shared.js";

const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".json"]);

// A document is trusted by its content, not its name: a real PDF header, or
// text that is valid UTF-8 without NUL bytes.
export function documentExt(filename: string, data: Buffer): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return data.subarray(0, 5).toString("latin1") === "%PDF-" ? ".pdf" : null;
  if (!TEXT_EXTS.has(ext) || data.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return ext;
  } catch {
    return null;
  }
}

export async function consoleUploadRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!guarded(req, res)) return;
  const type = req.headers["content-type"];
  if (typeof type !== "string" || !type.includes("multipart")) {
    fail(res, 400, "multipart file upload expected");
    return;
  }
  const chunks: Buffer[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve());
      req.on("error", reject);
    });
  } catch {
    fail(res, 400, "could not read the upload");
    return;
  }
  let file: { filename: string; data: Buffer };
  try {
    file = parseMultipart(Buffer.concat(chunks), type);
  } catch (e) {
    fail(res, 400, (e as Error).message);
    return;
  }
  const ext = sniffImage(file.data) ?? documentExt(file.filename, file.data);
  if (!ext) {
    fail(res, 400, "not an image (PNG, JPEG, WebP, GIF, SVG) or a document (PDF, TXT, MD, CSV, JSON)");
    return;
  }
  if (file.data.length > 25_000_000) {
    fail(res, 400, "file is larger than 25 MB");
    return;
  }
  fs.mkdirSync(consoleDir(), { recursive: true });
  const stem =
    path.basename(file.filename, path.extname(file.filename)).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "file";
  let target = path.join(consoleDir(), `${stem}${ext}`);
  for (let i = 2; i < 1000 && fs.existsSync(target); i++) target = path.join(consoleDir(), `${stem}-${i}${ext}`);
  fs.writeFileSync(target, file.data);
  sendJson(res, 200, { path: target });
}
