// Curved text on an SVG arc.
import type { DesignItem, TextProps } from '../types.js';
import { esc, hash, num } from '../util.js';
import { resolveColor } from '../colour.js';
import { fontStack, textCaseFilter } from './text-style.js';

/** Box height a curved text needs: its lines, the arc rise and the letters' height. */
export function curvedTextHeight(p: TextProps): number {
  const size = Math.max(1, num(p.size, 64));
  const lh = size * (num(p.lineHeight, 1.2) || 1.2);
  const lines = String(p.text ?? '').split(/\n/).length;
  return Math.ceil((lines - 1) * lh + Math.max(0, num(p.curveAmount, 32)) + size * 1.2 + 12);
}

/**
 * Curved text: every line rides its own arc (SVG textPath), so the editor
 * and the PNG export draw the same pixels. `up` lifts the middle, `down`
 * sags it; the apex rises by curveAmount design px.
 */
export function curvedText(
  item: DesignItem,
  p: TextProps,
  w: number,
  h: number,
): string {
  const amount = Math.max(0, num(p.curveAmount, 32));
  const dir = p.curve === 'down' ? 1 : -1;
  const size = Math.max(1, num(p.size, 64));
  const lh = size * (num(p.lineHeight, 1.2) || 1.2);
  const lines = String(p.text ?? '').split('\n');
  // Centre the whole curved band (arc rise + ascender + descender) in the box,
  // so the frame (sized by curvedTextHeight) wraps the letters on both sides.
  const mid = h / 2 - ((lines.length - 1) * lh) / 2 - (dir * amount) / 2 + size * 0.35;
  const pad = Math.max(1, Math.min(w / 2 - 1, size * 0.25));
  const ink = esc(resolveColor(p.color, '#111111'));
  const color = p.hollow === true ? 'none' : ink;
  const outlined = p.stroke != null && String(p.stroke) !== '' && num(p.strokeWidth) > 0;
  const edge = outlined
    ? { color: esc(resolveColor(p.stroke, '#ffffff')), width: num(p.strokeWidth) }
    : p.hollow === true
      ? { color: ink, width: 2 }
      : null;
  const ls = num(p.letterSpacing);
  const shadowOn = !!p.shadowColor;
  const haloOn = p.haloColor != null && String(p.haloColor) !== '';
  const filterId = `sh${Math.abs(hash(`shadow${item.id}`))}`;
  const defs = shadowOn || haloOn
    ? `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">`
      + (shadowOn
        ? `<feDropShadow dx="${num(p.shadowX)}" dy="${num(p.shadowY, 3)}"`
          + ` stdDeviation="${num(p.shadowBlur, 8) / 2}"`
          + ` flood-color="${esc(resolveColor(p.shadowColor, 'rgba(0,0,0,0.35)'))}"/>`
        : '')
      + (haloOn
        ? `<feDropShadow dx="0" dy="0"`
          + ` stdDeviation="${num(p.haloBlur, 14) / 2}"`
          + ` flood-color="${esc(resolveColor(p.haloColor, ink))}"/>`
        : '')
      + `</filter>`
    : '';
  const parts = [defs];
  lines.forEach((line, i) => {
    const y = mid + i * lh;
    // Quadratic apex sits halfway to the control point: twice the amount.
    const d = `M ${pad},${y} Q ${w / 2},${y + dir * 2 * amount} ${w - pad},${y}`;
    const pid = `cv${Math.abs(hash(`${item.id}:${i}`))}`;
    parts.push(`<defs><path id="${pid}" d="${d}" fill="none"/></defs>`);
    const attrs = [
      `font-family="${fontStack(p.font)}"`,
      `font-size="${size}"`,
      `font-weight="${num(p.weight, 400) || 400}"`,
      `font-style="${p.italic ? 'italic' : 'normal'}"`,
      `fill="${color}"`,
      `text-anchor="middle"`,
      `letter-spacing="${ls}"`,
      `style="text-transform:${textCaseFilter(p.textCase)}"`,
    ];
    if (p.decoration === 'underline' || p.strikethrough) {
      const bits = [
        p.decoration === 'underline' ? 'underline' : '',
        p.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ');
      attrs.push(`text-decoration="${bits}"`);
    }
    if (edge) {
      attrs.push(`stroke="${edge.color}"`);
      attrs.push(`stroke-width="${edge.width}"`);
      attrs.push(`paint-order="stroke"`);
    }
    if (shadowOn || haloOn) attrs.push(`filter="url(#${filterId})"`);
    parts.push(`<text ${attrs.join(' ')}><textPath href="#${pid}" startOffset="50%">${esc(line)}</textPath></text>`);
  });
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"`
    + ` style="overflow:visible;display:block;width:100%;height:100%">${parts.join('')}</svg>`;
}
