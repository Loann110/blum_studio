// Page background style (gradient, pattern, image, flat).
import type { Design } from '../types.js';
import { esc, num } from '../util.js';
import { resolveColor } from '../colour.js';
import { patternBits } from './patterns.js';
import { resolveSrc } from '../items/photo.js';

export function backgroundStyle(
  design: Design,
  assetsBase: string,
  mediaBase: string,
  u: (px: number) => string,
): string {
  const bg = design.background ?? { kind: 'color', color: '#ffffff' };
  if (bg.kind === 'gradient' && Array.isArray(bg.stops) && bg.stops.length >= 2) {
    const stops = bg.stops
      .map((s) => `${resolveColor(s.color, '#000')} ${num(s.at) * 100}%`)
      .join(', ');
    if (bg.radial) return `background:radial-gradient(circle, ${stops})`;
    return `background:linear-gradient(${num(bg.angle, 135)}deg, ${stops})`;
  }
  const bits = patternBits(design, u);
  if (bits) {
    return `background-color:${bits.wash};background-image:${bits.url}`
      + `;background-size:${bits.size}${bits.tilt}`;
  }
  if (bg.kind === 'image' && bg.image) {
    const src = resolveSrc(bg.image, assetsBase, mediaBase);
    const wash = resolveColor(bg.color, '#ffffff');
    return src
      ? `background-color:${wash};background-image:url("${esc(src)}")`
        + `;background-size:cover;background-position:center`
      : `background:${wash}`;
  }
  return `background:${resolveColor(bg.color, '#ffffff')}`;
}

/** Film grain over the background only (never over the items): an SVG
 * turbulence tile, or empty when grain is off. */
export function grainOverlay(
  design: Design,
  u: (px: number) => string,
): string {
  const grain = num(design.background?.grain);
  if (!(grain > 0)) return '';
  const tile = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E`
    + `%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E`
    + `%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/%3E%3C/filter%3E`
    + `%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;
  const style = `background-image:${tile};background-size:${u(160)};opacity:${Math.min(1, grain / 100)}`;
  return `<div class="bGrain" style="${esc(style)}"></div>`;
}
