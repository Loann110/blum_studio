// Editor overlay: selection frames, handles and guides.
import { bleedEl, canvasSize, gridEl, hooks, overlayEl, safeEl, scale } from './stage.js';
import { pageOf } from '../../engine/index.js';
import { session } from '../gestures/session.js';
import { isLine } from '../gestures/line.js';
import { selectedToplevel, topItems, type DesignItem, type EditorState } from '../state.js';
import { boxOf } from '../geometry/boxes.js';
import { unionBox } from '../geometry/angles.js';
import { lineHandles, type HandleName, type LineHandle } from '../geometry/lines.js';
import type { Guide } from '../geometry/snapping.js';

const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const satisfies readonly HandleName[];
// Lines (Canva-like) have their two ends and a bend handle instead of a box.
type BoxHandle = Exclude<HandleName, LineHandle>;
export const LINE_HANDLES: readonly LineHandle[] = ['start', 'end', 'bend'];

/** The selection frame sits 2 px outside the item. */
const FRAME_PAD = 2;

let guides: Guide[] = [];
export function setGuides(next: Guide[]): void { guides = next; }
export function addGuide(g: Guide): void { guides.push(g); }

export function drawOverlay(): void {
  if (!hooks || !overlayEl || !gridEl || !safeEl || !bleedEl) return;
  // An open inline text edit lives inside the overlay: never detach it.
  // Detaching would blur it, which commits a phantom edit and then blocks
  // the real Enter (the done flag). Remove frames and handles only.
  const st = hooks.state;
  drawChrome(st);
  // Selective wipe: frames, handles and guides are redrawn, but any
  // other child (the inline text edit, the marquee) is left where it is.
  overlayEl.querySelectorAll('.sel, .multi-sel, .ghost, .handle, .handle-stem, .guide').forEach((el) => el.remove());
  const size = canvasSize(st);
  drawGuides(size);
  // While moving, the frame and handles fade to half; they stay visible for every gesture.
  const moving = session !== null && session.moved && session.kind === 'move';
  const selected = selectedToplevel(st);
  drawFrames(selected, moving);
  drawGhosts(st, selected);
  drawHandles(selected, moving);
}

/** Grid, safe zones and bleed: the page chrome around the canvas. */
function drawChrome(st: EditorState): void {
  if (!gridEl || !safeEl || !bleedEl) return;
  gridEl.hidden = !st.view.grid;
  safeEl.hidden = !st.view.safeZones;
  if (st.view.safeZones) {
    const size = canvasSize(st);
    const page = pageOf(st.design.format ?? 'story', st.design.width, st.design.height);
    safeEl.style.inset = `${(page.safe.top / size.h) * 100}% ${(page.safe.sides / size.w) * 100}% ${(page.safe.bottom / size.h) * 100}% ${(page.safe.sides / size.w) * 100}%`;
  }
  // Print pages show the 3 mm bleed edge outside the trim.
  const page = pageOf(st.design.format ?? 'story', st.design.width, st.design.height);
  const showBleed = st.view.bleed && page.kind === 'print';
  bleedEl.hidden = !showBleed;
  if (showBleed) {
    const bleedPx = (3 / 25.4) * 150;
    bleedEl.style.inset = `${-bleedPx * scale}px`;
  }
}

function drawGuides(size: { w: number; h: number }): void {
  if (!overlayEl) return;
  for (const g of guides) {
    const line = document.createElement('div');
    line.className = 'guide';
    if (g.vertical) {
      line.style.left = `${g.at * scale}px`;
      line.style.top = '0';
      line.style.width = '1.5px';
      line.style.height = `${size.h * scale}px`;
    } else {
      line.style.top = `${g.at * scale}px`;
      line.style.left = '0';
      line.style.height = '1.5px';
      line.style.width = `${size.w * scale}px`;
    }
    overlayEl.append(line);
  }
}

/** One frame div around a box, rotated when the item is. */
function frameDiv(className: string, box: { x: number; y: number; w: number; h: number }, angle: number | null, moving: boolean): void {
  if (!overlayEl) return;
  const frame = document.createElement('div');
  frame.className = className;
  frame.style.left = `${(box.x - box.w / 2) * scale - FRAME_PAD}px`;
  frame.style.top = `${(box.y - box.h / 2) * scale - FRAME_PAD}px`;
  frame.style.width = `${box.w * scale + FRAME_PAD * 2}px`;
  frame.style.height = `${box.h * scale + FRAME_PAD * 2}px`;
  if (angle !== null) {
    frame.style.transform = `rotate(${angle}deg)`;
    frame.style.transformOrigin = 'center';
  }
  if (moving) frame.style.opacity = '0.5';
  overlayEl.append(frame);
}

/** The frame around the selection: one shared box, or one box per item. */
function drawFrames(selected: DesignItem[], moving: boolean): void {
  if (!overlayEl) return;
  if (selected.length > 1) {
    // One frame around the whole active selection, as in the reference.
    const outer = unionBox(selected.map(boxOf));
    frameDiv('multi-sel', outer, null, moving);
    drawMultiHandles(outer, moving);
  } else {
    for (const it of selected) {
      // A lone line shows only its end and bend handles (no box), as in Canva.
      if (selected.length === 1 && isLine(it)) continue;
      const b = boxOf(it);
      frameDiv('sel', b, b.angle, moving);
    }
  }
}

/** Dashed outlines of the other items while something is selected. */
function drawGhosts(st: EditorState, selected: DesignItem[]): void {
  if (!overlayEl || selected.length === 0) return;
  const ids = new Set(selected.map((it) => it.id));
  for (const it of topItems(st.design)) {
    if (ids.has(it.id) || it.visible === false) continue;
    const b = boxOf(it);
    frameDiv('ghost', b, b.angle, false);
  }
}

/** Handles for a single selection only. */
function drawHandles(selected: DesignItem[], moving: boolean): void {
  if (!overlayEl) return;
  if (selected.length === 1 && !selected[0].locked && isLine(selected[0])) {
    const ends = lineHandles(selected[0]);
    const spots: Record<LineHandle, { x: number; y: number }> = {
      start: ends.start,
      end: ends.end,
      bend: ends.apex,
    };
    for (const name of LINE_HANDLES) {
      const dot = document.createElement('div');
      dot.className = name === 'bend' ? 'handle line-bend' : 'handle line-end';
      dot.dataset.handle = name;
      dot.title = name === 'bend' ? 'Drag to curve' : 'Drag to move this end';
      dot.style.left = `${spots[name].x * scale}px`;
      dot.style.top = `${spots[name].y * scale}px`;
      if (moving) dot.style.opacity = '0.5';
      overlayEl.append(dot);
    }
  } else if (selected.length === 1 && !selected[0].locked) {
    const it = selected[0];
    const b = boxOf(it);
    const cx = b.x * scale;
    const cy = b.y * scale;
    const rad = (b.angle * Math.PI) / 180;
    const place = (dx: number, dy: number): { x: number; y: number } => ({
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    });
    const hw = (b.w * scale) / 2 + FRAME_PAD;
    const hh = (b.h * scale) / 2 + FRAME_PAD;
    const spots: Record<BoxHandle, { x: number; y: number }> = {
      nw: place(-hw, -hh),
      n: place(0, -hh),
      ne: place(hw, -hh),
      e: place(hw, 0),
      se: place(hw, hh),
      s: place(0, hh),
      sw: place(-hw, hh),
      w: place(-hw, 0),
      rotate: place(0, -hh - 28),
    };
    // Stem from the top edge to the rotate handle.
    const stem = document.createElement('div');
    stem.className = 'handle-stem';
    const top = place(0, -hh);
    stem.style.left = `${top.x}px`;
    stem.style.top = `${top.y - 28}px`;
    stem.style.transform = `rotate(${b.angle}deg)`;
    if (moving) stem.style.opacity = '0.5';
    overlayEl.append(stem);
    for (const name of [...handlesFor(it.type), 'rotate'] as BoxHandle[]) {
      const dot = document.createElement('div');
      dot.className = name === 'rotate' ? 'handle rotate' : 'handle';
      dot.dataset.handle = name;
      dot.style.left = `${spots[name].x}px`;
      dot.style.top = `${spots[name].y}px`;
      if (name !== 'rotate') dot.style.cursor = cursorFor(name, b.angle);
      if (moving) dot.style.opacity = '0.5';
      overlayEl.append(dot);
    }
  }
}

/**
 * The active selection gets all eight handles plus a rotate handle: every
 * member scales and turns with the frame, as in the reference.
 */
function drawMultiHandles(outer: { x: number; y: number; w: number; h: number }, moving: boolean): void {
  if (!hooks || !overlayEl) return;
  const movable = selectedToplevel(hooks.state).filter((it) => !it.locked);
  if (movable.length === 0) return;
  const hw = (outer.w * scale) / 2 + FRAME_PAD;
  const hh = (outer.h * scale) / 2 + FRAME_PAD;
  const cx = outer.x * scale;
  const cy = outer.y * scale;
  const spots: Record<BoxHandle, { x: number; y: number }> = {
    nw: { x: cx - hw, y: cy - hh },
    n: { x: cx, y: cy - hh },
    ne: { x: cx + hw, y: cy - hh },
    e: { x: cx + hw, y: cy },
    se: { x: cx + hw, y: cy + hh },
    s: { x: cx, y: cy + hh },
    sw: { x: cx - hw, y: cy + hh },
    w: { x: cx - hw, y: cy },
    rotate: { x: cx, y: cy - hh - 28 },
  };
  const stem = document.createElement('div');
  stem.className = 'handle-stem';
  stem.style.left = `${cx}px`;
  stem.style.top = `${cy - hh - 28}px`;
  if (moving) stem.style.opacity = '0.5';
  overlayEl.append(stem);
  for (const name of [...HANDLE_NAMES, 'rotate'] as BoxHandle[]) {
    const dot = document.createElement('div');
    dot.className = name === 'rotate' ? 'handle rotate' : 'handle';
    dot.dataset.handle = name;
    dot.style.left = `${spots[name].x}px`;
    dot.style.top = `${spots[name].y}px`;
    if (name !== 'rotate') dot.style.cursor = cursorFor(name, 0);
    if (moving) dot.style.opacity = '0.5';
    overlayEl.append(dot);
  }
}

/**
 * Handles per kind: shapes get all eight; text gets the corners (scale the
 * letters) and the two sides (wrap width); photos, stickers and groups only
 * the corners, so they never stretch.
 */
function handlesFor(type: string): readonly (typeof HANDLE_NAMES)[number][] {
  if (type === 'shape') return HANDLE_NAMES;
  if (type === 'text') return ['nw', 'ne', 'e', 'se', 'sw', 'w'];
  return ['nw', 'ne', 'se', 'sw'];
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const HANDLE_DEG: Record<string, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

/** Resize cursor that follows the item's rotation. */
function cursorFor(name: string, angle: number): string {
  const deg = (((HANDLE_DEG[name] + angle) % 180) + 180) % 180;
  return CURSORS[Math.round(deg / 45) % 4];
}