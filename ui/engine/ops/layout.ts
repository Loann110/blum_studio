// Engine layout solver: stacks and anchors.
import type { Design, Item } from '../model.js';
import type { LayoutSpec } from './op.js';
import { canvasHeight, canvasWidth, safeMargins } from '../model.js';
import { findItem } from './lookup.js';

/* ---- layout solver ---- */

function gapPx(gap: string): number {
  if (gap === 'sm') return 24;
  if (gap === 'lg') return 80;
  return 48;
}

export function solveLayout(doc: Design, spec: LayoutSpec): string {
  const hasStack = spec.stack !== '';
  const hasAnchors = spec.anchors.size > 0;
  if (hasStack === hasAnchors) return 'arrange needs exactly one of stack or anchors';
  if (hasStack && spec.stack !== 'column' && spec.stack !== 'row') {
    return 'stack must be column|row';
  }
  if (spec.zone !== 'safe' && spec.zone !== 'canvas') {
    return 'zone must be safe|canvas';
  }
  const gap = gapPx(spec.gap);
  const w = canvasWidth(doc);
  const h = canvasHeight(doc);
  const m = safeMargins(doc);
  const box = spec.zone === 'canvas'
    ? { minX: 0, minY: 0, maxX: w, maxY: h }
    : { minX: m.sides, minY: m.top, maxX: w - m.sides, maxY: h - m.bottom };
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;

  if (hasAnchors) {
    for (const [id, at] of [...spec.anchors.keys()].map((k) => [k, spec.anchors.get(k) as string])) {
      const it = findItem(doc, id);
      if (!it) return `unknown item '${id}'`;
      if (it.locked) return `item '${id}' is locked`;
      if (at !== 'top' && at !== 'bottom' && at !== 'left' && at !== 'right' && at !== 'center') {
        return 'anchor must be top|bottom|left|right|center';
      }
      if (at === 'top') {
        it.x = cx;
        it.y = box.minY + it.height / 2;
      } else if (at === 'bottom') {
        it.x = cx;
        it.y = box.maxY - it.height / 2;
      } else if (at === 'left') {
        it.x = box.minX + it.width / 2;
        it.y = cy;
      } else if (at === 'right') {
        it.x = box.maxX - it.width / 2;
        it.y = cy;
      } else {
        it.x = cx;
        it.y = cy;
      }
    }
    return '';
  }

  if (spec.items.length < 2) return 'stack needs at least 2 items';
  const parts: Item[] = [];
  for (const id of spec.items) {
    const it = findItem(doc, id);
    if (!it) return `unknown item '${id}'`;
    if (it.locked) return `item '${id}' is locked`;
    parts.push(it);
  }
  const column = spec.stack === 'column';
  const align = spec.align === '' ? 'center' : spec.align;
  if (column && align !== 'left' && align !== 'center' && align !== 'right') {
    return 'column align must be left|center|right';
  }
  if (!column && align !== 'top' && align !== 'center' && align !== 'bottom') {
    return 'row align must be top|center|bottom';
  }

  let total = 0;
  for (const it of parts) total += column ? it.height : it.width;
  total += gap * (parts.length - 1);

  const span = column ? box.maxY - box.minY : box.maxX - box.minX;
  let cursor = column ? box.minY + (span - total) / 2 : box.minX + (span - total) / 2;
  if (total > span) cursor = column ? box.minY : box.minX;

  for (const it of parts) {
    if (column) {
      if (align === 'left') it.x = box.minX + it.width / 2;
      else if (align === 'right') it.x = box.maxX - it.width / 2;
      else it.x = cx;
      it.y = cursor + it.height / 2;
      cursor += it.height + gap;
    } else {
      if (align === 'top') it.y = box.minY + it.height / 2;
      else if (align === 'bottom') it.y = box.maxY - it.height / 2;
      else it.y = cy;
      it.x = cursor + it.width / 2;
      cursor += it.width + gap;
    }
  }
  return '';
}