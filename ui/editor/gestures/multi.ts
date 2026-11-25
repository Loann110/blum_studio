// Editor multi-selection: shared frames for resize and rotate.
import { unionBox } from '../geometry/angles.js';
import { rotateAbout, pointerAngle, normalizeAngle, snapAngle } from '../geometry/angles.js';
import { topItems, type DesignItem, type EditorState } from '../state.js';
import type { HandleName } from '../geometry/lines.js';
import type { Origin, Session } from './session.js';

export interface Sized {
  w: number;
  h: number;
  /** Centre offset from the origin centre, in the item frame. */
  cx: number;
  cy: number;
}

/** Keeps the opposite edge or corner where it was. */
export function anchored(o: Origin, handle: HandleName, w: number, h: number): Sized {
  const cx = handle.includes('w') ? (o.w - w) / 2 : handle.includes('e') ? (w - o.w) / 2 : 0;
  const cy = handle.includes('n') ? (o.h - h) / 2 : handle.includes('s') ? (h - o.h) / 2 : 0;
  return { w, h, cx, cy };
}

/** Corner and edge resize, in the item's own frame. Corners keep the ratio unless `free`. */
export function resizeBox(o: Origin, handle: HandleName, lx: number, ly: number, free: boolean): Sized {
  let w = o.w;
  let h = o.h;
  if (handle.includes('e')) w = o.w + lx;
  if (handle.includes('w')) w = o.w - lx;
  if (handle.includes('s')) h = o.h + ly;
  if (handle.includes('n')) h = o.h - ly;
  if (handle.length === 2 && !free) {
    // Scale by the pointer's travel along the box diagonal, as the reference does:
    // the larger axis ratio blew thin items up (a 24 px line dragged 40 px down grew 4x).
    const k = Math.max((o.w * w + o.h * h) / (o.w * o.w + o.h * o.h), 20 / o.w, 20 / o.h);
    return anchored(o, handle, o.w * k, o.h * k);
  }
  return anchored(o, handle, Math.max(20, w), Math.max(20, h));
}

/**
 * Scales a group's children with it, as the reference does: positions are
 * relative to the group centre, so they scale with the box; text sizes follow.
 */
export function scaledKids(kids: DesignItem[], kx: number, ky: number): DesignItem[] {
  const r = (v: number): number => Math.round(v * 10) / 10;
  return kids.map((c) => {
    const props = (c.props ?? {}) as Record<string, unknown>;
    const out: DesignItem = {
      ...c,
      x: r((c.x ?? 0) * kx),
      y: r((c.y ?? 0) * ky),
      width: r((c.width ?? 0) * kx),
      height: r((c.height ?? 0) * ky),
    };
    if (c.type === 'text' && typeof props.size === 'number') out.props = { ...props, size: r(props.size * Math.min(kx, ky)) };
    if (c.type === 'group') out.items = scaledKids(c.items ?? [], kx, ky);
    return out;
  });
}

/**
 * Scales every member of an active selection about the shared frame, as
 * the reference does: positions ride the frame, sizes follow, text sizes
 * track the smaller axis, group children scale with their group.
 */
export function resizeMulti(
  st: EditorState,
  session: Session,
  handle: HandleName,
  dx: number,
  dy: number,
): void {
  const cx = session.mcx ?? 0;
  const cy = session.mcy ?? 0;
  const members = [...session.origins.values()];
  if (members.length === 0) return;
  const outer = unionBox(members);
  // The shared frame is axis-aligned: resize it like a plain box.
  const frame = resizeBox({ x: cx, y: cy, w: outer.w, h: outer.h, angle: 0, size: 0 }, handle, dx, dy, false);
  const kx = frame.w / outer.w;
  const ky = frame.h / outer.h;
  const ncx = cx + frame.cx;
  const ncy = cy + frame.cy;
  for (const [id, o] of session.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    const r = (v: number): number => Math.round(v * 10) / 10;
    it.x = r(ncx + (o.x - cx) * kx);
    it.y = r(ncy + (o.y - cy) * ky);
    it.width = r(o.w * kx);
    it.height = r(o.h * ky);
    if (it.type === 'text' && o.size > 0) {
      it.props = { ...(it.props ?? {}), size: r(o.size * Math.min(kx, ky)) };
    }
    const kids = session.kids?.get(id);
    if (kids) it.items = scaledKids(kids, kx, ky);
  }
}

/** Turns every member about the shared centre, adding the same delta. */
export function rotateMulti(st: EditorState, session: Session, point: { x: number; y: number }): void {
  const cx = session.mcx ?? 0;
  const cy = session.mcy ?? 0;
  const delta = normalizeAngle(snapAngle(normalizeAngle(
    pointerAngle(cx, cy, point.x, point.y) - (session.mStartPointer ?? 0),
  )));
  for (const [id, o] of session.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    const at = rotateAbout(o.x, o.y, cx, cy, delta);
    it.x = Math.round(at.x * 10) / 10;
    it.y = Math.round(at.y * 10) / 10;
    it.angle = normalizeAngle(o.angle + delta);
  }
}