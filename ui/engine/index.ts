// Blum TS engine: same behaviour as blumcore, no DOM, no Node-only API.
// The editor bundle and Node import it alike.
import type { Finding, LintReport } from './lint/lint.js';
import { compositionNotes as compositionNotesModel, lintModel } from './lint/lint.js';
import type { Design } from './model.js';
import { validateModel } from './validate.js';
import type { Guide, SnapResult } from './geometry.js';
import { snapMove } from './geometry.js';
import type { Op } from './ops/op.js';
import { EngineError } from './errors.js';
import { applyOpsModel } from './ops/apply.js';
import { designToJson } from './json/write.js';
import { findItem } from './ops/lookup.js';
import { parseDesign } from './json/read.js';
import { parseOp } from './ops/op.js';

export { EngineError };
export type { Design, Finding, Guide, LintReport, Op, SnapResult };
export type { Item, ItemType, Props } from './model.js';
export {
  CUSTOM,
  CUSTOM_MAX,
  CUSTOM_MIN,
  EXPORT_DPI,
  FORMATS,
  PRINT_DPI,
  findFormat,
  pageOf,
  validCustom,
  type PageFormat,
} from './formats.js';
export { applyCase, careScore } from './lint/lint.js';

/* ---- blumcore parity ---- */

export type DesignJson = Record<string, unknown>;
export type OpJson = Record<string, unknown>;

export interface LintJson {
  findings: Finding[];
  score: number;
}

export interface SnapJson {
  dx: number;
  dy: number;
  guides: Guide[];
}

type Json = Record<string, unknown>;

// Apply ops onto a copy; the input is never modified. Throws EngineError
// with the same message blumcore raises as ValueError.
export function applyOps(design: DesignJson, ops: OpJson[]): DesignJson {
  const doc: Design = parseDesign(design as Json);
  const parsed: Op[] = (ops as Json[]).map((o) => parseOp(o));
  applyOpsModel(doc, parsed);
  return designToJson(doc) as DesignJson;
}

// Every problem with a design, empty when valid.
export function validateDesign(design: DesignJson): string[] {
  return validateModel(parseDesign(design as Json));
}

// Design checks plus a 0..100 care score.
export function lintDesign(design: DesignJson): LintJson {
  return lintModel(parseDesign(design as Json));
}

// Notes on a finished page (empty band), added by check_design only.
export function compositionNotes(design: DesignJson): LintJson['findings'] {
  return compositionNotesModel(parseDesign(design as Json));
}

// Snap a drag against siblings and canvas; returns the fixed delta.
export function snapMoveAt(
  design: DesignJson,
  itemId: string,
  dx: number,
  dy: number,
): SnapJson {
  const doc = parseDesign(design as Json);
  const it = findItem(doc, itemId);
  if (!it) throw new EngineError(`unknown item '${itemId}'`);
  return snapMove(doc, it, dx, dy);
}
