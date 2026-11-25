// Editor resize gesture: corners, sides and snapping.
import { canvasSize, hooks, overlayEl } from '../canvas/stage.js';
import { addGuide } from '../canvas/overlay.js';
import { originsOf, snapOff, snapThreshold, type Origin, type Session } from './session.js';
import { anchored, resizeBox, resizeMulti, scaledKids, type Sized } from './multi.js';
import { boxOf } from '../geometry/boxes.js';
import { edgesOf, nearest } from '../geometry/snapping.js';
import { pointerAngle, unionBox } from '../geometry/angles.js';
import { topItems, type DesignItem, type EditorState } from '../state.js';
import type { Op } from '../api.js';

import type { HandleName } from '../geometry/lines.js';

/** The dragged edge sticks to page and item lines (straight items only). */
function snapResize(box: Sized, o: Origin, handle: HandleName, free: boolean, id: string): Sized {
  if (!hooks) return box;
  const edges = edgesOf(topItems(hooks.state.design), new Set([id]), canvasSize(hooks.state));
  const t = snapThreshold();
  const x = o.x + box.cx;
  const y = o.y + box.cy;
  const ex = handle.includes('e') ? x + box.w / 2 : handle.includes('w') ? x - box.w / 2 : null;
  const ey = handle.includes('s') ? y + box.h / 2 : handle.includes('n') ? y - box.h / 2 : null;
  const hx = ex === null ? null : nearest(ex, edges.v, t);
  const hy = ey === null ? null : nearest(ey, edges.h, t);
  const dx = hx === null || ex === null ? 0 : hx - ex;
  const dy = hy === null || ey === null ? 0 : hy - ey;
  if (dx === 0 && dy === 0) return box;
  let w = box.w + (handle.includes('w') ? -dx : dx);
  let h = box.h + (handle.includes('n') ? -dy : dy);
  if (handle.length === 2 && !free) {
    // One scale for both axes: follow whichever edge is closer to its line.
    const f = dx !== 0 && (dy === 0 || Math.abs(dx) <= Math.abs(dy)) ? w / box.w : h / box.h;
    w = box.w * f;
    h = box.h * f;
  }
  if (hx !== null && dx !== 0) addGuide({ vertical: true, at: hx, from: 0, to: 0 });
  if (hy !== null && dy !== 0) addGuide({ vertical: false, at: hy, from: 0, to: 0 });
  return anchored(o, handle, w, h);
}

/** One update op per child (nested too), carrying the scaled box. */
function kidOps(kids: DesignItem[]): Op[] {
  return kids.flatMap((c) => {
    const patch: Record<string, number> = { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 };
    const size = (c.props as Record<string, unknown> | undefined)?.size;
    if (c.type === 'text' && typeof size === 'number') patch.size = size;
    return [{ op: 'update', id: c.id, patch } as Op, ...(c.type === 'group' ? kidOps(c.items ?? []) : [])];
  });
}

export function startHandle(
  st: EditorState,
  point: { x: number; y: number },
  handle: HandleName,
  evt: PointerEvent,
): Session | null {
    const movable = st.selection
      .map((id) => topItems(st.design).find((t) => t.id === id))
      .filter((it): it is DesignItem => !!it && !it.locked);
  if (movable.length === 0) return null;
  const origins = originsOf(movable.map((it) => it.id));
  const kids = new Map<string, DesignItem[]>();
  for (const it of movable) {
    if (it.type === 'group') kids.set(it.id, structuredClone(it.items ?? []));
  }
  const boxes = movable.map(boxOf);
  const centre = unionBox(boxes);
  const started: Session = {
    kind: handle === 'rotate' ? 'rotate' : 'resize',
    handle,
    startX: point.x,
    startY: point.y,
    origins,
    startAngle: movable.length === 1 ? boxOf(movable[0]).angle : 0,
    moved: false,
    kids: kids.size > 0 ? kids : undefined,
    mcx: centre.x,
    mcy: centre.y,
    mStartPointer: pointerAngle(centre.x, centre.y, point.x, point.y),
  };
  st.dragging = true;
  hooks?.setDirty(true);
  overlayEl?.setPointerCapture(evt.pointerId);
  evt.preventDefault();
  return started;
}

export function dragResize(
  st: EditorState,
  session: Session,
  handle: HandleName,
  dx: number,
  dy: number,
  evt: PointerEvent,
): void {
  if (session.origins.size > 1) {
    resizeMulti(st, session, handle, dx, dy);
    return;
  }
  const [id, o] = [...session.origins.entries()][0];
  const it = topItems(st.design).find((t) => t.id === id);
  if (!it) return;
  const rad = (-o.angle * Math.PI) / 180;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  // Text corners always scale evenly: the letters never stretch.
  const free = evt.shiftKey && it.type !== 'text';
  let box = resizeBox(o, handle, lx, ly, free);
  if (Math.abs(o.angle % 180) < 0.01 && !snapOff(evt)) box = snapResize(box, o, handle, free, id);
  // Rotate the centre offset back to design space.
  const rad2 = (o.angle * Math.PI) / 180;
  it.width = Math.round(box.w * 10) / 10;
  it.height = Math.round(box.h * 10) / 10;
  it.x = Math.round((o.x + box.cx * Math.cos(rad2) - box.cy * Math.sin(rad2)) * 10) / 10;
  it.y = Math.round((o.y + box.cx * Math.sin(rad2) + box.cy * Math.cos(rad2)) * 10) / 10;
  if (it.type === 'text' && handle.length === 2 && o.size > 0) {
    it.props = { ...(it.props ?? {}), size: Math.round(o.size * (box.w / o.w) * 10) / 10 };
  }
  const kids = session.kids?.get(id);
  if (kids) it.items = scaledKids(kids, box.w / o.w, box.h / o.h);
}

export function finishResize(st: EditorState, finished: Session, ops: Op[]): void {
  for (const [id, o] of finished.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    const patch: Record<string, number> = {};
      patch.width = it.width ?? o.w;
      patch.x = Math.round((it.x ?? 0) * 10) / 10;
      patch.y = Math.round((it.y ?? 0) * 10) / 10;
      if (finished.origins.size > 1) {
        // The shared frame scaled everything: members keep their new box.
        patch.height = it.height ?? o.h;
        if (it.type === 'text') {
          patch.size = Number((it.props as Record<string, unknown> | undefined)?.size ?? o.size);
        }
        if (finished.kids?.get(id)) ops.push(...kidOps(it.items ?? []));
      } else if (it.type !== 'text') {
        patch.height = it.height ?? o.h;
        if (finished.kids?.get(id)) ops.push(...kidOps(it.items ?? []));
      } else if (finished.handle?.length === 2) {
        // Corners scaled the letters; the height comes from the text (textfit).
        patch.size = Number((it.props as Record<string, unknown> | undefined)?.size ?? o.size);
      } else if (o.angle === 0) {
        // Sides only change the wrap width: textfit keeps the top edge.
        delete patch.y;
      }
    if (Object.keys(patch).length > 0) ops.push({ op: 'update', id, patch });
  }
}