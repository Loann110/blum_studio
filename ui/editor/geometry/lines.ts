// Editor geometry: line handles and boxes.
import { lineGeometry, type DesignItem, type ShapeProps } from '../../render/render.js';
import { boxOf } from './boxes.js';

export interface Pt {
  x: number;
  y: number;
}

/** A line's two ends and its bend handle. */
export type LineHandle = 'start' | 'end' | 'bend';

/** Anything the pointer can grab: box corners and sides, the rotate stem, line ends. */
export type HandleName =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  | 'rotate'
  | LineHandle;

/** A line's two ends and the top of its arc, in design px. */
export function lineHandles(item: DesignItem): { start: Pt; end: Pt; apex: Pt } {
  const b = boxOf(item);
  const g = lineGeometry((item.props ?? {}) as ShapeProps, b.w, b.h);
  const rad = (b.angle * Math.PI) / 180;
  const world = (lx: number, ly: number): Pt => {
    const dx = lx - b.w / 2;
    const dy = ly - b.h / 2;
    return { x: b.x + dx * Math.cos(rad) - dy * Math.sin(rad), y: b.y + dx * Math.sin(rad) + dy * Math.cos(rad) };
  };
  return { start: world(g.x1, g.chordY), end: world(g.x2, g.chordY), apex: world((g.x1 + g.x2) / 2, g.apexY) };
}

/**
 * The box (centre, size, angle) of a line drawn from `start` to `end` with
 * `bend`: the inverse of lineHandles. The box height wraps the arc and caps.
 */
export function lineBox(props: ShapeProps, start: Pt, end: Pt, bend: number): {
  x: number; y: number; width: number; height: number; angle: number;
} {
  const len = Math.max(10, Math.hypot(end.x - start.x, end.y - start.y));
  const rad = Math.atan2(end.y - start.y, end.x - start.x);
  // Padding at the ends, as lineGeometry measures it on any wide box.
  const probe = lineGeometry({ ...props, bend: 0 }, 10000, 100);
  const width = len + 2 * probe.x1;
  const g = lineGeometry({ ...props, bend }, width, 100);
  const height = g.needH;
  const rise = Math.max(-1, Math.min(1, bend)) * (len / 2);
  // The chord sits rise/2 below the box centre (local y): undo that offset.
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const off = rise / 2;
  const r = (v: number): number => Math.round(v * 10) / 10;
  return {
    x: r(mx + off * Math.sin(rad)),
    y: r(my - off * Math.cos(rad)),
    width: r(width),
    height: Math.max(1, Math.round(height)),
    angle: Math.round(((rad * 180) / Math.PI) * 10) / 10,
  };
}

/** The bend a pointer gives when it drags the arc handle of a line from `start` to `end`. */
export function bendFromPointer(start: Pt, end: Pt, p: Pt): number {
  const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const ux = (end.x - start.x) / len;
  const uy = (end.y - start.y) / len;
  // Local "up" is (uy, -ux): the arc rises against the box's y axis.
  const d = (p.x - (start.x + end.x) / 2) * uy - (p.y - (start.y + end.y) / 2) * ux;
  return Math.max(-1, Math.min(1, Math.round((d / (len / 2)) * 100) / 100));
}