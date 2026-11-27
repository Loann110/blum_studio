// Text rendering: styles, shadows and the text branch.
import type { DesignItem, TextProps } from '../types.js';
import { esc, hash, num } from '../util.js';
import { resolveColor } from '../colour.js';
import { curvedText } from './curved-text.js';
import { resolveSrc } from './photo.js';
import { fontStack, textCaseFilter } from './text-style.js';

/** `2px 3px 8px color`, or empty when the shadow is off. Lengths scale with the box. */
function textShadow(
  p: TextProps,
  u: (px: number) => string,
): string {
  if (!p.shadowColor) return '';
  const color = resolveColor(p.shadowColor, 'rgba(0,0,0,0.35)');
  return `${u(num(p.shadowX))} ${u(num(p.shadowY, 3))} ${u(num(p.shadowBlur, 8))} ${esc(color)}`;
}

/** `2px color` outline, or empty when the outline is off. Hollow falls back
 * to 2px in the text color, so hollow text without an outline stays visible. */
function textOutline(
  p: TextProps,
  u: (px: number) => string,
  ink: string,
): string {
  if (p.hollow === true && (!p.stroke || !(num(p.strokeWidth) > 0))) {
    return `${u(2)} ${esc(ink)}`;
  }
  if (!p.stroke || !(num(p.strokeWidth) > 0)) return '';
  return `${u(num(p.strokeWidth))} ${esc(resolveColor(p.stroke, '#ffffff'))}`;
}

/** `0 0 blur color` glow, or empty when the halo is off. */
function textHalo(
  p: TextProps,
  u: (px: number) => string,
  ink: string,
): string {
  if (!p.haloColor) return '';
  const color = esc(resolveColor(p.haloColor, ink));
  return `0 0 ${u(num(p.haloBlur, 14))} ${color}`;
}

/** Photo drawn through the glyphs, or empty when the text stays flat. */
function textPhotoFill(
  p: TextProps,
  assetsBase: string,
  mediaBase: string,
): string {
  const src = (p.textFill ?? '').trim();
  if (!src) return '';
  const url = resolveSrc(src, assetsBase, mediaBase);
  // Refused sources stay flat: transparent over no image would vanish.
  if (!url) return '';
  return `background-image:url("${esc(url)}");background-size:cover;background-position:center`
    + `;-webkit-background-clip:text;background-clip:text;color:transparent`;
}

/** Gradient clipped to the glyphs, or empty when the text stays flat. */
function gradientFill(p: TextProps): string {
  const g = p.gradient;
  if (!g || !Array.isArray(g.stops) || g.stops.length < 2) return '';
  const angle = Number.isFinite(Number(g.angle)) ? Number(g.angle) : 180;
  const stops = g.stops
    .map((s) => `${esc(resolveColor(String(s?.color ?? ''), '#000'))} ${(Number(s?.at) * 100).toFixed(1)}%`)
    .join(',');
  if (!stops) return '';
  // Radial text ignores the angle: a round halo clipped to the glyphs.
  const head = g.radial ? 'radial-gradient(circle' : `linear-gradient(${angle}deg`;
  return `background:${head},${stops});-webkit-background-clip:text;background-clip:text;color:transparent`;
}

/** Flat body: one span, or a list when bullets/numbers are on. */
function textLines(p: TextProps): string {
  const lines = String(p.text ?? '').split('\n');
  if (p.list !== 'bullet' && p.list !== 'numbered') return esc(p.text ?? '');
  const tag = p.list === 'bullet' ? 'ul' : 'ol';
  const items = lines.map((line) => `<li>${esc(line) || '<br>'}</li>`).join('');
  return `<${tag}>${items}</${tag}>`;
}

export function textMarkup(
  item: DesignItem,
  p: TextProps,
  u: (px: number) => string,
  assetsBase: string,
  mediaBase: string,
  w: number,
  h: number,
  base: string,
): string {
    const ink = esc(resolveColor(p.color, '#111111'));
    const deco: string[] = [];
    if (p.decoration === 'underline') deco.push('underline');
    if (p.strikethrough) deco.push('line-through');
    const style = [
      base,
      `font-family:${fontStack(p.font)}`,
      `font-size:${u(num(p.size, 64))}`,
      `font-weight:${num(p.weight, 400) || 400}`,
      `font-style:${p.italic ? 'italic' : 'normal'}`,
      `color:${p.hollow === true ? 'transparent' : ink}`,
      `text-align:${['left', 'center', 'right', 'justify'].includes(p.align || '') ? p.align : 'left'}`,
      `line-height:${num(p.lineHeight, 1.2) || 1.2}`,
      `letter-spacing:${u(num(p.letterSpacing))}`,
      `text-transform:${textCaseFilter(p.textCase)}`,
    ];
    if (deco.length > 0) style.push(`text-decoration:${deco.join(' ')}`);
    const glows = [textHalo(p, u, ink), textShadow(p, u)]
      .filter((layer) => layer !== '');
    if (glows.length > 0) style.push(`text-shadow:${glows.join(',')}`);
    const outline = textOutline(p, u, ink);
    if (outline) style.push(`-webkit-text-stroke:${outline}`);
    // Torn edge: fixed-seed turbulence, same recipe as photos and shapes.
    const edgeAmt = num(p.edge);
    const edgeId = `bEdgeT${Math.abs(hash(String(item.id ?? '')))}`;
    const edgeDefs = edgeAmt > 0
      ? `<svg width="0" height="0" style="position:absolute"><filter id="${edgeId}" x="-30%" y="-30%" width="160%" height="160%">`
        + `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="n"/>`
        + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${edgeAmt}" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`
      : '';
    if (edgeAmt > 0) style.push(`filter:url(#${edgeId})`);
    const curved = p.curve === 'up' || p.curve === 'down';
    const listed = p.list === 'bullet' || p.list === 'numbered';
    if (p.background && (curved || listed)) {
      // Behind the whole box: an inline span cannot wrap a block list or an SVG arc.
      style.push(`background:${esc(resolveColor(p.background, 'transparent'))}`);
    } else if (!curved && p.background) {
      const span = ` style="background:${esc(resolveColor(p.background, 'transparent'))}"`;
      return `${edgeDefs}<div class="bText" style="${esc(style.join(';'))}"><span${span}>${textLines(p)}</span></div>`;
    }
    const body = curved ? curvedText(item, p, w, h) : textLines(p);
    const photo = textPhotoFill(p, assetsBase, mediaBase);
    if (!curved && photo) {
      // Photo text: the image shows through the glyphs, the flat color drops out.
      return `${edgeDefs}<div class="bText" style="${esc(style.join(';'))}"><span style="${esc(photo)}">${body}</span></div>`;
    }
    const fill = gradientFill(p);
    if (!curved && fill) {
      // Gradient text: the gradient clips to the glyphs, the flat color drops out.
      return `${edgeDefs}<div class="bText" style="${esc(style.join(';'))}"><span style="${esc(fill)}">${body}</span></div>`;
    }
    return `${edgeDefs}<div class="bText" style="${esc(style.join(';'))}"><span>${body}</span></div>`;
}
