// Engine sticker, vector and image field updates.
import type { Item, StickerProps, ImageProps, VectorProps } from '../../model.js';
import { parseVector } from '../../vector.js';
import { isSafeImageSrc, localSrcHint } from '../../sources.js';
import { isColor, isStickerId } from '../../names.js';
import { fail } from '../../errors.js';
import { applyFilterField, applyShadow, needFor } from './common.js';

export function applyStickerField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): boolean {
    const { need } = needFor(key, which);
    const v = which === 3 ? i : n;
    const st = it.props as StickerProps;
    if (
      key === 'shadowColor' || key === 'shadowX' || key === 'shadowY' ||
      key === 'shadowBlur'
    ) {
      applyShadow(key, s, v, which, st);
      return true;
    }
    if (key === 'sticker' || key === 'tint') {
      need(0, 'text');
      if (key === 'sticker') {
        if (s === '') fail('sticker must not be empty');
        if (!isStickerId(s)) fail(`bad sticker id '${s}'`);
        st.sticker = s;
      } else {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        st.tint = s;
      }
      return true;
    }
    if (key === 'outlineColor') {
      need(0, 'text');
      if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
      st.outlineColor = s;
      return true;
    }
    if (key === 'outlineWidth') {
      if (which !== 1 && which !== 3) fail(`field '${key}' needs a number`);
      if (v < 0 || v > 100) fail('outlineWidth must be within 0..100');
      st.outlineWidth = v;
      return true;
    }
  return false;
}

// A vector takes a new svg (checked like on add) and every sticker look field.
export function applyVectorField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): boolean {
  if (key === 'sticker') return false;
  if (key === 'svg') {
    if (which !== 0) fail("field 'svg' needs text");
    parseVector(s);
    (it.props as VectorProps).svg = s;
    return true;
  }
  return applyStickerField(it, key, s, n, b, i, which);
}

export function applyImageField(
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
    const im = it.props as ImageProps;
    if (applyFilterField(key, s, v, which, b, im.filter)) return true;
    if (key === 'src' || key === 'fit') {
      need(0, 'text');
      if (key === 'fit' && s !== 'cover' && s !== 'contain') {
        fail('fit must be cover|contain');
      }
      if (key === 'src') {
        if (s === '') fail('src must not be empty');
        if (!isSafeImageSrc(s)) fail(`bad image src '${s}'${localSrcHint(s)}`);
        im.src = s;
      } else {
        im.fit = s;
      }
      return true;
    }
    if (key === 'cornerRadius') {
      needNum();
      if (v < 0 || v > 1000) fail('cornerRadius must be within 0..1000');
      im.cornerRadius = v;
      return true;
    }
  return false;
}
