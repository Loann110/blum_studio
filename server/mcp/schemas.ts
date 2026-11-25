
// MCP input schemas. The engine remains responsible for document validation.
import { z } from "zod";

export const designId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/);
export const itemId = z.string().min(1);
export const designIds = z.array(designId).min(1).max(12);
export const regionSchema = z.array(z.number()).length(4);

const itemSchema = z.object({
  id: itemId,
  type: z.enum(["text", "shape", "image", "sticker", "vector", "photo", "group"]),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  angle: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  blend: z.string().optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

const operationSchema = z.object({
  op: z.enum(["add", "update", "remove", "reorder", "duplicate", "lock", "group", "ungroup", "align", "distribute", "set_background", "arrange"]),
  id: itemId.optional(),
  item: itemSchema.optional(),
  patch: z.record(z.string(), z.unknown()).optional(),
  ids: z.array(itemId).optional(),
  name: z.string().optional(),
  to: z.string().optional(),
  index: z.number().int().optional(),
  align: z.string().optional(),
  locked: z.boolean().optional(),
  background: z.record(z.string(), z.unknown()).optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const operationsSchema = z.array(operationSchema).min(1);
