// Editor geometry: selection boxes and rotation math.
import { cornersOf } from './boxes.js';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

/**
 * Axis-aligned box around several boxes: the frame the reference draws
 * around an active selection (eight handles plus a rotate handle, every
 * member scaling and turning with it).
 */
export function unionBox(boxes: Box[]): { x: number; y: number; w: number; h: number } {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of boxes) {
    for (const p of cornersOf(b)) {
      if (p.x < x1) x1 = p.x;
      if (p.y < y1) y1 = p.y;
      if (p.x > x2) x2 = p.x;
      if (p.y > y2) y2 = p.y;
    }
  }
  if (!Number.isFinite(x1)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

/** Rotates a design point about a centre, by degrees. */
export function rotateAbout(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number,
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function pointerAngle(
  cx: number,
  cy: number,
  px: number,
  py: number,
): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
}

export function normalizeAngle(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 10) / 10;
}

/** Rotation sticks to multiples of 15° when it comes within 4° of one. */
export function snapAngle(angle: number): number {
  const near = Math.round(angle / 15) * 15;
  return Math.abs(angle - near) <= 4 ? near : angle;
}