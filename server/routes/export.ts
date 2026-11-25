// Export over HTTP: PNG render, gallery duplicate page.
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { exportPng } from "../export/png.js";
import { exportPdf } from "../export/pdf.js";
import { fail, needDesign, sendFile, sendJson } from "../http.js";

export async function exportRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!needDesign(res, id)) return;
  try {
    const target = await exportPng(id);
    sendJson(res, 200, { path: path.basename(target), url: `/api/designs/${id}/png` });
  } catch (e) {
    fail(res, 400, (e as Error).message);
  }
}

export async function pngRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!needDesign(res, id)) return;
  try {
    const target = await exportPng(id);
    sendFile(res, target, "image/png", `${id}.png`);
  } catch (e) {
    fail(res, 400, (e as Error).message);
  }
}

export async function pdfRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!needDesign(res, id)) return;
  try {
    const target = await exportPdf(id);
    sendFile(res, target, "application/pdf", `${id}.pdf`);
  } catch (e) {
    fail(res, 400, (e as Error).message);
  }
}
