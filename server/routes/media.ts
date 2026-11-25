// Media: upload (multipart file or {url, filename} JSON), serve media files.
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fail, mimeFor, needDesign, parseMultipart, readBody, readJson, sendFile, sendJson } from "../http.js";
import { mediaDir } from "../paths.js";
import { UnknownDesign, downloadImage, importImage } from "../store.js";

export async function uploadRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  // 404 on unknown designs before touching the bytes.
  if (!needDesign(res, id)) return;
  const contentType = String(req.headers["content-type"] ?? "");
  let data: Buffer;
  let filename: string;
  try {
    if (contentType.startsWith("multipart/")) {
      const body = await readBody(req);
      const file = parseMultipart(body, contentType);
      data = file.data;
      filename = file.filename || "image";
    } else {
      const body = (await readJson(req)) as Record<string, unknown>;
      if (!body || typeof body !== "object" || !body.url) throw new Error("JSON body must carry a 'url'");
      data = await downloadImage(String(body.url));
      filename = String(body.filename ?? "photo") || "photo";
    }
  } catch (e) {
    fail(res, 400, (e as Error).message);
    return;
  }
  try {
    sendJson(res, 200, await importImage(id, data, filename));
  } catch (e) {
    if (e instanceof UnknownDesign) fail(res, 404, "unknown design");
    else fail(res, 400, (e as Error).message);
  }
}

export async function mediaRoute(_req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
  const base = path.basename(name);
  const target = path.resolve(mediaDir(), base);
  if (!target.startsWith(path.resolve(mediaDir()) + path.sep) || !fs.existsSync(target)) {
    fail(res, 404, "unknown media");
    return;
  }
  sendFile(res, target, mimeFor(target));
}
