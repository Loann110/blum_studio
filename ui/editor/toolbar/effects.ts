// Editor toolbar effects: shadows and photo filters.
import { liveRange, switchRow, toolGroup } from './controls.js';
import { panelLabel } from './popover.js';
import { colorSwatch } from './colour.js';
import { hooks, type ToolbarHooks } from './hooks.js';
import { previewProps, findItem, type EditorState } from '../state.js';

/** The Effects section of the shape, sticker and group More panels: the
 * drop shadow (same defaults as the text shadow). */
export function shadowMoreSections(
  panel: HTMLElement,
  st: EditorState,
  id: string,
  swatchKey: string,
): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const props = (findItem(st.design, id)?.props ?? {}) as Record<string, string | number | boolean>;
  const patch = (p: Record<string, unknown>): void => void h.commit([{ op: 'update', id, patch: p }]);
  panelLabel(panel, 'Effects');
  const shadowOn = typeof props.shadowColor === 'string' && props.shadowColor !== '';
  switchRow(panel, 'Shadow', 'Drop shadow', shadowOn, () => patch(shadowOn
    ? { shadowColor: '' }
    : { shadowColor: 'rgba(0,0,0,0.35)', shadowX: 0, shadowY: 3, shadowBlur: 8 }));
  if (shadowOn) {
    const box = toolGroup(panel);
    colorSwatch(box, st, String(props.shadowColor), 'Shadow colour', swatchKey,
      (color) => patch({ shadowColor: color }),
      (color) => previewProps(st, id, { shadowColor: color }));
    liveRange(panel, st, id, 'Shadow blur', Number(props.shadowBlur ?? 8), 0, 60, 1,
      (v) => `${v} px`, (v) => ({ shadowBlur: v }), `shadow:${id}`);
  }
}

export const FILTER_PRESET_LABELS: [string, string][] = [
  ['original', 'Original'],
  ['vivid', 'Vivid'],
  ['warm', 'Warm'],
  ['cold', 'Cold'],
  ['mono', 'Mono'],
  ['noir', 'Noir'],
  ['faded', 'Faded'],
  ['vintage', 'Vintage'],
  ['dramatic', 'Dramatic'],
];

/** The Filters section of the photo and image More panels:
 * one look, six sliders, two toggles, and a reset. */
export function filterMoreSections(panel: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const props = (findItem(st.design, id)?.props ?? {}) as Record<string, string | number | boolean>;
  const key = `filters:${id}`;
  // Discrete picks commit alone; only slider releases share the scrub key.
  const patch = (p: Record<string, unknown>): void => void h.commit([{ op: 'update', id, patch: p }]);
  panelLabel(panel, 'Filters');
  const grid = document.createElement('div');
  grid.className = 'swatch-grid';
  for (const [preset, label] of FILTER_PRESET_LABELS) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (String(props.filterPreset ?? 'original') === preset ? ' on' : '');
    btn.textContent = label;
    btn.title = `Filter ${label}`;
    btn.setAttribute('aria-label', `Filter ${label}`);
    btn.setAttribute('aria-pressed', String(String(props.filterPreset ?? 'original') === preset));
    btn.addEventListener('click', () => patch({ filterPreset: preset }));
    grid.append(btn);
  }
  panel.append(grid);
  panelLabel(panel, 'Adjust');
  liveRange(panel, st, id, 'Brightness', Number(props.brightness ?? 0), -100, 100, 1,
    (v) => `${v}`, (v) => ({ brightness: v }), key);
  liveRange(panel, st, id, 'Contrast', Number(props.contrast ?? 0), -100, 100, 1,
    (v) => `${v}`, (v) => ({ contrast: v }), key);
  liveRange(panel, st, id, 'Saturation', Number(props.saturation ?? 0), -100, 100, 1,
    (v) => `${v}`, (v) => ({ saturation: v }), key);
  liveRange(panel, st, id, 'Hue', Number(props.hue ?? 0), -180, 180, 1,
    (v) => `${v}°`, (v) => ({ hue: v }), key);
  liveRange(panel, st, id, 'Blur', Number(props.blur ?? 0), 0, 100, 1,
    (v) => `${v} px`, (v) => ({ blur: v }), key);
  liveRange(panel, st, id, 'Vignette', Number(props.vignette ?? 0), 0, 100, 1,
    (v) => `${v} %`, (v) => ({ vignette: v }), key);
  switchRow(panel, 'Black & white', 'Black and white', props.grayscale === true,
    () => patch({ grayscale: !(props.grayscale === true) }));
  switchRow(panel, 'Sepia', 'Sepia', props.sepia === true,
    () => patch({ sepia: !(props.sepia === true) }));
  const reset = document.createElement('button');
  reset.className = 'btn';
  reset.textContent = 'Reset filters';
  reset.title = 'Reset filters';
  reset.setAttribute('aria-label', 'Reset filters');
  reset.addEventListener('click', () => patch({
    filterPreset: 'original', brightness: 0, contrast: 0, saturation: 0,
    hue: 0, blur: 0, vignette: 0, grayscale: false, sepia: false,
  }));
  panel.append(reset);
}