// Media: store a local file or URL as design media, returns its src.
import fs from "node:fs";
import { removeBackground } from "../../export/cutout.js";
import { downloadImage, importImage, UnknownDesign } from "../../store.js";
import { badDesignId, refuseTemplate, toolError } from "../trust.js";

export async function importImageTool(
  id: unknown,
  source: unknown,
  filename: unknown = "photo",
  removeBg: unknown = false,
): Promise<string> {
  const problem = badDesignId(id);
  if (problem) return toolError(problem);
  const refused = refuseTemplate(id);
  if (refused) return refused;
  if (typeof source !== "string" || !source.trim()) {
    return toolError("source must be an http(s) URL or a local file path (use list_resources('photos') for URLs)");
  }
  if (typeof filename !== "string" || !filename.trim()) {
    return toolError("filename must be text (the media name, e.g. 'hero')");
  }
  let data: Buffer;
  let name: string;
  if (source.startsWith("http://") || source.startsWith("https://")) {
    try {
      data = await downloadImage(source);
    } catch (e) {
      return toolError(`could not download '${source.slice(0, 80)}': ${(e as Error).message}`);
    }
    name = filename;
  } else {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      return toolError(`local file not found: '${source.slice(0, 80)}' (use an existing path or an http(s) URL)`);
    }
    try {
      data = fs.readFileSync(source);
    } catch (e) {
      return toolError(`could not read '${source.slice(0, 80)}': ${(e as Error).message}`);
    }
    name = filename;
  }
  if (removeBg === true) {
    try {
      data = await removeBackground(data);
    } catch (e) {
      return toolError(`could not remove the background: ${(e as Error).message}`);
    }
    name = `${name}-cutout`;
  }
  try {
    return JSON.stringify(await importImage(id as string, data, name));
  } catch (e) {
    if (e instanceof UnknownDesign) return toolError(`unknown design '${id}' (use list_designs to see ids)`);
    if ((e as NodeJS.ErrnoException).code) return toolError(`could not store the image: ${(e as Error).message}`);
    return toolError(`not usable as media: ${(e as Error).message}`);
  }
}
