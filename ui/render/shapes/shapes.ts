// Every non-line shape drawn as SVG.
import type { ShapeProps } from '../types.js';
import { LINE_SHAPES, strokeAttrs } from './stroke.js';
import { lineShape } from './lines.js';

export function shapeSvg(
  shape: string,
  fill: string,
  w: number,
  h: number,
  stroke: string,
  strokeWidth: number,
  cornerRadius: number,
  points = 5,
  innerRatio = 0.42,
  sides = 6,
  lineProps: ShapeProps = {},
): string {
  const edge = strokeAttrs(stroke, strokeWidth);
  // A line is all edge: the stroke colour becomes the line itself, but only
  // while the stroke is actually drawn (width > 0, same rule as `edge`).
  // A zero-width stroke leaves the fill (flat or gradient) visible.
  const main = LINE_SHAPES.has(shape) && stroke && strokeWidth > 0 ? stroke : fill;
  switch (shape) {
    case 'ellipse':
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${edge}/>`;
    case 'triangle':
      return `<polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${fill}"${edge}/>`;
    case 'diamond':
      return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}"${edge}/>`;
    case 'star': {
      // Pointy-top star: `points` outer tips, inner corners at `innerRatio`.
      const n = Math.min(12, Math.max(3, Math.round(points) || 5));
      const ratio = innerRatio > 0 && innerRatio < 1 ? innerRatio : 0.42;
      let pts = '';
      for (let k = 0; k < 2 * n; k++) {
        const r = k % 2 === 0 ? 0.5 : 0.5 * ratio;
        const a = (Math.PI / n) * k - Math.PI / 2;
        pts += `${(0.5 + r * Math.cos(a)) * w},${(0.5 + r * Math.sin(a)) * h} `;
      }
      return `<polygon points="${pts.trim()}" fill="${fill}"${edge}/>`;
    }
    case 'heart': {
      const s = `M ${w / 2} ${h * 0.92} C ${w * 0.1} ${h * 0.6} 0 ${h * 0.42} 0 ${h * 0.28}`
        + ` C 0 ${h * 0.1} ${w * 0.16} 0 ${w * 0.3} 0 C ${w * 0.42} 0 ${w * 0.48} ${h * 0.08} ${w / 2} ${h * 0.2}`
        + ` C ${w * 0.52} ${h * 0.08} ${w * 0.58} 0 ${w * 0.7} 0 C ${w * 0.84} 0 ${w} ${h * 0.1} ${w} ${h * 0.28}`
        + ` C ${w} ${h * 0.42} ${w * 0.9} ${h * 0.6} ${w / 2} ${h * 0.92} Z`;
      return `<path d="${s}" fill="${fill}"${edge}/>`;
    }
    case 'line':
      return lineShape(main, lineProps, w, h, 'solid');
    case 'separator': {
      // A short row of dots, centred.
      const r = strokeWidth > 0 ? strokeWidth / 2 : 5;
      let dots = '';
      for (let k = 0; k < 5; k++) dots += `<circle cx="${w * (0.2 + 0.15 * k)}" cy="${h / 2}" r="${r}" fill="${main}"/>`;
      return dots;
    }
    case 'dotted':
      return lineShape(main, lineProps, w, h, 'dotted');
    case 'arrow':
    case 'doubleArrow':
      return lineShape(main, lineProps, w, h, 'solid');
    case 'blockArrow':
      return `<polygon points="0,${h * 0.32} ${w * 0.62},${h * 0.32} ${w * 0.62},${h * 0.1}`
        + ` ${w},${h / 2} ${w * 0.62},${h * 0.9} ${w * 0.62},${h * 0.68} 0,${h * 0.68}" fill="${main}"${edge}/>`;
    case 'frame': {
      // A stroke as wide as the box leaves no room for a hole: the frame
      // degrades to a solid box in the stroke colour, never to a
      // zero-size rect (which would paint nothing at all).
      if (strokeWidth >= Math.min(w, h)) {
        return `<rect width="${w}" height="${h}"`
          + ` fill="${stroke || main || fill}"/>`;
      }
      const t = strokeWidth > 0 ? strokeWidth : 6;
      const at = t / 2;
      const rx = cornerRadius > 0 ? cornerRadius : 0;
      return `<rect x="${at}" y="${at}" width="${w - t}" height="${h - t}" rx="${rx}"`
        + ` fill="${fill}"${strokeAttrs(stroke || main, t)}/>`;
    }
    case 'rounded':
      return `<rect width="${w}" height="${h}" fill="${fill}"${edge}/>`;
    case 'polygon': {
      // The default hexagon keeps its old corners; other side counts draw
      // a regular pointy-top polygon in the same box.
      const n = Math.min(12, Math.max(3, Math.round(sides) || 6));
      if (n === 6) {
        return `<polygon points="${w / 2},0 ${w},${h * 0.25} ${w},${h * 0.75}`
          + ` ${w / 2},${h} 0,${h * 0.75} 0,${h * 0.25}" fill="${fill}"${edge}/>`;
      }
      const at = (v: number): string => String(Math.round(v * 100) / 100);
      const pts: string[] = [];
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
        pts.push(`${at((0.5 + 0.5 * Math.cos(a)) * w)},${at((0.5 + 0.5 * Math.sin(a)) * h)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}"${edge}/>`;
    }
    case 'bubble': {
      const tail = `<polygon points="${w * 0.3},${h * 0.62} ${w * 0.22},${h * 0.95} ${w * 0.5},${h * 0.62}" fill="${fill}"${edge}/>`;
      return tail + `<rect x="${w * 0.05}" y="${h * 0.05}" width="${w * 0.9}" height="${h * 0.6}"`
        + ` rx="${h * 0.16}" fill="${fill}"${edge}/>`;
    }
    case 'cross':
      return `<polygon points="${w * 0.35},0 ${w * 0.65},0 ${w * 0.65},${h * 0.35}`
        + ` ${w},${h * 0.35} ${w},${h * 0.65} ${w * 0.65},${h * 0.65} ${w * 0.65},${h}`
        + ` ${w * 0.35},${h} ${w * 0.35},${h * 0.65} 0,${h * 0.65} 0,${h * 0.35}`
        + ` ${w * 0.35},${h * 0.35}" fill="${fill}"${edge}/>`;
    case 'trapezoid':
      return `<polygon points="${w * 0.25},0 ${w * 0.75},0 ${w},${h} 0,${h}" fill="${fill}"${edge}/>`;
    case 'parallelogram':
      return `<polygon points="${w * 0.3},0 ${w},0 ${w * 0.7},${h} 0,${h}" fill="${fill}"${edge}/>`;
    case 'ring': {
      // Same rule as the frame: a stroke that eats the hole turns the
      // ring into a solid disc in the stroke colour (a zero or negative
      // radius would paint nothing at all).
      const t = strokeWidth > 0 ? strokeWidth : 14;
      const r = Math.min(w, h) / 2 - t / 2;
      if (r <= 0) {
        return `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}"`
          + ` fill="${stroke || main || fill}"/>`;
      }
      return `<circle cx="${w / 2}" cy="${h / 2}" r="${r}"`
        + ` fill="${fill}"${strokeAttrs(stroke || main, t)}/>`;
    }
    case 'cloud': {
      const s = `M ${w * 0.28} ${h * 0.88} C ${w * 0.12} ${h * 0.88} ${w * 0.06} ${h * 0.76} ${w * 0.1} ${h * 0.66}`
        + ` C ${w * 0.02} ${h * 0.58} ${w * 0.08} ${h * 0.44} ${w * 0.2} ${h * 0.42}`
        + ` C ${w * 0.24} ${h * 0.28} ${w * 0.4} ${h * 0.22} ${w * 0.52} ${h * 0.28}`
        + ` C ${w * 0.62} ${h * 0.18} ${w * 0.8} ${h * 0.22} ${w * 0.84} ${h * 0.36}`
        + ` C ${w * 0.96} ${h * 0.38} ${w} ${h * 0.52} ${w * 0.92} ${h * 0.6}`
        + ` C ${w * 0.98} ${h * 0.7} ${w * 0.9} ${h * 0.88} ${w * 0.78} ${h * 0.88} Z`;
      return `<path d="${s}" fill="${fill}"${edge}/>`;
    }
    case 'bolt':
      return `<polygon points="${w * 0.55},0 ${w * 0.2},${h * 0.58} ${w * 0.45},${h * 0.58}`
        + ` ${w * 0.38},${h} ${w * 0.78},${h * 0.4} ${w * 0.52},${h * 0.4}" fill="${fill}"${edge}/>`;
    default:
      return `<rect width="${w}" height="${h}" fill="${fill}"${edge}/>`;
  }
}