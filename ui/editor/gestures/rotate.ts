// Editor rotate gesture: single and shared turns.
import { pointerAngle, normalizeAngle, snapAngle } from '../geometry/angles.js';
import { topItems, type EditorState } from '../state.js';
import type { Session } from './session.js';
import type { Op } from '../api.js';
import { rotateMulti } from './multi.js';

export function dragRotate(
  st: EditorState,
  session: Session,
  point: { x: number; y: number },
): void {
  if (session.origins.size > 1) {
    rotateMulti(st, session, point);
    return;
  }
  const [id, o] = [...session.origins.entries()][0];
  const it = topItems(st.design).find((t) => t.id === id);
  if (!it) return;
  const angle = session.startAngle + (pointerAngle(o.x, o.y, point.x, point.y) -
    pointerAngle(o.x, o.y, session.startX, session.startY));
  it.angle = normalizeAngle(snapAngle(normalizeAngle(angle)));
}

export function finishRotate(st: EditorState, finished: Session, ops: Op[]): void {
  for (const [id, o] of finished.origins) {
    const it = topItems(st.design).find((t) => t.id === id);
    if (!it) continue;
    const patch: Record<string, number> = {};
    if (finished.origins.size > 1) {
      // A shared turn moved every member about the centre.
      patch.x = Math.round((it.x ?? 0) * 10) / 10;
      patch.y = Math.round((it.y ?? 0) * 10) / 10;
      patch.angle = it.angle ?? o.angle;
    } else {
      patch.angle = it.angle ?? o.angle;
    }
    if (Object.keys(patch).length > 0) ops.push({ op: 'update', id, patch });
  }
}