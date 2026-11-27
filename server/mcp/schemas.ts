
// MCP input schemas. The engine remains responsible for document validation.
import { z } from "zod";

export const designId = z.string();
export const itemId = z.string();
export const designIds = z.array(designId);
export const regionSchema = z.array(z.number());

const itemSchema = z.object({
  id: itemId,
  type: z.string(),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  angle: z.number().optional(),
  opacity: z.number().optional(),
  blend: z.string().optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

const operationSchema = z.object({
  op: z.string(),
  id: itemId.optional(),
  item: itemSchema.optional(),
  patch: z.record(z.string(), z.unknown()).optional(),
  ids: z.array(itemId).optional(),
  name: z.string().optional(),
  to: z.string().optional(),
  index: z.number().optional(),
  align: z.string().optional(),
  locked: z.boolean().optional(),
  background: z.record(z.string(), z.unknown()).optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const operationsSchema = z.array(operationSchema);
