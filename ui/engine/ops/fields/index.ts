// Engine fields: applyField dispatched by item kind.
import type { Item, Paint, ShapeProps } from '../../model.js';
import type { FieldPatch } from '../op.js';
import { isColor } from '../../names.js';
import { EngineError, fail } from '../../errors.js';
import { applyCommonField } from './common.js';
import { applyTextField } from './text.js';
import { applyShapeField } from './shape.js';
import { applyPhotoField } from './photo.js';
import { applyImageField, applyStickerField, applyVectorField } from './media.js';
import { applyGroupField } from './group.js';

function applyOne(id: string, apply: () => void): void {
  try {
    apply();
  } catch (e) {
    if (e instanceof EngineError) fail(`update '${id}': ${e.message}`);
    throw e;
  }
}

function ordered<V>(map: Map<string, V>): Array<[string, V]> {
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function applyPatch(it: Item, id: string, patch: FieldPatch): void {
  for (const [k, v] of ordered(patch.strings)) applyOne(id, () => applyField(it, k, v, 0, false, 0, 0));
  for (const [k, v] of ordered(patch.numbers)) applyOne(id, () => applyField(it, k, '', v, false, 0, 1));
  for (const [k, v] of ordered(patch.bools)) applyOne(id, () => applyField(it, k, '', 0, v, 0, 2));
  for (const [k, v] of ordered(patch.ints)) applyOne(id, () => applyField(it, k, '', 0, false, v, 3));
  for (const [k, v] of ordered(patch.paints)) applyOne(id, () => applyPaintField(it, k, v));
}

// which: 0 = string, 1 = number, 2 = bool, 3 = int.
export function applyField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): void {
  if (applyCommonField(it, key, s, n, b, i, which)) return;
  if (it.type === 'text') {
    if (applyTextField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'shape') {
    if (applyShapeField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'photo') {
    if (applyPhotoField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'sticker') {
    if (applyStickerField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'vector') {
    if (applyVectorField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'image') {
    if (applyImageField(it, key, s, n, b, i, which)) return;
  } else if (it.type === 'group') {
    if (applyGroupField(it, key, s, n, b, i, which)) return;
  }
  fail(`unknown field '${key}' for this item type`);
}

export function applyPaintField(it: Item, key: string, p: Paint): void {
  if (key === 'gradient') {
    if (it.type !== 'text') fail("field 'gradient' needs a text item");
    const g = p.gradient;
    if (!g || g.stops.length < 2) fail('text gradient needs {angle, stops} with at least 2 stops');
    for (const s of g.stops) {
      if (s.at < 0 || s.at > 1) fail('text gradient stop out of 0..1');
      if (!isColor(s.color)) fail(`bad text gradient color '${s.color}'`);
    }
    if (!Number.isFinite(g.angle)) fail('bad text gradient angle');
    (it.props as { gradient: unknown }).gradient = {
      angle: g.angle,
      ...(g.radial ? { radial: true } : {}),
      stops: g.stops.map((s) => ({ ...s })),
    };
    return;
  }
  if (key !== 'fill') fail(`unknown paint field '${key}'`);
  if (it.type !== 'shape') fail("field 'fill' needs a shape item");
  const sh = it.props as ShapeProps;
  if (p.gradient) {
    if (p.gradient.stops.length < 2) {
      fail('gradient fill needs at least 2 stops');
    }
    for (const s of p.gradient.stops) {
      if (s.at < 0 || s.at > 1) fail('gradient fill stop out of 0..1');
      if (!isColor(s.color)) fail(`bad gradient fill color '${s.color}'`);
    }
    if (!Number.isFinite(p.gradient.angle)) fail('bad gradient fill angle');
  } else if (!isColor(p.color)) {
    fail(`bad color '${p.color}'`);
  }
  sh.fill = p;
}
