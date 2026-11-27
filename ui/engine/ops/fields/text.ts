// Engine text field updates.
import type { Item, TextProps } from '../../model.js';
import { isColor, isFontName, validFieldKey } from '../../names.js';
import { isSafeImageSrc } from '../../sources.js';
import { fail } from '../../errors.js';
import { needFor } from './common.js';

export function applyTextField(
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
    const t = it.props as TextProps;
    if (
      key === 'text' || key === 'font' || key === 'align' || key === 'color' ||
      key === 'decoration' || key === 'textCase' || key === 'background' ||
      key === 'list' || key === 'curve' || key === 'shadowColor' ||
      key === 'stroke' || key === 'haloColor' || key === 'field' ||
      key === 'label' || key === 'textFill'
    ) {
      need(0, 'text');
      if (key === 'text') t.text = s;
      else if (key === 'font') {
        if (s === '') fail('font must not be empty');
        if (!isFontName(s)) fail(`bad font '${s}'`);
        t.font = s;
      } else if (key === 'align') {
        if (s !== 'left' && s !== 'center' && s !== 'right' && s !== 'justify') {
          fail('align must be left|center|right|justify');
        }
        t.align = s;
      } else if (key === 'color') {
        if (!isColor(s)) fail(`bad color '${s}'`);
        t.color = s;
      } else if (key === 'decoration') {
        if (s !== 'none' && s !== 'underline') {
          fail('decoration must be none|underline');
        }
        t.decoration = s;
      } else if (key === 'textCase') {
        if (s !== 'none' && s !== 'upper' && s !== 'lower' && s !== 'title') {
          fail('textCase must be none|upper|lower|title');
        }
        t.textCase = s;
      } else if (key === 'list') {
        if (s !== 'none' && s !== 'bullet' && s !== 'numbered') {
          fail('list must be none|bullet|numbered');
        }
        t.list = s;
      } else if (key === 'curve') {
        if (s !== 'none' && s !== 'up' && s !== 'down') {
          fail('curve must be none|up|down');
        }
        t.curve = s;
      } else if (key === 'shadowColor') {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        t.shadowColor = s;
      } else if (key === 'stroke') {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        t.stroke = s;
      } else if (key === 'haloColor') {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        t.haloColor = s;
      } else if (key === 'field') {
        if (!validFieldKey(s)) fail(`bad visitor field key '${s}'`);
        t.field = s;
      } else if (key === 'label') {
        t.label = s;
      } else if (key === 'textFill') {
        if (s !== '' && !isSafeImageSrc(s)) fail(`bad textFill '${s}'`);
        t.textFill = s;
      } else {
        if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
        t.background = s;
      }
      return true;
    }
    if (
      key === 'size' || key === 'lineHeight' || key === 'letterSpacing' ||
      key === 'curveAmount' || key === 'minSize' || key === 'shadowX' ||
      key === 'shadowY' || key === 'shadowBlur' || key === 'strokeWidth' ||
      key === 'haloBlur' || key === 'edge'
    ) {
      needNum();
      if (key === 'size') {
        if (!(v > 0) || v > 1000) fail('size must be within 0..1000');
        t.size = v;
      } else if (key === 'lineHeight') {
        if (v < 0.5 || v > 4) fail('lineHeight must be within 0.5..4');
        t.lineHeight = v;
      } else if (key === 'curveAmount') {
        if (v < 0 || v > 400) fail('curveAmount must be within 0..400');
        t.curveAmount = v;
      } else if (key === 'minSize') {
        if (!(v > 0) || v > 1000) fail('minSize must be within 0..1000');
        t.minSize = v;
      } else if (key === 'shadowX' || key === 'shadowY') {
        if (v < -500 || v > 500) {
          fail(`field '${key}' must be within -500..500`);
        }
        if (key === 'shadowX') t.shadowX = v;
        else t.shadowY = v;
      } else if (key === 'shadowBlur') {
        if (v < 0 || v > 200) fail('shadowBlur must be within 0..200');
        t.shadowBlur = v;
      } else if (key === 'haloBlur') {
        if (v < 0 || v > 200) fail('haloBlur must be within 0..200');
        t.haloBlur = v;
      } else if (key === 'strokeWidth') {
        if (v < 0 || v > 60) fail('strokeWidth must be within 0..60');
        t.strokeWidth = v;
      } else if (key === 'edge') {
        if (v < 0 || v > 100) fail("field 'edge' must be within 0..100");
        t.edge = v;
      } else {
        t.letterSpacing = v;
      }
      return true;
    }
    if (
      key === 'italic' || key === 'strikethrough' || key === 'shrinkToFit' ||
      key === 'hollow'
    ) {
      need(2, 'true/false');
      if (key === 'italic') t.italic = b;
      else if (key === 'strikethrough') t.strikethrough = b;
      else if (key === 'hollow') t.hollow = b;
      else t.shrinkToFit = b;
      return true;
    }
    if (key === 'weight') {
      need(3, 'a number');
      if (i < 100 || i > 900) fail('weight must be within 100..900');
      t.weight = i;
      return true;
    }
  return false;
}
