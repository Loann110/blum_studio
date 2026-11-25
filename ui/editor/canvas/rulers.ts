// Editor rulers: pixel rulers along the canvas.
import { boxEl, hooks, scale, scrollEl } from './stage.js';

/** Backing store for one ruler strip, sized for the device pixels. */
export function fitCanvas(c: HTMLCanvasElement, w: number, hgt: number, dpr: number): void {
  const wpx = Math.max(1, Math.round(w * dpr));
  const hpx = Math.max(1, Math.round(hgt * dpr));
  if (c.width !== wpx || c.height !== hpx) {
    c.width = wpx;
    c.height = hpx;
  }
  c.style.width = `${Math.round(w)}px`;
  c.style.height = `${Math.round(hgt)}px`;
}

let rulersEl: HTMLElement | null = null;
let rulerCorner: HTMLElement | null = null;
let rulerH: HTMLCanvasElement | null = null;
let rulerV: HTMLCanvasElement | null = null;
let rulerQueued = false;

// Rulers live next to the scroller (not inside it): they stay put while
// the page scrolls under them, and redraw from the scroll position.
export function mountRulers(root: HTMLElement): void {
  const zone = root.parentElement;
  if (zone) {
    rulersEl = document.createElement('div');
    rulersEl.className = 'rulers';
    rulersEl.hidden = true;
    rulerCorner = document.createElement('div');
    rulerCorner.className = 'ruler-corner';
    rulerH = document.createElement('canvas');
    rulerH.className = 'ruler-h';
    rulerV = document.createElement('canvas');
    rulerV.className = 'ruler-v';
    rulersEl.append(rulerCorner, rulerH, rulerV);
    zone.append(rulersEl);
  }
}

/** Schedules a ruler redraw on the next frame (scroll fires faster than paint). */
export function queueRulers(): void {
  if (rulerQueued || !rulersEl || rulersEl.hidden) return;
  rulerQueued = true;
  requestAnimationFrame(() => {
    rulerQueued = false;
    drawRulers();
  });
}

/** Shows or hides the rulers; showing draws them right away. */
export function setRulersVisible(visible: boolean): void {
  if (rulersEl) rulersEl.hidden = !visible;
  if (visible) drawRulers();
}

/**
 * Pixel rulers along the canvas, following zoom and scroll: tick zero
 * sits on the page edge, labels count design pixels from it.
 */
export function drawRulers(): void {
  if (!hooks || !boxEl || !scrollEl || !rulersEl || !rulerH || !rulerV || rulersEl.hidden) return;
  // The scroller starts under the context bar; strips are placed from its offset.
  const top = scrollEl.offsetTop;
  const left = scrollEl.offsetLeft;
  const h = rulerH;
  const v = rulerV;
  const hW = Math.max(1, scrollEl.clientWidth - left - 22);
  const vH = Math.max(1, scrollEl.clientHeight - 22);
  if (rulerCorner) {
    rulerCorner.style.left = `${left}px`;
    rulerCorner.style.top = `${top}px`;
  }
  h.style.left = `${left + 22}px`;
  h.style.top = `${top}px`;
  v.style.left = `${left}px`;
  v.style.top = `${top + 22}px`;
  const dpr = Math.max(1, Math.round(window.devicePixelRatio ?? 1));
  fitCanvas(h, hW, 22, dpr);
  fitCanvas(v, 22, vH, dpr);
  // Stage edge in ruler coordinates (scroll position included).
  const edgeX = boxEl.offsetLeft - scrollEl.scrollLeft - (left + 22);
  const edgeY = boxEl.offsetTop - scrollEl.scrollTop - (top + 22);
  paintRuler(h.getContext('2d'), dpr, true, edgeX);
  paintRuler(v.getContext('2d'), dpr, false, edgeY);
}

/** One ruler strip: ticks every step, labels every five when they fit. */
export function paintRuler(
  ctx: CanvasRenderingContext2D | null,
  dpr: number,
  horizontal: boolean,
  edge: number,
): void {
  if (!ctx) return;
  const steps = [5, 10, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((s) => s * scale >= 12) ?? 1000;
  const span = (horizontal ? ctx.canvas.width : ctx.canvas.height) / dpr;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = '#9a9aa3';
  ctx.fillStyle = '#6f6f78';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.lineWidth = 1;
  const first = Math.max(0, Math.floor((-edge) / (step * scale)));
  const last = Math.ceil((span - edge) / (step * scale));
  const labelEvery = step * scale * 5 >= 30 ? 5 : 10;
  for (let i = first; i <= last; i++) {
    const at = Math.round(edge + i * step * scale) + 0.5;
    const major = i % labelEvery === 0;
    const len = major ? 12 : i % 5 === 0 ? 8 : 5;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(at, 22);
      ctx.lineTo(at, 22 - len);
    } else {
      ctx.moveTo(22, at);
      ctx.lineTo(22 - len, at);
    }
    ctx.stroke();
    if (major) {
      const label = String(i * step);
      if (horizontal) ctx.fillText(label, at + 3, 10);
      else ctx.fillText(label, 3, at - 3);
    }
  }
  ctx.restore();
}