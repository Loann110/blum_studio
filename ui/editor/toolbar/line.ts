// Editor toolbar line tools: colour, caps, style and curve.
import { lineCaps } from '../../render/render.js';
import { lineBox, lineHandles } from '../geometry/lines.js';
import { colorSwatch } from './colour.js';
import { caption, numberStepper, separator, toolGroup } from './controls.js';
import { opacityStepper } from './shared.js';
import { hooks } from './hooks.js';
import { previewProps, findItem, type DesignItem, type EditorState } from '../state.js';
import type { ShapeProps } from '../../render/render.js';

export const CAPS: [string, string][] = [
  ['none', 'None'],
  ['arrow', 'Arrow'],
  ['triangle', 'Triangle'],
  ['circle', 'Circle'],
  ['square', 'Square'],
  ['bar', 'Bar'],
];

export const LINE_STYLES: [string, string][] = [
  ['solid', 'Solid'],
  ['dashed', 'Dashed'],
  ['dotted', 'Dotted'],
];

/**
 * Lines and arrows, like Canva: one colour, thickness, style, a cap for each
 * end, the cap size and the curve. Every change refits the box around the
 * line so its two ends stay where they are (they move with the end handles).
 */
export function renderLineTools(root: HTMLElement, st: EditorState, it: DesignItem): void {
  const props = (it.props ?? {}) as Record<string, unknown>;
  const id = it.id;
  const commit = (patch: Record<string, unknown>): void => {
    // Live item, not the build-time one: a skipped rebuild (sameBar) leaves
    // older controls in place, and the box must refit the current ends.
    const live = (hooks && findItem(hooks.state.design, id)) || it;
    const ends = lineHandles(live);
    const merged = { ...((live.props ?? {}) as ShapeProps), ...patch } as ShapeProps;
    const bend = Number(merged.bend ?? 0);
    void hooks?.commit([{ op: 'update', id, patch: { ...patch, ...lineBox(merged, ends.start, ends.end, bend) } }]);
  };
  // One colour for the whole line: the stroke colour is dropped so it cannot win over it.
  const ink = typeof props.stroke === 'string' && props.stroke ? props.stroke : typeof props.fill === 'string' ? props.fill : '#111111';
  colorSwatch(root, st, ink, 'Line colour', 'line-colour', (fill) => {
    void hooks?.commit([{ op: 'update', id, patch: { fill, stroke: '' } }]);
  }, (fill) => previewProps(st, id, { fill, stroke: '' }));
  numberStepper(root, Number(props.strokeWidth ?? 0) || 4, 1, 1, 120, 'thickness', (v) => commit({ strokeWidth: v }));
  caption(root, 'Thickness');
  lineStyleSelect(root, typeof props.lineStyle === 'string' ? props.lineStyle : String(props.shape) === 'dotted' ? 'dotted' : 'solid',
    (lineStyle) => commit({ lineStyle }));
  const [startCap, endCap] = lineCaps(String(props.shape ?? 'line'), props.startCap as string | undefined, props.endCap as string | undefined);
  capSelect(root, 'Line start', startCap, (v) => commit({ startCap: v }));
  capSelect(root, 'Line end', endCap, (v) => commit({ endCap: v }));
  if (startCap !== 'none' || endCap !== 'none') {
    numberStepper(root, Number(props.headSize ?? 0), 2, 0, 500, 'ends size', (v) => commit({ headSize: v }));
    caption(root, 'Ends');
  }
  // The bend is a fraction in the JSON, a percent in the bar; the handle on the line does the same.
  numberStepper(root, Math.round(Number(props.bend ?? 0) * 100), 5, -100, 100, 'curve', (v) => commit({ bend: v / 100 }));
  caption(root, 'Curve');
  opacityStepper(root, st, [id]);
  separator(root);
}

export function capSelect(root: HTMLElement, label: string, value: string, onPick: (cap: string) => void): void {
  const select = document.createElement('select');
  select.className = 'weight-select';
  select.title = label;
  select.setAttribute('aria-label', label);
  for (const [v, name] of CAPS) {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = `${label === 'Line start' ? 'Start' : 'End'}: ${name}`;
    option.selected = v === value;
    select.append(option);
  }
  select.addEventListener('change', () => onPick(select.value));
  toolGroup(root).append(select);
}

/** Line-style picker for lines and line arrows, like the weight picker. */
export function lineStyleSelect(root: HTMLElement, value: string, onPick: (style: string) => void): void {
  const select = document.createElement('select');
  select.className = 'weight-select';
  select.title = 'Line style';
  select.setAttribute('aria-label', 'Line style');
  const current = LINE_STYLES.some(([v]) => v === value) ? value : 'solid';
  for (const [v, name] of LINE_STYLES) {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = name;
    option.selected = v === current;
    select.append(option);
  }
  select.addEventListener('change', () => onPick(select.value));
  toolGroup(root).append(select);
}