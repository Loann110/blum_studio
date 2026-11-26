// MCP trust boundary: every tool checks its inputs here (design ids, file
// paths, sticker refs), so a crafted id can never walk out of designs/.
import fs from "node:fs";
import path from "node:path";
import { getDesign, isTemplateId, UnknownDesign, withDesignLock, type Design } from "../store.js";
import { designsDir } from "../paths.js";
import { searchStickers } from "../resources.js";

// What a tool may return besides plain text: MCP content parts (images to look at).
export type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

// Design ids are ours (slug + short hex) or example-* ids: never let a
// crafted id walk out of designs/ ("../../x" would join a path outside it).
const DESIGN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/;

export function toolError(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

// Follows the live catalogue: a deleted sticker is refused, not rendered as a hole.
export function knownStickerIds(): Set<string> {
  return new Set(searchStickers("", 1000000).map((e) => String(e.file ?? e.id ?? "")));
}

export function badSticker(value: unknown, i: number): string | null {
  if (typeof value !== "string" || !knownStickerIds().has(value)) {
    return `ops[${i}] unknown sticker ${JSON.stringify(value)} (use list_resources('stickers') to see ids)`;
  }
  return null;
}

export function badDesignId(id: unknown): string | null {
  if (typeof id !== "string" || !DESIGN_ID_RE.test(id)) {
    return `bad design id ${JSON.stringify(id)} (use the id from create_design or list_designs)`;
  }
  return null;
}

// Shipped examples are starting points, not drafts: every MCP write refuses
// them here, so an agent starts from create_design instead of changing one.
export function refuseTemplate(id: unknown): string {
  if (typeof id === "string" && isTemplateId(id)) {
    return toolError(`'${id}' is an example design (examples are read-only: start from create_design instead)`);
  }
  return "";
}

// Fresh design from disk plus an error reply ("" when fine). Reads the file
// on every call, so edits the editor saved meanwhile are visible here too.
export function loadDesign(id: unknown): { design: Design | null; err: string } {
  const problem = badDesignId(id);
  if (problem) return { design: null, err: toolError(problem) };
  try {
    return { design: getDesign(id as string), err: "" };
  } catch (e) {
    if (e instanceof UnknownDesign) {
      return {
        design: null,
        err: toolError(`unknown design '${id}' (use list_designs to see ids)`),
      };
    }
    return { design: null, err: toolError(`design '${id}' is invalid: ${(e as Error).message} (fix it or delete it)`) };
  }
}

export function checkOutPath(outPath: unknown, ext = ".png"): { target: string | null; err: string } {
  if (!outPath) return { target: null, err: "" };
  if (typeof outPath !== "string" || !outPath.toLowerCase().endsWith(ext)) {
    return { target: null, err: toolError(`out_path must end with '${ext}'`) };
  }
  const parent = path.dirname(outPath);
  if (parent !== "" && parent !== "." && !fs.existsSync(parent)) {
    return {
      target: null,
      err: toolError(`directory '${parent}' does not exist (create it first or drop out_path to use designs/)`),
    };
  }
  // Collapse symlinks first: a symlinked parent must not redirect the write.
  let realParent: string;
  try {
    realParent = fs.realpathSync(parent === "" ? "." : parent);
  } catch {
    return {
      target: null,
      err: toolError(`directory '${parent}' does not exist (create it first or drop out_path to use designs/)`),
    };
  }
  // Never replace an existing file: exclusive-create the name (same -2 rule
  // as media), so two exports racing for it cannot both win.
  const target = path.join(realParent, path.basename(outPath));
  const suffix = path.extname(target) || ext;
  const stem = target.slice(0, target.length - suffix.length);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? target : `${stem}-${n}${suffix}`;
    try {
      fs.closeSync(fs.openSync(candidate, "wx"));
      return { target: candidate, err: "" };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") {
        return { target: null, err: toolError(`cannot write to '${outPath}' (${(e as Error).message})`) };
      }
    }
  }
  return { target: null, err: toolError(`cannot write to '${outPath}' (all -2..-999 names are taken)`) };
}

export function defaultPngPath(id: string): string {
  return path.join(designsDir(), `${id}.png`);
}

export function defaultPdfPath(id: string): string {
  return path.join(designsDir(), `${id}.pdf`);
}

export { withDesignLock };
