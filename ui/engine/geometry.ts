// Geometry: rotated boxes, overlap, snapping, safe zones.
// Mirrors core/src/geometry.cpp; angles are degrees clockwise, y grows down.

import type { Design, Item } from './model.js';
import { canvasHeight, canvasWidth, safeMargins } from './model.js';

/* ---- points and boxes ---- */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Guide {
  vertical: boolean;
  at: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

function rotatePoint(p: Point, center: Point, angleDeg: number): Point {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

function project(pts: Point[], axis: Point): [number, number] {
  let lo = pts[0].x * axis.x + pts[0].y * axis.y;
  let hi = lo;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].x * axis.x + pts[i].y * axis.y;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}

function satOverlap(a: Point[], b: Point[]): boolean {
  for (let r = 0; r < 2; r++) {
    const pts = r === 0 ? a : b;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      let axis = { x: -(q.y - p.y), y: q.x - p.x };
      const len = Math.hypot(axis.x, axis.y);
      if (len < 1e-9) continue;
      axis = { x: axis.x / len, y: axis.y / len };
      const [loA, hiA] = project(a, axis);
      const [loB, hiB] = project(b, axis);
      if (hiA < loB || hiB < loA) return false;
    }
  }
  return true;
}

export function corners(item: Item): Point[] {
  const c = { x: item.x, y: item.y };
  const hw = item.width / 2;
  const hh = item.height / 2;
  const pts = [
    { x: c.x - hw, y: c.y - hh },
    { x: c.x + hw, y: c.y - hh },
    { x: c.x + hw, y: c.y + hh },
    { x: c.x - hw, y: c.y + hh },
  ];
  if (item.angle === 0) return pts;
  return pts.map((p) => rotatePoint(p, c, item.angle));
}

export function groupBox(group: Item): Box {
  let out: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let first = true;
  for (const child of group.children) {
    const abs: Item = {
      ...child,
      x: child.x + group.x,
      y: child.y + group.y,
      angle: child.angle + group.angle,
    };
    const b = boundingBox(abs);
    if (first) {
      out = b;
      first = false;
    } else {
      out = {
        minX: Math.min(out.minX, b.minX),
        minY: Math.min(out.minY, b.minY),
        maxX: Math.max(out.maxX, b.maxX),
        maxY: Math.max(out.maxY, b.maxY),
      };
    }
  }
  return out;
}

export function boundingBox(item: Item): Box {
  if (item.type === 'group' && item.children.length > 0) {
    return groupBox(item);
  }
  const pts = corners(item);
  let b: Box = { minX: pts[0].x, minY: pts[0].y, maxX: pts[0].x, maxY: pts[0].y };
  for (const p of pts) {
    b = {
      minX: Math.min(b.minX, p.x),
      minY: Math.min(b.minY, p.y),
      maxX: Math.max(b.maxX, p.x),
      maxY: Math.max(b.maxY, p.y),
    };
  }
  return b;
}

export function overlaps(a: Item, b: Item): boolean {
  return satOverlap(corners(a), corners(b));
}

export function overlapRatio(a: Item, b: Item): number {
  if (!overlaps(a, b)) return 0;
  const x = boundingBox(a);
  const y = boundingBox(b);
  const ix = Math.max(0, Math.min(x.maxX, y.maxX) - Math.max(x.minX, y.minX));
  const iy = Math.max(0, Math.min(x.maxY, y.maxY) - Math.max(x.minY, y.minY));
  const areaA = (x.maxX - x.minX) * (x.maxY - x.minY);
  const areaB = (y.maxX - y.minX) * (y.maxY - y.minY);
  const smaller = Math.min(areaA, areaB);
  if (smaller <= 0) return 0;
  return Math.min(1, (ix * iy) / smaller);
}

/* ---- canvas and safe zone ---- */

export function canvasBox(doc: Design): Box {
  return { minX: 0, minY: 0, maxX: canvasWidth(doc), maxY: canvasHeight(doc) };
}

export function safeBox(doc: Design): Box {
  const m = safeMargins(doc);
  return {
    minX: m.sides,
    minY: m.top,
    maxX: canvasWidth(doc) - m.sides,
    maxY: canvasHeight(doc) - m.bottom,
  };
}

export function inside(inner: Box, outer: Box): boolean {
  return (
    inner.minX >= outer.minX && inner.minY >= outer.minY &&
    inner.maxX <= outer.maxX && inner.maxY <= outer.maxY
  );
}

/* ---- snapping ---- */

export function snapMove(
  doc: Design,
  moving: Item,
  dx: number,
  dy: number,
  kSnapPx = 8,
): SnapResult {
  const xs = [0, canvasWidth(doc) / 2, canvasWidth(doc)];
  const ys = [0, canvasHeight(doc) / 2, canvasHeight(doc)];
  const safe = safeBox(doc);
  xs.push(safe.minX, safe.maxX);
  ys.push(safe.minY, safe.maxY);
  for (const other of doc.items) {
    if (!other || other.id === moving.id || !other.visible) continue;
    const b = boundingBox(other);
    xs.push(b.minX, (b.minX + b.maxX) / 2, b.maxX);
    ys.push(b.minY, (b.minY + b.maxY) / 2, b.maxY);
  }

  const moved: Item = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const m = boundingBox(moved);
  const mxs = [m.minX, (m.minX + m.maxX) / 2, m.maxX];
  const mys = [m.minY, (m.minY + m.maxY) / 2, m.maxY];

  const out: SnapResult = { dx, dy, guides: [] };
  let bestX = kSnapPx + 1;
  let bestY = kSnapPx + 1;
  let lineX = 0;
  let lineY = 0;
  for (const mx of mxs) {
    for (const tx of xs) {
      const d = Math.abs(mx - tx);
      if (d < bestX) {
        bestX = d;
        out.dx = dx + (tx - mx);
        lineX = tx;
      }
    }
  }
  for (const my of mys) {
    for (const ty of ys) {
      const d = Math.abs(my - ty);
      if (d < bestY) {
        bestY = d;
        out.dy = dy + (ty - my);
        lineY = ty;
      }
    }
  }
  const h = canvasHeight(doc);
  const w = canvasWidth(doc);
  if (bestX <= kSnapPx) {
    out.guides.push({ vertical: true, at: lineX, from: 0, to: h });
  } else {
    out.dx = dx;
  }
  if (bestY <= kSnapPx) {
    out.guides.push({ vertical: false, at: lineY, from: 0, to: w });
  } else {
    out.dy = dy;
  }
  return out;
}
