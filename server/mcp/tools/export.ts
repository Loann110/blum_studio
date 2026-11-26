// Export: full-size PNG or exact-size PDF files for designs.
import fs from "node:fs";
import { exportPdf } from "../../export/pdf.js";
import { exportPng } from "../../export/png.js";
import { checkOutPath, defaultPdfPath, defaultPngPath, loadDesign, toolError } from "../trust.js";

export async function exportPngTool(id: unknown, outPath: unknown = ""): Promise<string> {
  const { err } = loadDesign(id);
  if (err) return err;
  const { target, err: pathErr } = checkOutPath(outPath);
  if (pathErr) return pathErr;
  try {
    const done = await exportPng(id as string, target ?? defaultPngPath(id as string));
    return JSON.stringify({ path: done });
  } catch (e) {
    // Free the name checkOutPath reserved, so a retry gets it back.
    if (target) fs.rmSync(target, { force: true });
    return toolError(`export failed: ${(e as Error).message}`);
  }
}

export async function exportPdfTool(id: unknown, outPath: unknown = ""): Promise<string> {
  const { err } = loadDesign(id);
  if (err) return err;
  const { target, err: pathErr } = checkOutPath(outPath, ".pdf");
  if (pathErr) return pathErr;
  try {
    const done = await exportPdf(id as string, target ?? defaultPdfPath(id as string));
    return JSON.stringify({ path: done });
  } catch (e) {
    if (target) fs.rmSync(target, { force: true });
    return toolError(`export failed: ${(e as Error).message}`);
  }
}
