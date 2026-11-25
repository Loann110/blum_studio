// Editor gesture session: the live pointer session and its helpers.
// Dispatch (press, drag, release) lives in dispatch.ts.
import { hooks, scale } from '../canvas/stage.js';
import { boxOf } from '../geometry/boxes.js';
import type { HandleName } from '../geometry/lines.js';
import { SNAP_SCREEN_PX } from '../geometry/snapping.js';
import { topItems, type DesignItem } from '../state.js';

export interface Origin {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  /** Text size, scaled by corner drags. */
  size: number;
}

export interface Session {
  kind: 'move' | 'resize' | 'rotate' | 'marquee' | 'line';
  /** Line gestures: the ends and bend when the drag started. */
  lineStart?: { x: number; y: number };
  lineEnd?: { x: number; y: number };
  lineBend?: number;
  handle?: HandleName;
  startX: number;
  startY: number;
  origins: Map<string, Origin>;
  startAngle: number;
  moved: boolean;
  /** Alt held when the drag started: the drop makes a copy, the original stays. */
  copy?: boolean;
  /** Pressed item inside a multi-selection: a click without a drag selects it alone. */
  narrowTo?: string;
  /** Selection kept by a Shift+marquee. */
  keep?: string[];
  endX?: number;
  endY?: number;
  /** Children of a group being resized, as they were at the start. */
  kids?: Map<string, DesignItem[]>;
  /** Centre of a multi-selection when the drag started (design px). */
  mcx?: number;
  mcy?: number;
  /** Pointer angle about the multi centre when a rotate started. */
  mStartPointer?: number;
}

export let session: Session | null = null;

/** The dispatch owns the transitions; state stays in this module. */
export function setSession(next: Session | null): void {
  session = next;
}

export function originsOf(ids: string[]): Map<string, Origin> {
  const map = new Map<string, Origin>();
  for (const id of ids) {
    const it = hooks?.state ? topItems(hooks.state.design).find((t) => t.id === id) : undefined;
    if (it) {
      const size = Number((it.props as Record<string, unknown> | undefined)?.size ?? 0);
      map.set(id, { ...boxOf(it), size });
    }
  }
  return map;
}

/** Alt, Ctrl or Cmd held: guides are off for this gesture. */
export function snapOff(evt: PointerEvent): boolean {
  return !hooks?.state.view.snap || evt.altKey || evt.ctrlKey || evt.metaKey;
}

export function snapThreshold(): number {
  return SNAP_SCREEN_PX / Math.max(scale, 0.25);
}