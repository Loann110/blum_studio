// Editor geometry: boxes, corners and hit testing.
import type { DesignItem } from '../../render/render.js';

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function boxOf(item: DesignItem): {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
} {
  return {
    x: num(item.x),
    y: num(item.y),
    w: Math.max(1, num(item.width, 100)),
    h: Math.max(1, num(item.height, 100)),
    angle: num(item.angle),
  };
}

/** Axis-aligned box around a rotated box: what guides snap to, as in the reference. */
export function axisBox(box: { x: number; y: number; w: number; h: number; angle: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const rad = (box.angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { x: box.x, y: box.y, w: box.w * cos + box.h * sin, h: box.w * sin + box.h * cos };
}

export function cornersOf(box: {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}): { x: number; y: number }[] {
  const rad = (box.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = box.w / 2;
  const hh = box.h / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((p) => ({
    x: box.x + p.x * cos - p.y * sin,
    y: box.y + p.x * sin + p.y * cos,
  }));
}

export function pointInBox(
  px: number,
  py: number,
  box: { x: number; y: number; w: number; h: number; angle: number },
  slop = 0,
): boolean {
  const rad = (-box.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - box.x;
  const dy = py - box.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  // `slop`: a thin item (a line) still takes clicks a few screen px around it.
  return Math.abs(lx) <= Math.max(box.w / 2, slop) && Math.abs(ly) <= Math.max(box.h / 2, slop);
}

/**
 * Topmost item under a design-space point (front items win). Locked items
 * stay clickable so they can be selected and unlocked; only drags skip them.
 */
export function hitTest(items: DesignItem[], px: number, py: number, slop = 0): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.visible === false) continue;
    if (pointInBox(px, py, boxOf(it))) return it.id;
  }
  // Nothing under the pointer: a thin item close by (within `slop`) takes the click.
  if (slop > 0) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.visible !== false && pointInBox(px, py, boxOf(it), slop)) return it.id;
    }
  }
  return null;
}