// Editor line gesture: ends and bend handles.
import { hooks, overlayEl } from '../canvas/stage.js';
import type { HandleName } from '../geometry/lines.js';
import { originsOf, type Session } from './session.js';
import { boxOf } from '../geometry/boxes.js';
import { bendFromPointer, lineBox, lineHandles } from '../geometry/lines.js';
import { topItems, type DesignItem, type EditorState } from '../state.js';
import { LINE_KINDS } from '../../render/render.js';
import type { Op } from '../api.js';

export function isLine(it: DesignItem): boolean {
  return it.type === 'shape' && LINE_KINDS.has(String((it.props as Record<string, unknown> | undefined)?.shape ?? ''));
}

export function startLine(
  st: EditorState,
  point: { x: number; y: number },
  handle: HandleName,
  evt: PointerEvent,
): Session | null {
  const it = topItems(st.design).find((t) => t.id === st.selection[0]);
  if (!it || it.locked || !isLine(it)) return null;
  const ends = lineHandles(it);
  const started: Session = {
    kind: 'line',
    handle,
    startX: point.x,
    startY: point.y,
    origins: originsOf([it.id]),
    startAngle: boxOf(it).angle,
    moved: false,
    lineStart: ends.start,
    lineEnd: ends.end,
    lineBend: Number((it.props as Record<string, unknown> | undefined)?.bend ?? 0),
  };
  st.dragging = true;
  hooks?.setDirty(true);
  overlayEl?.setPointerCapture(evt.pointerId);
  evt.preventDefault();
  return started;
}

export function dragLine(st: EditorState, session: Session, point: { x: number; y: number }): void {
  const lineStart = session.lineStart;
  const lineEnd = session.lineEnd;
  if (!lineStart || !lineEnd) return;
    const id = [...session.origins.keys()][0];
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) return;
    const props = (it.props ?? {}) as Record<string, unknown>;
    let start = lineStart;
    let end = lineEnd;
    let bend = session.lineBend ?? 0;
    if (session.handle === 'start') start = point;
    else if (session.handle === 'end') end = point;
    else bend = bendFromPointer(start, end, point);
    const box = lineBox(props, start, end, bend);
    Object.assign(it, box);
    it.props = { ...props, bend };
}

export function finishLine(st: EditorState, finished: Session, ops: Op[]): void {
  for (const [id, o] of finished.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    ops.push({ op: 'update', id, patch: {
      x: it.x ?? o.x, y: it.y ?? o.y, width: it.width ?? o.w, height: it.height ?? o.h,
      angle: it.angle ?? o.angle,
      bend: Number((it.props as Record<string, unknown> | undefined)?.bend ?? 0),
    } });
  }
}