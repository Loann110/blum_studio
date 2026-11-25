// Engine shape field updates.
import type { Item, ShapeProps } from '../../model.js';
import { isColor, isLineCap, isShapeName } from '../../names.js';
import { fail } from '../../errors.js';
import { applyShadow, needFor } from './common.js';

export function applyShapeField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): boolean {
    const { need, needNum } = needFor(key, which);
    const v = which === 3 ? i : n;
    const sh = it.props as ShapeProps;
    if (
      key === 'shadowColor' || key === 'shadowX' || key === 'shadowY' ||
      key === 'shadowBlur'
    ) {
      applyShadow(key, s, v, which, sh);
      return true;
    }
    if (
      key === 'fill' || key === 'stroke' || key === 'shape' ||
      key === 'lineStyle' || key === 'startCap' || key === 'endCap'
    ) {
      need(0, 'text');
      if (key === 'fill') {
        if (!isColor(s)) fail(`bad color '${s}'`);
        sh.fill = { color: s, gradient: null };
      } else if (key === 'stroke') {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        sh.stroke = s;
      } else if (key === 'startCap' || key === 'endCap') {
        if (s !== '' && !isLineCap(s)) {
          fail(`${key} must be none|arrow|triangle|circle|square|bar`);
        }
        if (key === 'startCap') sh.startCap = s;
        else sh.endCap = s;
      } else if (key === 'lineStyle') {
        if (s !== 'solid' && s !== 'dashed' && s !== 'dotted') {
          fail('lineStyle must be solid|dashed|dotted');
        }
        sh.lineStyle = s;
      } else {
        if (!isShapeName(s)) fail(`shape must be a known shape, got '${s}'`);
        sh.shape = s;
      }
      return true;
    }
    if (
      key === 'strokeWidth' || key === 'cornerRadius' || key === 'bend' ||
      key === 'headSize' || key === 'innerRatio' || key === 'edge'
    ) {
      needNum();
      if (key === 'strokeWidth' || key === 'cornerRadius') {
        if (v < 0 || v > 500) fail(`field '${key}' must be within 0..500`);
        if (key === 'strokeWidth') sh.strokeWidth = v;
        else sh.cornerRadius = v;
      } else if (key === 'edge') {
        if (v < 0 || v > 100) fail("field 'edge' must be within 0..100");
        sh.edge = v;
      } else if (key === 'bend') {
        if (v < -1 || v > 1) fail('bend must be within -1..1');
        sh.bend = v;
      } else if (key === 'headSize') {
        if (v < 0 || v > 500) fail('headSize must be within 0..500');
        sh.headSize = v;
      } else {
        if (v < 0.1 || v > 0.95) fail('innerRatio must be within 0.1..0.95');
        sh.innerRatio = v;
      }
      return true;
    }
    if (key === 'points' || key === 'sides') {
      needNum();
      if (!Number.isInteger(v) || v < 3 || v > 12) {
        fail(`field '${key}' must be a whole number within 3..12`);
      }
      if (key === 'points') sh.points = v;
      else sh.sides = v;
      return true;
    }
  return false;
}
