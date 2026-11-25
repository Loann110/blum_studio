// Editor geometry: snap guides and edge snapping.
import type { DesignItem } from '../../render/render.js';
import { axisBox, boxOf } from './boxes.js';

export const SNAP_SCREEN_PX = 5;
export interface Guide {
  vertical: boolean;
  at: number;
  from: number;
  to: number;
}

interface EdgeSet {
  v: number[];
  h: number[];
}

/** Canvas lines plus edges and centers of every sibling box. */
export function edgesOf(
  items: DesignItem[],
  ignore: Set<string>,
  canvas: { w: number; h: number },
): EdgeSet {
  const v: number[] = [0, canvas.w / 2, canvas.w];
  const h: number[] = [0, canvas.h / 2, canvas.h];
  for (const it of items) {
    if (ignore.has(it.id) || it.visible === false) continue;
    const b = axisBox(boxOf(it));
    v.push(b.x - b.w / 2, b.x, b.x + b.w / 2);
    h.push(b.y - b.h / 2, b.y, b.y + b.h / 2);
  }
  return { v, h };
}

export function nearest(target: number, lines: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const line of lines) {
    if (Math.abs(target - line) <= threshold) {
      if (best === null || Math.abs(target - line) < Math.abs(target - best)) {
        best = line;
      }
    }
  }
  return best;
}

/**
 * Snap a dragged box: compare its left/center/right (top/middle/bottom)
 * to the canvas and sibling lines. Returns the fixed delta and guides.
 */
export function snapBox(
  items: DesignItem[],
  moving: { x: number; y: number; w: number; h: number },
  ignore: Set<string>,
  canvas: { w: number; h: number },
  threshold: number,
): { dx: number; dy: number; guides: Guide[] } {
  const edges = edgesOf(items, ignore, canvas);
  const probesX = [moving.x - moving.w / 2, moving.x, moving.x + moving.w / 2];
  const probesY = [moving.y - moving.h / 2, moving.y, moving.y + moving.h / 2];
  let dx = 0;
  let dy = 0;
  const guides: Guide[] = [];
  for (let k = 0; k < 3; k++) {
    const hit = nearest(probesX[k], edges.v, threshold);
    if (hit !== null) {
      dx = hit - probesX[k];
      guides.push({ vertical: true, at: hit, from: 0, to: canvas.h });
      break;
    }
  }
  for (let k = 0; k < 3; k++) {
    const hit = nearest(probesY[k], edges.h, threshold);
    if (hit !== null) {
      dy = hit - probesY[k];
      guides.push({ vertical: false, at: hit, from: 0, to: canvas.w });
      break;
    }
  }
  return { dx, dy, guides };
}