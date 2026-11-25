// Canva-like lines: geometry, caps and the line shape.
import type { ShapeProps } from '../types.js';
import { num } from '../util.js';
import { lineDash } from './stroke.js';

/** Shapes drawn as a line with an end cap at each end. */
export const LINE_KINDS = new Set(['line', 'dotted', 'arrow', 'doubleArrow']);

export type LineCap = 'none' | 'arrow' | 'triangle' | 'circle' | 'square' | 'bar';

export interface LineGeometry {
  /** Ends of the chord, in box px. */
  x1: number;
  x2: number;
  chordY: number;
  /** Top of the arc (the bend handle sits there) and the quadratic control. */
  apexY: number;
  controlY: number;
  /** Thickness, cap size, and the box height the line needs. */
  t: number;
  cap: number;
  needH: number;
}

/** The caps a line draws: its own choice, else the shape's default. */
export function lineCaps(shape: string, start?: string, end?: string): [LineCap, LineCap] {
  const own: [LineCap, LineCap] = shape === 'arrow'
    ? ['none', 'triangle']
    : shape === 'doubleArrow' ? ['triangle', 'triangle'] : ['none', 'none'];
  return [(start || own[0]) as LineCap, (end || own[1]) as LineCap];
}

/**
 * Where a line lies in its box. The arc rise is `bend` x half the chord
 * (bend 1: a half-circle feel), and the chord sits so that the arc band is
 * centred: the box height `needH` wraps the line and its caps exactly.
 */
export function lineGeometry(p: ShapeProps, w: number, h: number): LineGeometry {
  const shape = String(p.shape ?? 'line');
  const t = num(p.strokeWidth) > 0 ? num(p.strokeWidth) : shape === 'dotted' ? 5 : 4;
  const [start, end] = lineCaps(shape, p.startCap, p.endCap);
  const cap = num(p.headSize) > 0 ? num(p.headSize) : Math.max(3 * t, 12);
  const capped = start !== 'none' || end !== 'none';
  const reach = (capped ? Math.max(t, cap * 0.9) : t) / 2 + 2;
  const pad = capped ? Math.max(t / 2, cap / 2) + 1 : t / 2 + 1;
  const x1 = Math.min(pad, w / 2);
  const x2 = Math.max(w - pad, w / 2);
  const rise = Math.max(-1, Math.min(1, num(p.bend))) * ((x2 - x1) / 2);
  const chordY = h / 2 + rise / 2;
  return { x1, x2, chordY, apexY: chordY - rise, controlY: chordY - 2 * rise, t, cap, needH: Math.ceil(Math.abs(rise) + 2 * reach) };
}

/** One end cap at (x, y); (ux, uy) points out of the line. */
function capSvg(kind: LineCap, ink: string, x: number, y: number, ux: number, uy: number, size: number, t: number): string {
  const at = (v: number): string => String(Math.round(v * 100) / 100);
  const nx = -uy;
  const ny = ux;
  if (kind === 'triangle') {
    const bx = x - ux * size;
    const by = y - uy * size;
    const hw = size * 0.45;
    return `<polygon points="${at(x)},${at(y)} ${at(bx + nx * hw)},${at(by + ny * hw)} ${at(bx - nx * hw)},${at(by - ny * hw)}" fill="${ink}"/>`;
  }
  if (kind === 'arrow') {
    const bx = x - ux * size * 0.8;
    const by = y - uy * size * 0.8;
    const hw = size * 0.5;
    return `<polyline points="${at(bx + nx * hw)},${at(by + ny * hw)} ${at(x)},${at(y)} ${at(bx - nx * hw)},${at(by - ny * hw)}"`
      + ` fill="none" stroke="${ink}" stroke-width="${at(t)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (kind === 'circle') return `<circle cx="${at(x)}" cy="${at(y)}" r="${at(size / 2)}" fill="${ink}"/>`;
  if (kind === 'square') {
    const a = size / 2;
    const pts = [[a, a], [a, -a], [-a, -a], [-a, a]].map(([u, n]) => `${at(x + ux * u + nx * n)},${at(y + uy * u + ny * n)}`);
    return `<polygon points="${pts.join(' ')}" fill="${ink}"/>`;
  }
  if (kind === 'bar') {
    const a = size / 2;
    return `<line x1="${at(x + nx * a)}" y1="${at(y + ny * a)}" x2="${at(x - nx * a)}" y2="${at(y - ny * a)}" stroke="${ink}" stroke-width="${at(t)}" stroke-linecap="round"/>`;
  }
  return '';
}

/** How far the shaft stops short of an end, so a cap tip stays sharp. */
function capInset(kind: LineCap, size: number, t: number): number {
  if (kind === 'triangle') return size * 0.8;
  if (kind === 'arrow') return t / 2;
  return 0;
}

/** A Canva-like line: straight or curved shaft, its style, and a cap at each end. */
export function lineShape(ink: string, p: ShapeProps, w: number, h: number, defaultStyle: string): string {
  const at = (v: number): string => String(Math.round(v * 100) / 100);
  const g = lineGeometry(p, w, h);
  const [startCap, endCap] = lineCaps(String(p.shape ?? 'line'), p.startCap, p.endCap);
  const style = p.lineStyle && p.lineStyle !== 'solid' ? p.lineStyle : defaultStyle;
  const mx = (g.x1 + g.x2) / 2;
  const bent = Math.abs(g.controlY - g.chordY) > 0.01;
  // Outward unit tangents at each end (towards the control point's opposite).
  const unit = (dx: number, dy: number): [number, number] => {
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  };
  const [sx, sy] = bent ? unit(g.x1 - mx, g.chordY - g.controlY) : [-1, 0];
  const [ex, ey] = bent ? unit(g.x2 - mx, g.chordY - g.controlY) : [1, 0];
  const si = capInset(startCap, g.cap, g.t);
  const ei = capInset(endCap, g.cap, g.t);
  const p1 = [g.x1 - sx * si, g.chordY - sy * si];
  const p2 = [g.x2 - ex * ei, g.chordY - ey * ei];
  const d = bent
    ? `M ${at(p1[0])},${at(p1[1])} Q ${at(mx)},${at(g.controlY)} ${at(p2[0])},${at(p2[1])}`
    : `M ${at(p1[0])},${at(p1[1])} L ${at(p2[0])},${at(p2[1])}`;
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${at(g.t)}"${lineDash(style, g.t)}/>`
    + capSvg(startCap, ink, g.x1, g.chordY, sx, sy, g.cap, g.t)
    + capSvg(endCap, ink, g.x2, g.chordY, ex, ey, g.cap, g.t);
}