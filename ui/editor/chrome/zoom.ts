// Editor zoom: pill, limits and fitting.
import { state } from '../live.js';
import { relayout } from '../canvas/stage.js';

export let zoomLabel: HTMLButtonElement | null = null;

export let zoomSlider: HTMLInputElement | null = null;

export const ZOOM_MIN = 0.2;

export const ZOOM_MAX = 5;

// The caller repaints after (renderAll): zooming from the pill, the keyboard,
// the wheel and the review slider all share this setter.
export function buildZoomPill(applyZoom: (next: number) => void): HTMLElement {
  const pill = document.createElement('div');
  pill.className = 'zoom-pill';
  const inner = document.createElement('div');
  inner.className = 'inner';
  const out = document.createElement('button');
  out.className = 'btn icon';
  out.title = 'Zoom out';
  out.setAttribute('aria-label', 'Zoom out');
  out.innerHTML = '<i data-lucide="minus"></i>';
  out.addEventListener('click', () => applyZoom(state.view.zoom / 1.25));
  zoomSlider = document.createElement('input');
  zoomSlider.type = 'range';
  zoomSlider.className = 'zoom-slider';
  zoomSlider.min = String(ZOOM_MIN * 100);
  zoomSlider.max = String(ZOOM_MAX * 100);
  zoomSlider.step = '5';
  zoomSlider.setAttribute('aria-label', 'Zoom');
  zoomSlider.addEventListener('input', () => applyZoom(Number(zoomSlider?.value ?? 100) / 100));
  const inp = document.createElement('button');
  inp.className = 'btn icon';
  inp.title = 'Zoom in';
  inp.setAttribute('aria-label', 'Zoom in');
  inp.innerHTML = '<i data-lucide="plus"></i>';
  inp.addEventListener('click', () => applyZoom(state.view.zoom * 1.25));
  // The percentage doubles as "fit to screen" (100 % is the fitted size).
  zoomLabel = document.createElement('button');
  zoomLabel.className = 'zoom-value';
  zoomLabel.title = 'Fit to screen';
  zoomLabel.textContent = `${Math.round(state.view.zoom * 100)}%`;
  zoomSlider.value = String(Math.round(state.view.zoom * 100));
  zoomLabel.addEventListener('click', () => applyZoom(1));
  inner.append(out, zoomSlider, inp, zoomLabel);
  pill.append(inner);
  return pill;
}

export function setZoom(next: number): void {
  state.view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100));
  relayout();
  updateZoomPill();
}

export function updateZoomPill(): void {
  const percent = Math.round(state.view.zoom * 100);
  if (zoomLabel) zoomLabel.textContent = `${percent}%`;
  if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = String(percent);
}