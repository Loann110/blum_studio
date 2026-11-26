// SVG workshop: draw an agent's SVG as a vector item and show it back in the
// same call, so drawing costs one round trip instead of two.
import crypto from "node:crypto";
import type { Design } from "../../store.js";
import { loadDesign, refuseTemplate, toolError, type Content } from "../trust.js";
import { applyOpsTool } from "./ops.js";
import { previewPng } from "./preview.js";

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function drawSvgTool(
  designId: unknown,
  svg: unknown,
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown,
  name: unknown = "",
): Promise<string | Content[]> {
  const refused = refuseTemplate(designId);
  if (refused) return refused;
  const cx = Number(x);
  const cy = Number(y);
  const w = positive(width);
  const h = positive(height);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || w === null || h === null) {
    return toolError("x and y (the centre, design px) and a positive width and height are required");
  }
  if (typeof svg !== "string") return toolError("svg must be a string holding one <svg viewBox=\"...\">");
  const label = typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "drawing";
  const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawing"}-${crypto.randomBytes(2).toString("hex")}`;
  // The engine checks the SVG against its allowlist inside apply_ops.
  const added = await applyOpsTool(designId, [
    { op: "add", item: { id, name: label, type: "vector", x: cx, y: cy, width: w, height: h, props: { svg } } },
  ]);
  if (!(JSON.parse(added) as { ok?: boolean }).ok) return added;
  const { design } = loadDesign(designId);
  // Look at the drawing with a margin of context around it.
  const pad = Math.max(w, h) * 0.2;
  const region = [cx - w / 2 - pad, cy - h / 2 - pad, w + 2 * pad, h + 2 * pad];
  try {
    const image = await previewPng(design as Design, 400, region);
    return [{ type: "text", text: JSON.stringify({ ok: true, id }) }, { type: "image", data: image, mimeType: "image/png" }];
  } catch (e) {
    return JSON.stringify({ ok: true, id, preview: `failed: ${(e as Error).message}` });
  }
}
