// Editor stage: the canvas box, drawing and layout.
import type { Op } from '../api.js';
import { type EditorState } from '../state.js';
import { pageOf } from '../../engine/index.js';

export interface CanvasHooks {
  state: EditorState;
  commit(ops: Op[], coalesce?: string): Promise<boolean>;
  renderAll(): void;
  setSelection(ids: string[]): void;
  setDirty(dirty: boolean): void;
  setZoom(zoom: number): void;
  startTextEdit(id: string): void;
  /** Repaints the selection frames after a layout (lives in overlay.ts). */
  drawOverlay(): void;
  /** Redraws the rulers after a layout (lives in rulers.ts). */
  queueRulers(): void;
}

export function canvasSize(state: EditorState): { w: number; h: number } {
  const page = pageOf(state.design.format ?? 'story', state.design.width, state.design.height);
  return { w: page.width, h: page.height };
}

export let stageEl: HTMLElement | null = null;
export let overlayEl: HTMLElement | null = null;
export let gridEl: HTMLElement | null = null;
export let safeEl: HTMLElement | null = null;
export let bleedEl: HTMLElement | null = null;
export let boxEl: HTMLElement | null = null;
export let scrollEl: HTMLElement | null = null;
export let hooks: CanvasHooks | null = null;
export let scale = 1;
/**
 * Cached stage position: pointermove uses this instead of measuring the
 * DOM on every move (no layout thrash). Refreshed on layout and scroll.
 */
let boxRect: { left: number; top: number } | null = null;

// Format the stage box was last sized for: a loaded or converted design can change it.
let laidOutFormat = '';

declare const BlumRender: {
  renderDesign(design: unknown, opts: unknown): string;
};

export function mountCanvas(root: HTMLElement, h: CanvasHooks): void {
  hooks = h;
  root.innerHTML = '';
  scrollEl = root;
  boxEl = document.createElement('div');
  boxEl.className = 'stage-box';
  stageEl = document.createElement('div');
  overlayEl = document.createElement('div');
  overlayEl.className = 'overlay';
  gridEl = document.createElement('div');
  gridEl.className = 'grid-overlay';
  gridEl.hidden = true;
  safeEl = document.createElement('div');
  safeEl.className = 'safe-overlay';
  safeEl.hidden = true;
  bleedEl = document.createElement('div');
  bleedEl.className = 'bleed-overlay';
  bleedEl.hidden = true;
  boxEl.append(stageEl, gridEl, safeEl, bleedEl, overlayEl);
  root.append(boxEl);
  // Pointer, wheel and space bindings live in the boot: this module only
  // owns the mounted canvas. Rulers mount beside the scroller, not in it.
  new ResizeObserver(() => layout()).observe(root);
  layout();
}

function layout(): void {
  if (!hooks || !boxEl || !stageEl) return;
  const zone = boxEl.parentElement;
  if (!zone) return;
  laidOutFormat = `${hooks.state.design.format ?? 'story'}|${hooks.state.design.width ?? ''}|${hooks.state.design.height ?? ''}`;
  const size = canvasSize(hooks.state);
  const rect = zone.getBoundingClientRect();
  const fit = Math.min(
    (rect.width - 56) / size.w,
    (rect.height - 56) / size.h,
  );
  const shown = Math.max(0.05, fit * hooks.state.view.zoom);
  scale = shown;
  boxEl.style.width = `${Math.round(size.w * shown)}px`;
  boxEl.style.height = `${Math.round(size.h * shown)}px`;
  stageEl.style.width = `${Math.round(size.w * shown)}px`;
  stageEl.style.fontSize = '16px';
  drawStage();
  // Through the hooks, so this module never imports the overlay or rulers back.
  hooks.drawOverlay();
  refreshRect();
  hooks.queueRulers();
}

/**
 * Re-reads the stage position after layout or scroll (one read, cached).
 * Also called when a gesture starts: layout and scroll keep the cache
 * fresh, but anything else that moves the box (a panel, a banner, an
 * image loading under the stage) would otherwise shift every hit test
 * until the next layout.
 */
export function refreshRect(): void {
  if (!boxEl) return;
  const rect = boxEl.getBoundingClientRect();
  boxRect = { left: rect.left, top: rect.top };
}

export function canvasScale(): number {
  return scale;
}

/** Re-fit the stage box after the zoom or format changed. */
export function relayout(): void {
  layout();
}

export function toDesign(evt: PointerEvent): { x: number; y: number } | null {
  if (!boxEl) return null;
  // The cached rect keeps pointermove off the layout path; fall back to a
  // live read when it is missing (first move before any layout).
  const rect = boxRect ?? (() => {
    const live = boxEl.getBoundingClientRect();
    return { left: live.left, top: live.top };
  })();
  return {
    x: (evt.clientX - rect.left) / scale,
    y: (evt.clientY - rect.top) / scale,
  };
}

export function drawStage(): void {
  if (!hooks || !stageEl) return;
  // A design in another format opened after the blank story start: resize first.
  const key = `${hooks.state.design.format ?? 'story'}|${hooks.state.design.width ?? ''}|${hooks.state.design.height ?? ''}`;
  if (key !== laidOutFormat && boxEl?.parentElement) return layout();
  patchStage(stageEl, BlumRender.renderDesign(hooks.state.design, {
    assetsBase: '/assets',
    mediaBase: '/media',
  }));
}

/**
 * Updates the page in place: only the items whose markup changed are
 * replaced. Rewriting the whole page on every change re-decoded every photo
 * and re-laid every text, which flickered (effects, colours, drags).
 */
function patchStage(host: HTMLElement, html: string): void {
  const fresh = document.createElement('div');
  // Safe: callers pass renderDesign output, whose design strings are escaped.
  fresh.innerHTML = html;
  const next = fresh.firstElementChild;
  const prev = host.firstElementChild;
  if (!next || !prev || prev.tagName !== next.tagName || prev.className !== next.className
    || prev.children.length !== next.children.length) {
    host.replaceChildren(...Array.from(fresh.childNodes));
    return;
  }
  if (prev.getAttribute('style') !== next.getAttribute('style')) {
    prev.setAttribute('style', next.getAttribute('style') ?? '');
  }
  const olds = Array.from(prev.children);
  const news = Array.from(next.children);
  news.forEach((n, i) => {
    if (olds[i].outerHTML !== n.outerHTML) olds[i].replaceWith(n);
  });
}