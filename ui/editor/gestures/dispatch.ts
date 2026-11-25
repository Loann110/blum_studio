// Editor gesture dispatch: pointer press, drag and release.
import { drawStage, hooks, overlayEl, refreshRect, scale, toDesign } from '../canvas/stage.js';
import { drawOverlay, LINE_HANDLES, setGuides } from '../canvas/overlay.js';
import type { HandleName } from '../geometry/lines.js';
import { fromWorkspaceChrome, releaseChromeFocus, HIT_SLOP_PX } from '../canvas/workspace.js';
import { hitTest } from '../geometry/boxes.js';
import { topItems } from '../state.js';
import type { Op } from '../api.js';
import { session, setSession } from './session.js';
import { startLine, dragLine, finishLine } from './line.js';
import { startHandle, dragResize, finishResize } from './resize.js';
import { dragRotate, finishRotate } from './rotate.js';
import { pressItem, dragMove, finishMove } from './move.js';
import { startMarquee, dragMarquee, finishMarquee } from './marquee.js';

export function onDown(evt: PointerEvent): void {
  if (!hooks || !overlayEl) return;
  if (evt.button !== 0) return;
  // One position read per gesture (never on pointermove): the cache is
  // refreshed on layout and scroll, and a press re-syncs it in case the
  // box moved in between (panel, banner, image load under the stage).
  refreshRect();
  const st = hooks.state;
  const target = evt.target as HTMLElement;
  const handle = target.dataset?.handle as HandleName | undefined;
  const point = toDesign(evt);
  if (!point) return;
  releaseChromeFocus(target);

  if (handle && (LINE_HANDLES as readonly string[]).includes(handle)) {
    const started = startLine(st, point, handle, evt);
    if (started) setSession(started);
    return;
  }
  if (handle) {
    const started = startHandle(st, point, handle, evt);
    if (started) setSession(started);
    return;
  }
  const hit = hitTest(topItems(st.design), point.x, point.y, HIT_SLOP_PX / scale);
  if (hit) {
    const started = pressItem(st, point, hit, evt);
    if (started) setSession(started);
    return;
  }
  setSession(startMarquee(st, point, evt));
}

export function onMove(evt: PointerEvent): void {
  if (!hooks || !session) return;
  const st = hooks.state;
  const point = toDesign(evt);
  if (!point) return;

  const dx = point.x - session.startX;
  const dy = point.y - session.startY;
  // A few screen px of slop, so a click never nudges anything.
  if (!session.moved && Math.hypot(dx, dy) * scale <= 3) return;
  session.moved = true;

  if (session.kind === 'marquee') {
    dragMarquee(session, point);
    return;
  }
  setGuides([]);
  if (session.kind === 'move') dragMove(st, session, dx, dy, evt);
  else if (session.kind === 'line' && session.lineStart && session.lineEnd) dragLine(st, session, point);
  else if (session.kind === 'resize' && session.handle) dragResize(st, session, session.handle, dx, dy, evt);
  else if (session.kind === 'rotate') dragRotate(st, session, point);
  // Guides are an overlay choice: off means a clean canvas, snapping still on.
  if (!st.view.guides) setGuides([]);
  drawStage();
  drawOverlay();
}

export function onUp(): void {
  if (!hooks || !session) return;
  const st = hooks.state;
  setGuides([]);
  const finished = session;
  setSession(null);
  if (finished.kind === 'marquee') {
    finishMarquee(finished);
    return;
  }
  st.dragging = false;
  if (!finished.moved) {
    hooks.setDirty(false);
    if (finished.narrowTo) hooks.setSelection([finished.narrowTo]);
    else hooks.renderAll();
    return;
  }
  const ops: Op[] = [];
  const copies: string[] = [];
  if (finished.kind === 'line') finishLine(st, finished, ops);
  else if (finished.kind === 'move') finishMove(st, finished, ops, copies);
  else if (finished.kind === 'resize') finishResize(st, finished, ops);
  else finishRotate(st, finished, ops);
  void hooks.commit(ops).then((ok) => {
    if (!ok) hooks?.renderAll();
    else if (copies.length > 0) hooks?.setSelection(copies);
  });
}

export function bindCanvasKeys(): void {
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** The page takes the pointer (not only the canvas box): a marquee can start
 * in the grey area and a press there clears the selection. */
export function bindCanvasPress(root: HTMLElement): void {
  root.addEventListener('pointerdown', (evt) => {
    if (fromWorkspaceChrome(evt, root)) return;
    onDown(evt);
  });
}
