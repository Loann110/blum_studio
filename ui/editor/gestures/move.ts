// Editor move gesture: drag to move, Alt-copy and nudge.
import { canvasSize, drawStage, hooks, overlayEl } from '../canvas/stage.js';
import { drawOverlay, setGuides } from '../canvas/overlay.js';
import { originsOf, snapOff, snapThreshold, type Session } from './session.js';
import { axisBox } from '../geometry/boxes.js';
import { snapBox } from '../geometry/snapping.js';
import { freshId, selectedToplevel, toast, topItems, type EditorState } from '../state.js';
import type { Op } from '../api.js';

export function pressItem(
  st: EditorState,
  point: { x: number; y: number },
  hit: string,
  evt: PointerEvent,
): Session | null {
  if (evt.shiftKey) {
    // Shift+click toggles membership in a multi-selection.
    const next = st.selection.includes(hit)
      ? st.selection.filter((s) => s !== hit)
      : [...st.selection, hit];
    hooks?.setSelection(next);
    return null;
  }
  // Pressing one item of a multi-selection keeps the group for a drag; the
  // release narrows to that item if nothing moved (see onUp).
  const narrowTo = st.selection.length > 1 && st.selection.includes(hit) ? hit : undefined;
  if (!st.selection.includes(hit)) hooks?.setSelection([hit]);
  const movable = st.selection.filter((id) => {
    const it = topItems(st.design).find((t) => t.id === id);
    return it && !it.locked;
  });
  evt.preventDefault();
  if (movable.length === 0) return null;
  st.dragging = true;
  hooks?.setDirty(true);
  overlayEl?.setPointerCapture(evt.pointerId);
  return {
    kind: 'move',
    startX: point.x,
    startY: point.y,
    origins: originsOf(movable),
    startAngle: 0,
    moved: false,
    copy: evt.altKey,
    narrowTo,
  };
}

export function dragMove(
  st: EditorState,
  session: Session,
  dx: number,
  dy: number,
  evt: PointerEvent,
): void {
    // The whole selection snaps as one box, as in the reference.
    const boxes = [...session.origins.values()].map(axisBox);
    const x1 = Math.min(...boxes.map((b) => b.x - b.w / 2));
    const x2 = Math.max(...boxes.map((b) => b.x + b.w / 2));
    const y1 = Math.min(...boxes.map((b) => b.y - b.h / 2));
    const y2 = Math.max(...boxes.map((b) => b.y + b.h / 2));
    const snapped = snapOff(evt)
  ? { dx: 0, dy: 0, guides: [] }
  : snapBox(
      topItems(st.design),
      { x: (x1 + x2) / 2 + dx, y: (y1 + y2) / 2 + dy, w: x2 - x1, h: y2 - y1 },
      new Set(session.origins.keys()),
      canvasSize(st),
      snapThreshold(),
    );
  setGuides(snapped.guides);
    for (const [id, o] of session.origins) {
  const it = topItems(st.design).find((t) => t.id === id);
  if (it) {
    it.x = Math.round((o.x + dx + snapped.dx) * 10) / 10;
    it.y = Math.round((o.y + dy + snapped.dy) * 10) / 10;
  }
    }
}

export function finishMove(
  st: EditorState,
  finished: Session,
  ops: Op[],
  copies: string[],
): void {
  for (const [id, o] of finished.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    const patch: Record<string, number> = {};
      if (finished.copy) {
        // Alt+drag: a copy lands under the pointer, the original stays put.
        const copyId = freshId(st.design, id);
        copies.push(copyId);
        ops.push({ op: 'duplicate', id, name: copyId });
        ops.push({ op: 'update', id: copyId, patch: { x: it.x ?? o.x, y: it.y ?? o.y } });
        continue;
      }
      if (Math.round(it.x ?? 0) !== Math.round(o.x)) patch.x = Math.round((it.x ?? 0) * 10) / 10;
      if (Math.round(it.y ?? 0) !== Math.round(o.y)) patch.y = Math.round((it.y ?? 0) * 10) / 10;
    if (Object.keys(patch).length > 0) ops.push({ op: 'update', id, patch });
  }
}

export function nudgeSelection(dx: number, dy: number): void {
  if (!hooks || hooks.state.dragging) return;
  const st = hooks.state;
  const movable = selectedToplevel(st).filter((it) => !it.locked);
  if (movable.length === 0) {
    if (selectedToplevel(st).length > 0) toast('Locked items do not move.');
    return;
  }
  // Apply locally first so holding the key feels instant, then commit.
  for (const it of movable) {
    it.x = Math.round(((it.x ?? 0) + dx) * 10) / 10;
    it.y = Math.round(((it.y ?? 0) + dy) * 10) / 10;
  }
  drawStage();
  drawOverlay();
  const ops: Op[] = movable.map((it) => ({
    op: 'update',
    id: it.id,
    patch: { x: it.x, y: it.y },
  }));
  // A burst of arrow presses on the same items is one undo step, as in the reference.
  void hooks.commit(ops, `nudge:${movable.map((it) => it.id).join(',')}`);
}