// Engine name rules: colors, shapes, patterns, filter presets.
/* ---- name rules ---- */

export function isHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s);
}

function isAlnum(c: string): boolean {
  return (
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
  );
}

export function isColor(s: string): boolean {
  return isHexColor(s) || s.startsWith('rgba');
}

export function validFieldKey(s: string): boolean {
  if (s === '') return true;
  if (s.length > 64) return false;
  const first = s[0];
  if (!((first >= 'a' && first <= 'z') || (first >= 'A' && first <= 'Z'))) return false;
  for (const c of s) {
    if (!isAlnum(c) && c !== '_' && c !== '-') return false;
  }
  return true;
}

const SHAPES = new Set([
  'rect', 'ellipse', 'triangle', 'line', 'star', 'diamond', 'separator',
  'frame', 'rounded', 'polygon', 'arrow', 'doubleArrow', 'dotted', 'heart',
  'bubble', 'cross', 'trapezoid', 'parallelogram', 'ring', 'cloud', 'bolt',
  'blockArrow',
]);

export function isShapeName(s: string): boolean {
  return SHAPES.has(s);
}

export function isLineCap(s: string): boolean {
  return (
    s === 'none' || s === 'arrow' || s === 'triangle' || s === 'circle' ||
    s === 'square' || s === 'bar'
  );
}

const PATTERNS = new Set([
  'dots', 'grid', 'stripes', 'checker', 'waves', 'crosses', 'zigzag',
  'triangles', 'hexagons', 'diamonds', 'scallops', 'bricks', 'hearts', 'stars',
  'zellige', 'scales', 'arches',
]);

export function isPatternName(s: string): boolean {
  return PATTERNS.has(s);
}

export const FILTER_PRESETS = new Set([
  'original', 'vivid', 'warm', 'cold', 'mono', 'noir', 'faded', 'vintage',
  'dramatic',
]);

export const BLEND_MODES = new Set([
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

export function isBlendMode(s: string): boolean {
  return BLEND_MODES.has(s);
}

export const MASKS = new Set([
  'rect', 'circle', 'arch', 'star', 'blob', 'heart',
]);

export function isMask(s: string): boolean {
  return MASKS.has(s);
}