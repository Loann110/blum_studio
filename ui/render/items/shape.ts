// Shape rendering: drop shadows and the shape branch.
import type { DesignItem, ShapeProps } from '../types.js';
import { esc, hash, num } from '../util.js';
import { resolveColor } from '../colour.js';
import { shapeSvg } from '../shapes/shapes.js';

interface ShadowProps {
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
}

/** `drop-shadow(x y blur color)` over the whole box, or empty when off.
 * Unlike the box shadow it follows the painted shape, not the rectangle. */

export /** `drop-shadow(x y blur color)` over the whole box, or empty when off.
 * Unlike the box shadow it follows the painted shape, not the rectangle. */
function dropShadow(
  p: ShadowProps,
  u: (px: number) => string,
): string {
  if (!p.shadowColor) return '';
  const color = resolveColor(p.shadowColor, 'rgba(0,0,0,0.35)');
  return `drop-shadow(${u(num(p.shadowX))} ${u(num(p.shadowY, 3))}`
    + ` ${u(num(p.shadowBlur, 8))} ${esc(color)})`;
}

export function shapeMarkup(
  item: DesignItem,
  p: ShapeProps,
  u: (px: number) => string,
  w: number,
  h: number,
  base: string,
): string {
    let fill = '#111111';
    let defs = '';
    let fillRef = '';
    if (typeof p.fill === 'string') {
      fill = resolveColor(p.fill, '#111111');
      fillRef = esc(fill);
    } else if (p.fill && Array.isArray(p.fill.stops)) {
      const id = `g${Math.abs(hash(fill + item.id))}`;
      const stops = (p.fill.stops ?? [])
        .map(
          (s) =>
            `<stop offset="${num(s.at)}" stop-color="${esc(resolveColor(s.color, '#000'))}"/>`,
        )
        .join('');
      // Same convention as the CSS background: 0deg points up, 180deg down, 135deg (default) to the bottom right.
      const rad = (num(p.fill.angle, 135) * Math.PI) / 180;
      const dx = Math.sin(rad) / 2;
      const dy = -Math.cos(rad) / 2;
      const at = (v: number): string => v.toFixed(4);
      // Radial fills ignore the angle: a round halo from the box center.
      const paint = p.fill.radial
        ? `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`
        : `<linearGradient id="${id}" x1="${at(0.5 - dx)}" y1="${at(0.5 - dy)}" x2="${at(0.5 + dx)}" y2="${at(0.5 + dy)}">${stops}</linearGradient>`;
      defs = `<defs>${paint}</defs>`;
      fillRef = `url(#${id})`;
    }
    // Rounded corners on the box itself: the stretched 100x100 viewBox would make SVG rx oval.
    const radius = num(p.cornerRadius);
    const square = ['rect', 'rounded', ''].includes(p.shape ?? '');
    const round = square && radius > 0 ? `;border-radius:${u(radius)};overflow:hidden` : '';
    // Stroke and corner radius reach the SVG in viewBox units (the box is 100 wide).
    const stroke = typeof p.stroke === 'string' && p.stroke
      ? resolveColor(p.stroke, '')
      : '';
    // Drawn in the box's own design px (viewBox = box): strokes, corners and
    // arrowheads keep their size on any box instead of being stretched.
    const swUnits = num(p.strokeWidth) > 0 ? num(p.strokeWidth) : 0;
    const crUnits = num(p.cornerRadius) > 0 ? num(p.cornerRadius) : 0;
    const svg = shapeSvg(p.shape || 'rect', fillRef || esc(fill), w, h,
      stroke ? esc(stroke) : '', swUnits, crUnits,
      num(p.points, 5), num(p.innerRatio, 0.42), num(p.sides, 6), p);
    const shadow = dropShadow(p, u);
    const shadowStyle = shadow ? `;filter:${shadow}` : '';
    // Torn edge: same fixed-seed turbulence as photos, on the whole shape.
    const edgeAmt = num(p.edge);
    const edgeId = `bEdge${Math.abs(hash(item.id))}`;
    const edgeAttr = edgeAmt > 0 ? ` filter="url(#${edgeId})"` : '';
    if (edgeAmt > 0) {
      defs = `<filter id="${edgeId}" x="-30%" y="-30%" width="160%" height="160%">`
        + `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="n"/>`
        + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${edgeAmt}" xChannelSelector="R" yChannelSelector="G"/></filter>`
        + defs;
    }
    return `<div class="bShape" style="${esc(base + round + shadowStyle)}"><svg viewBox="0 0 ${w} ${h}"`
      + ` preserveAspectRatio="none"${edgeAttr}>${defs}${svg}</svg></div>`;
}
