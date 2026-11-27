// Engine photo field updates.
import type { Item, PhotoProps } from '../../model.js';
import { isColor, isMask, validFieldKey } from '../../names.js';
import { isSafeImageSrc, localSrcHint } from '../../sources.js';
import { fail } from '../../errors.js';
import { applyFilterField, needFor } from './common.js';

export function applyPhotoField(
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
    const ph = it.props as PhotoProps;
    if (applyFilterField(key, s, v, which, b, ph.filter)) return true;
    if (key === 'outlineColor') {
      need(0, 'text');
      if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
      ph.outlineColor = s;
      return true;
    }
    if (key === 'outlineWidth') {
      needNum();
      if (v < 0 || v > 100) fail('outlineWidth must be within 0..100');
      ph.outlineWidth = v;
      return true;
    }
    if (
      key === 'src' || key === 'field' || key === 'label' || key === 'mask' ||
      key === 'fit'
    ) {
      need(0, 'text');
      if (key === 'mask' && !isMask(s)) {
        fail('mask must be rect|circle|arch|star|blob|heart');
      }
      if (key === 'fit' && s !== 'cover' && s !== 'contain') {
        fail('fit must be cover|contain');
      }
      if (key === 'src') {
        if (s !== '' && !isSafeImageSrc(s)) fail(`bad image src '${s}'${localSrcHint(s)}`);
        ph.src = s;
      }
      else if (key === 'field') {
        if (!validFieldKey(s)) fail(`bad visitor field key '${s}'`);
        ph.field = s;
      } else if (key === 'label') ph.label = s;
      else if (key === 'fit') ph.fit = s;
      else ph.mask = s;
      return true;
    }
    if (key === 'cornerRadius') {
      needNum();
      if (v < 0 || v > 1000) fail('cornerRadius must be within 0..1000');
      ph.cornerRadius = v;
      return true;
    }
    if (key === 'edge') {
      needNum();
      if (v < 0 || v > 100) fail("field 'edge' must be within 0..100");
      ph.edge = v;
      return true;
    }
  return false;
}
