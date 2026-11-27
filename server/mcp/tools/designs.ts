// Designs: overview, api_info, style_guide, create, delete, list, get.
// Every design starts empty (user decision): no tool copies a design.
import fs from "node:fs";
import { designRulesFile } from "../../paths.js";
import { compactDesign } from "../compact.js";
import { itemExamplesDoc } from "../item-examples.js";
import { forget as forgetHistory } from "../../histories.js";
import { noteDesignCreated } from "../../sessions.js";
import { UnknownDesign, createDesign, deleteDesign, isTemplateId, listDesigns } from "../../store.js";
import { CUSTOM_MAX, CUSTOM_MIN, FORMATS } from "../../../ui/engine/index.js";
import { badDesignId, loadDesign, toolError, withDesignLock } from "../trust.js";

export function overviewTool(): string {
  // One reply to start: the intro plus the docs an agent would read next.
  const formats =
    FORMATS.map((f) => `${f.id} ${f.width}x${f.height}`).join(", ") + `, custom ${CUSTOM_MIN}..${CUSTOM_MAX} px`;
  return `Pages as JSON: create any format, check it, export PNG or PDF.
Short replies: apply_ops gives ok + touched ids, get_design one line
per object, preview returns an image (region=[x,y,w,h] zooms).
list_formats shows every size. The design rules follow below, and
style_guide('types') lists the layout archetypes to pick one. Floor:
text in the safe zone; body >= minimum; contrast >= 4.5:1; never
cover a face. Start from create_design + add ops, never copy
(api_info items: full examples). Preview each batch; check_design,
then export.

Rules:
${styleGuideTool()}

Items:
${apiInfoTool("items")}

Ops:
${apiInfoTool("ops")}

Formats:
${formats}`;
}

const DOCS: Record<string, string> = {
  items: itemExamplesDoc(),
  formats:
    "Design: {version:1, name, format, background, items} " +
    "(custom adds width/height in px). list_formats shows every format id with its page size in px; " +
    "custom takes width/height (100..4000 px each). " +
    "Item: {id, name, type, x, y, width, height, " +
    "angle, opacity, blend, locked, visible, props}. blend is a CSS blend " +
    "with the page behind (normal|multiply|screen|overlay|soft-light|...; empty = normal). " +
    "Types: text, shape, image, sticker, vector, photo, group. " +
    "Vector: {svg, tint?, outlineColor?, outlineWidth?} (draw_svg adds one; svg is checked against a strict allowlist). " +
    "Text: {text, font, size, weight, align, color, textFill?} " +
    "(textFill is a photo source drawn through the glyphs). " +
    "Photo: {src, mask: rect|circle|arch|star|blob|heart, cornerRadius, fit, " +
    "outlineColor?, outlineWidth? (0..100 silhouette outline), edge? (0..100 torn edge in px, 0 = straight cut)} " +
    "(rect rounds corners by 24 and arch feet by 24 unless cornerRadius: 0; " +
    "circle ignores it) " +
    "(without src the frame warns). " +
    "Colors are #rrggbb or rgba(r,g,b,a). x/y is the item center in design px.",
  ops:
    "apply_ops takes [{op, ...}]. Ops: add {item}, update {id, patch} (patch fields flat or under props), remove {id}, " +
    "reorder {id, to: front|back|forward|backward} or {id, index} (top-level items only, " +
    "never inside a group: ungroup first), duplicate {id, name?}, " +
    "lock {id, locked}, group {ids (2 or more), name?}, ungroup {id}, align {ids, align: " +
    "left|center-x|right|top|center-y|bottom}, distribute {ids, align: x|y}, " +
    "arrange {layout} (one op for a whole layout: " +
    "{stack: column|row, items: [...], align, gap: sm|md|lg, zone: safe|canvas} " +
    "or {anchors: {id: top|bottom|left|right|center}}), " +
    "set_background {background}: {kind: color, color} for a flat colour " +
    "(color needs a color), {kind: gradient, angle, stops: [{at, color}]} " +
    "(2+ stops; angle in degrees like CSS: 180 = top to bottom, 90 = left to right; " +
    "radial: true gives a round halo from the center instead of a linear sweep), " +
    "{kind: pattern, pattern: dots|grid|stripes|checker|waves|crosses|zigzag|" +
    "triangles|hexagons|diamonds|scallops|bricks|hearts|stars|zellige|scales|arches, patternColor, patternBackground, " +
    "patternScale (0.25..4, base tile 60px), patternAngle, patternWeight (0.25..4)} " +
    "or {kind: image, image: media/... or textures/... src}; " +
    "any kind also takes grain (0..100 film grain over the background). " +
    "Every item also takes blend (see formats). " +
    "Text patch fields: text, font, size, weight (100..900), italic, align, color, " +
    "lineHeight, letterSpacing, decoration, strikethrough, textCase, background, " +
    "list (none|bullet|numbered), curve (none|up|down), curveAmount (0..400), " +
    "shrinkToFit, minSize, shadowColor, shadowX, shadowY, shadowBlur, " +
    "stroke, strokeWidth, gradient ({angle, stops} or {radial: true, stops}, angle like set_background, clipped to the glyphs), " +
    "hollow, haloColor, haloBlur, edge (0..100 torn edge in px, 0 = straight cut), textFill. " +
    "Photo: src, mask (rect|circle|arch|star|blob|heart), cornerRadius, " +
    "outlineColor, outlineWidth (0..100), " +
    "filterPreset (original|vivid|warm|cold|mono|noir|faded|vintage|" +
    "dramatic), brightness, contrast, saturation (-100..100), hue " +
    "(-180..180), blur, vignette (0..100), grayscale, sepia. " +
    "Shape: fill (a color, {color}, or {angle|radial: true, stops} for a gradient fill, angle like set_background), " +
    "stroke, strokeWidth, cornerRadius, edge (0..100 torn edge in px, 0 = straight cut), shape, shadowColor, " +
    "shadowX, shadowY, shadowBlur, bend (-1..1), headSize (0..500, 0 " +
    "= auto), lineStyle (solid|dashed|dotted), startCap/endCap (none|arrow|triangle|circle|square|bar), points (3..12), " +
    "innerRatio (0.1..0.95), sides (3..12). " +
    "Sticker: sticker (catalogue id), tint (one colour for the whole artwork), " +
    "outlineColor, outlineWidth (0..100), shadow fields; group takes the shadow fields too; plain images take " +
    "the photo filter fields. " +
    "The batch stops at the first error and changes nothing.",
  lint:
    "check_design returns findings (error|warn|info) and a 0..100 score. " +
    "Checks: text_too_small (below the format minimum: list_formats), text_overflow (real font, wrapped), unsafe_zone and " +
    "off_canvas (text only: pictures and shapes may bleed), overlap (text on text, or a solid shape over text, groups included), " +
    "covered (note: a picture drawn over text, check it in preview), empty_design, " +
    "contrast (WCAG, against what is really behind the text; contrast_picture note on photos), empty_text, photo_empty " +
    "(warn when the frame has no image). " +
    "image_failed (error when a remote image does not load: pick another src). " +
    "Score: 100 minus 20 per error and 8 per warn; notes (info) never lower it. " +
    "polish_score is the score alone with error/warning counts. " +
    "Fix warns and errors before exporting.",
  resources:
    "list_resources(kind, query?): fonts (family names for text.font), " +
    "stickers (ids like blum/pineapple.svg), " +
    "photos (Unsplash URLs with themes), masks (rect|circle|arch|star|blob|heart). " +
    "import_image stores a local file or URL into designs/media/; remove_background=true cuts the subject out (transparent PNG: use it in a photo with fit contain, or as a sticker-like cut-out).",
  export:
    "preview returns an image to look at (400 px wide, width 64..1080); " +
    "region=[x,y,w,h] crops a zoomed box first. " +
    "preview_board returns one image per design for up to 12 designs (width 64..270). " +
    "export_png writes the page at its pixel size (print formats at 2x = 300 dpi); " +
    "export_pdf writes the exact page size with selectable vector text. " +
    "Without out_path files go to designs/<id>.png|.pdf; an existing out_path is kept and " +
    "the export writes name-2.png (reply note says so). " +
    "Always preview and check_design before export_png or export_pdf. " +
    "undo reverts the last batch, redo reapplies it.",
};

export function apiInfoTool(topic: unknown): string {
  const key = typeof topic === "string" ? topic.toLowerCase() : "";
  if (!(key in DOCS)) {
    return toolError("Unknown topic. Try: " + Object.keys(DOCS).sort().join(", "));
  }
  return DOCS[key];
}

// A designer's rules, as data shared with any app using this MCP.
export function styleGuideTool(topic: unknown = ""): string {
  let GUIDES: Record<string, string>;
  try {
    GUIDES = JSON.parse(fs.readFileSync(designRulesFile(), "utf-8")) as Record<string, string>;
  } catch {
    throw new Error(`${designRulesFile()} is not valid JSON`);
  }
  // No topic: the base rules plus the type picker. Typed archetypes
  // (type:*) are one read each, so the default stays short.
  if (!topic) {
    return Object.entries(GUIDES)
      .filter(([key]) => !key.startsWith("type:"))
      .map(([, text]) => text)
      .join("\n\n");
  }
  const key = typeof topic === "string" ? topic.toLowerCase() : "";
  if (!(key in GUIDES)) {
    return toolError("Unknown topic. Try: " + Object.keys(GUIDES).sort().join(", "));
  }
  return GUIDES[key];
}

export function listFormatsTool(): string {
  const rows: Array<{ id: string; label: string; width: number | null; height: number | null; kind: string }> =
    FORMATS.map((f) => ({ id: f.id, label: f.label, width: f.width, height: f.height, kind: f.kind }));
  rows.push({ id: "custom", label: `Custom size (${CUSTOM_MIN}..${CUSTOM_MAX} px)`, width: null, height: null, kind: "screen" });
  return JSON.stringify(rows);
}

export function createDesignTool(name: unknown, format: unknown = "story", width: unknown = undefined, height: unknown = undefined): string {
  if (typeof name !== "string") return toolError("name must be text (the design title)");
  if (typeof format !== "string") return toolError(`bad format ${JSON.stringify(format)} (use list_formats to see ids)`);
  const w = width === undefined || width === "" ? undefined : Number(width);
  const h = height === undefined || height === "" ? undefined : Number(height);
  if (format === "custom" && (w === undefined || h === undefined)) {
    return toolError(`custom format needs width and height in px (${CUSTOM_MIN}..${CUSTOM_MAX} each)`);
  }
  const title = name.trim() || "Untitled";
  try {
    const made = createDesign(title, format, w, h);
    noteDesignCreated(made.id);
    return JSON.stringify({ id: made.id, design: made.design });
  } catch (e) {
    return toolError(`could not create the design: ${(e as Error).message}`);
  }
}

export async function deleteDraftTool(id: unknown): Promise<string> {
  const problem = badDesignId(id);
  if (problem) return toolError(problem);
  if (isTemplateId(id as string)) {
    return toolError(`'${id}' is an example design, not a draft (examples are never deleted)`);
  }
  return withDesignLock(id as string, () => {
    try {
      deleteDesign(id as string);
    } catch (e) {
      if (e instanceof UnknownDesign) return toolError(`unknown design '${id}' (use list_designs to see ids)`);
      throw e;
    }
    forgetHistory(id as string);
    return JSON.stringify({ deleted: id });
  });
}

export function listDesignsTool(): string {
  try {
    return JSON.stringify(listDesigns().filter((r) => !r.template));
  } catch (e) {
    return toolError(`could not list designs: ${(e as Error).message}`);
  }
}

export function getDesignTool(id: unknown, compact: unknown = true): string {
  const { design, err } = loadDesign(id);
  if (err) return err;
  if (compact === false) return JSON.stringify(design);
  try {
    return compactDesign(design as Record<string, unknown>);
  } catch (e) {
    return toolError(`could not summarize the design: ${(e as Error).message}`);
  }
}
