// Shared harness for the server suite: temp designs dir, live HTTP server.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start } from "../main.js";
import { getOrLaunchBrowser } from "../export/browser.js";

export function useTempDesigns(tag: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `blum-${tag}-`));
  process.env.BLUM_DESIGNS = dir;
  return dir;
}

export interface Client {
  base: string;
  get(p: string): Promise<Res>;
  post(p: string, body?: unknown): Promise<Res>;
  put(p: string, body?: unknown): Promise<Res>;
  del(p: string): Promise<Res>;
  raw(p: string, init?: RequestInit): Promise<Res>;
  close(): Promise<void>;
}

export interface Res {
  status: number;
  headers: Headers;
  text: string;
  json(): unknown;
  bytes(): Promise<Uint8Array>;
}

async function toRes(r: Response): Promise<Res> {
  const buf = new Uint8Array(await r.arrayBuffer());
  const text = Buffer.from(buf).toString("utf-8");
  return {
    status: r.status,
    headers: r.headers,
    text,
    json(): unknown {
      return JSON.parse(text) as unknown;
    },
    async bytes(): Promise<Uint8Array> {
      return buf;
    },
  };
}

export async function liveServer(): Promise<Client> {
  const server = start(0);
  await new Promise<void>((resolve) => {
    const addr = server.address();
    if (addr && typeof addr === "object") resolve();
    else setTimeout(() => resolve(), 200);
  });
  await new Promise((r) => setTimeout(r, 200));
  const addr = server.address();
  const port = addr && typeof addr === "object" ? (addr as { port: number }).port : 0;
  const base = `http://127.0.0.1:${port}`;
  const raw = async (p: string, init?: RequestInit): Promise<Res> => toRes(await fetch(base + p, init));
  return {
    base,
    raw,
    get: (p) => raw(p),
    // The app's own writes carry the guard headers; raw stays bare so tests can
    // still simulate cross-site requests.
    post: (p, body) =>
      raw(p, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Blum-Request": "1", origin: base },
        body: body === undefined ? "{}" : JSON.stringify(body),
      }),
    put: (p, body) =>
      raw(p, {
        method: "PUT",
        headers: { "content-type": "application/json", "X-Blum-Request": "1", origin: base },
        body: JSON.stringify(body ?? {}),
      }),
    del: (p) => raw(p, { method: "DELETE", headers: { "X-Blum-Request": "1", origin: base } }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        setTimeout(() => resolve(), 2000);
      }),
  };
}

// PNG dimensions straight from the IHDR chunk (no image library).
export function pngSize(buf: Uint8Array): [number, number] {
  const b = Buffer.from(buf);
  if (b[0] !== 0x89 || b.toString("latin1", 1, 4) !== "PNG") throw new Error("not a PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

export function textItem(id: string, text = "Hello", size = 96, color = "#111111"): Record<string, unknown> {
  return {
    id,
    name: id,
    type: "text",
    x: 540,
    y: 420,
    width: 900,
    height: 200,
    props: { text, font: "Inter", size, weight: 700, color },
  };
}

export function tinyPng(): Buffer {
  return Buffer.from(
    "89504e470d0a1a0a0000000d494844520100000001000000010806" +
      "0000001f15c4890000000d49444154789c626001000000ffff0300" +
      "0006ff05000000000049454e44ae426082",
    "hex",
  );
}

export function multipart(field: string, filename: string, data: Uint8Array, type: string): { body: Buffer; boundary: string } {
  const boundary = `----blum${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
    "latin1",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "latin1");
  return { body: Buffer.concat([head, Buffer.from(data), tail]), boundary };
}

/** One pixel of a PNG, read in Chromium (no image library). */
export async function pixelAt(png: Uint8Array, x: number, y: number): Promise<[number, number, number]> {
  const page = await (await getOrLaunchBrowser()).newPage();
  try {
    return (await page.evaluate(async ([b64, px, py]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d") as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(px, py, 1, 1).data;
      return [d[0], d[1], d[2]];
    }, [Buffer.from(png).toString("base64"), x, y] as const)) as [number, number, number];
  } finally {
    await page.close();
  }
}

/** Colours within 6 levels per channel (anti-aliasing and colour profiles). */
export function closeTo(actual: [number, number, number], want: [number, number, number]): boolean {
  return actual.every((v, i) => Math.abs(v - want[i]) <= 6);
}
