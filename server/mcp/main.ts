
// MCP server: lean tools over the TS engine. Start with `overview`.
// Trust checks live in trust.ts; one tool group per file under tools/.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { Content } from "./trust.js";
import { studioVersion } from "../version.js";
import { designId, designIds, operationsSchema, regionSchema } from "./schemas.js";
import { createDesignTool, deleteDraftTool, getDesignTool, listDesignsTool, listFormatsTool, apiInfoTool, overviewTool, styleGuideTool } from "./tools/designs.js";
import { applyOpsTool, redoTool, undoTool } from "./tools/ops.js";
import { checkDesignTool, polishScoreTool } from "./tools/check.js";
import { listResourcesTool } from "./tools/resources.js";
import { importImageTool } from "./tools/media.js";
import { drawSvgTool } from "./tools/vector.js";
import { previewBoardTool, previewTool } from "./tools/preview.js";
import { exportPdfTool, exportPngTool } from "./tools/export.js";

/* ---- registration ---- */

const server = new McpServer({ name: "blum-studio", version: studioVersion() });

const TOOLS: Array<{ name: string; desc: string; schema: Record<string, z.ZodTypeAny>; fn: (a: Record<string, unknown>) => Promise<string | Content[]> | string }> = [
  { name: "overview", desc: "Read first: what this server does and the design rules to follow.", schema: {}, fn: () => overviewTool() },
  { name: "api_info", desc: "Short docs for one topic: items (complete examples to add), formats, ops, lint, resources, export.", schema: { topic: z.string() }, fn: (a) => apiInfoTool(a.topic) },
  { name: "style_guide", desc: "Short design rules for pages: no topic gives them all; topic: composition|hierarchy|type|color|photo|depth|finish|avoid|types, or a type:<id> listed by types.", schema: { topic: z.string().optional().default("") }, fn: (a) => styleGuideTool(a.topic as string) },
  { name: "create_design", desc: "Create an empty design in any format; returns {id, design}.", schema: { name: z.string(), format: z.string().optional(), width: z.number().optional(), height: z.number().optional() }, fn: (a) => createDesignTool(a.name, a.format, a.width, a.height) },
  { name: "list_formats", desc: "List page formats (id, size in px) for create_design.", schema: {}, fn: () => listFormatsTool() },
  { name: "delete_draft", desc: "Delete a draft and its undo history; error on unknown ids.", schema: { design_id: designId }, fn: (a) => deleteDraftTool(a.design_id) },
  { name: "list_designs", desc: "List saved drafts (id, name, format), newest first.", schema: {}, fn: () => listDesignsTool() },
  { name: "get_design", desc: "One line per object by default; compact=false for the full JSON.", schema: { design_id: designId, compact: z.boolean().optional() }, fn: (a) => getDesignTool(a.design_id, a.compact) },
  { name: "apply_ops", desc: "Apply a non-empty array of op objects, returns ok + touched ids (not the full design). Item x/y is its centre in design px, not its corner. See api_info('ops') for operation shapes.", schema: { design_id: designId, ops: operationsSchema }, fn: (a) => applyOpsTool(a.design_id, a.ops) },
  { name: "undo", desc: "Undo the last applied batch; returns {design, undone} (undone false when there is nothing to undo).", schema: { design_id: designId }, fn: (a) => undoTool(a.design_id) },
  { name: "redo", desc: "Redo the last undone batch; returns {design, redone} (redone false when there is nothing to redo).", schema: { design_id: designId }, fn: (a) => redoTool(a.design_id) },
  { name: "check_design", desc: "Lint a design: findings plus 0..100 technical care score, not an aesthetic rating.", schema: { design_id: designId }, fn: (a) => checkDesignTool(a.design_id) },
  { name: "polish_score", desc: "Just the 0..100 technical care score with error/warning counts (check_design has details).", schema: { design_id: designId }, fn: (a) => polishScoreTool(a.design_id) },
  { name: "list_resources", desc: "List fonts, stickers, photos, categories or masks. Query filters by name.", schema: { kind: z.string(), query: z.string().optional() }, fn: (a) => listResourcesTool(a.kind, a.query) },
  { name: "import_image", desc: "Store a local file path or http(s) URL as design media; returns {src, path}: use src in items. remove_background=true cuts the subject out (transparent PNG).", schema: { design_id: designId, source: z.string(), filename: z.string().optional(), remove_background: z.boolean().optional() }, fn: (a) => importImageTool(a.design_id, a.source, a.filename, a.remove_background) },
  { name: "draw_svg", desc: "SVG workshop: draw a simple icon or custom shape as an editable vector item (one <svg viewBox> of path, circle, rect, ellipse, line, polyline, polygon, g; fill/stroke as #hex or rgba; 8 KB max). x/y is the centre. Returns its id and a zoomed preview (if the preview fails: {ok, id, preview: 'failed: ...'} and no image).", schema: { design_id: designId, svg: z.string(), x: z.number(), y: z.number(), width: z.number(), height: z.number(), name: z.string().optional() }, fn: (a) => drawSvgTool(a.design_id, a.svg, a.x, a.y, a.width, a.height, a.name) },
  { name: "preview", desc: "Look at the design: a PNG image (400 px wide by default, width clamped to 64..1080); region=[x,y,w,h] zooms on a design-space box.", schema: { design_id: designId, width: z.number().optional(), region: regionSchema.optional() }, fn: (a) => previewTool(a.design_id, a.width, a.region) },
  { name: "preview_board", desc: "Look at several designs at once (array of 1 to 12 design ids): JSON rows, then one image per design (width 64..270 px each, default 135).", schema: { design_ids: designIds, width: z.number().optional() }, fn: (a) => previewBoardTool(a.design_ids, a.width) },
  { name: "export_png", desc: "Export the design as PNG at its page size. Without out_path it writes designs/<id>.png. An existing out_path is never replaced: the reply path (and note) give the file really written.", schema: { design_id: designId, out_path: z.string().optional() }, fn: (a) => exportPngTool(a.design_id, a.out_path) },
  { name: "export_pdf", desc: "Export the design as PDF at its exact page size (vector text). Without out_path it writes designs/<id>.pdf. An existing out_path is never replaced: the reply path (and note) give the file really written.", schema: { design_id: designId, out_path: z.string().optional() }, fn: (a) => exportPdfTool(a.design_id, a.out_path) },
];

// Clients trust isError, so the tools' own failure texts must set it too.
export function toolResult(out: string | Content[]): { content: Content[]; isError?: boolean } {
  const content = typeof out === "string" ? [{ type: "text" as const, text: out }] : out;
  if (typeof out !== "string") return { content };
  if (out.startsWith("{")) {
    try {
      if ((JSON.parse(out) as { ok?: unknown }).ok === false) return { content, isError: true };
    } catch {
      // plain text that starts with "{": still a success reply
    }
  }
  return { content };
}

export function registerTools(): void {
  for (const t of TOOLS) {
    server.registerTool(t.name, { description: t.desc, inputSchema: t.schema }, async (args: Record<string, unknown>) => {
      return toolResult(await t.fn(args));
    });
  }
}

export async function main(): Promise<void> {
  registerTools();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1]?.endsWith("mcp.js") || process.argv[1]?.endsWith("mcp-main.js")) {
  void main();
}
