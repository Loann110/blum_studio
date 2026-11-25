// Editor toolbar text tools.
import { fontPicker, fonts, weightSelect } from './font.js';
import { decimalStepper, iconButton, numberStepper, separator, switchRow, toolGroup } from './controls.js';
import { popButton, panelLabel } from './popover.js';
import { colorSwatch } from './colour.js';
import { opacityStepper } from './shared.js';
import { hooks, type ToolbarHooks } from './hooks.js';
import { previewProps, findItem, type EditorState } from '../state.js';

export async function renderTextTools(
  root: HTMLElement,
  st: EditorState,
  id: string,
): Promise<void> {
  if (!hooks) return;
  const it = findItem(st.design, id);
  const props = (it?.props ?? {}) as Record<string, string | number | boolean>;
  const list = await fonts();
  const patch = (p: Record<string, unknown>): void => void hooks?.commit([{ op: 'update', id, patch: p }]);
  toolGroup(root).append(fontPicker(list, String(props.font ?? 'Inter'), (font) => patch({ font })));
  weightSelect(root, Number(props.weight ?? 400), (weight) => patch({ weight }));
  numberStepper(root, Number(props.size ?? 64), 4, 12, 400, 'size', (v) => patch({ size: v }));
  colorSwatch(root, st, String(props.color ?? '#111111'), 'Text colour', 'text-color', (color) => patch({ color }),
    (color) => previewProps(st, id, { color }));
  const style = toolGroup(root);
  const toggle = (html: string, title: string, on: boolean, run: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = 'btn icon' + (on ? ' on' : '');
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = html;
    btn.addEventListener('click', run);
    return btn;
  };
  const weight = Number(props.weight ?? 400);
  style.append(
    toggle('<b style="font-size:13px">B</b>', 'Bold (Ctrl+B)', weight >= 700, () => patch({ weight: weight >= 700 ? 400 : 700 })),
    toggle('<i style="font-size:13px">I</i>', 'Italic (Ctrl+I)', props.italic === true, () => patch({ italic: !(props.italic === true) })),
    toggle('<u style="font-size:13px">U</u>', 'Underline (Ctrl+U)', props.decoration === 'underline',
      () => patch({ decoration: props.decoration === 'underline' ? 'none' : 'underline' })),
  );
  // One alignment button that cycles.
  const aligns = ['left', 'center', 'right'] as const;
  const current = aligns.includes(props.align as (typeof aligns)[number]) ? (props.align as (typeof aligns)[number]) : 'left';
  const icons = { left: 'text-align-start', center: 'text-align-center', right: 'text-align-end' };
  toolGroup(root).append(
    iconButton(icons[current], `Alignment: ${current}`, () => {
      patch({ align: aligns[(aligns.indexOf(current) + 1) % aligns.length] });
    }),
  );
  popButton(root, iconButton('unfold-vertical', 'Spacing', () => undefined), 'text-spacing', (panel) => {
    panelLabel(panel, 'Line height');
    decimalStepper(panel, Number(props.lineHeight ?? 1.2), 0.1, 0.5, 4, 'line height', (v) => patch({ lineHeight: v }));
    panelLabel(panel, 'Letter spacing');
    numberStepper(panel, Number(props.letterSpacing ?? 0), 1, -20, 100, 'letter spacing', (v) => patch({ letterSpacing: v }));
  });
  toolGroup(root).append(
    iconButton('case-upper', 'Uppercase / normal case', () => {
      patch({ textCase: props.textCase === 'upper' ? 'none' : 'upper' });
    }, props.textCase === 'upper'),
  );
  // Curved text (arc up, arc down, amount).
  popButton(root, iconButton('spline', 'Curved text', () => undefined,
    props.curve === 'up' || props.curve === 'down'), 'text-curve', (panel) => {
    panelLabel(panel, 'Curve');
    const row = document.createElement('div');
    row.className = 'curve-row';
    for (const [mode, label] of [['up', 'Arc up'], ['down', 'Arc down']] as const) {
      const btn = document.createElement('button');
      btn.className = 'btn curve-btn' + (props.curve === mode ? ' on' : '');
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', String(props.curve === mode));
      btn.innerHTML = `<span>${label}</span><svg viewBox="0 0 48 16" width="48" height="16" aria-hidden="true">`
        + (mode === 'up'
          ? '<path d="M4,13 Q24,-5 44,13" fill="none" stroke="currentColor" stroke-width="2"/>'
          : '<path d="M4,3 Q24,21 44,3" fill="none" stroke="currentColor" stroke-width="2"/>')
        + '</svg>';
      btn.addEventListener('click', () => {
        const live = (findItem(st.design, id)?.props ?? {}) as Record<string, unknown>;
        const next = live.curve === mode ? 'none' : mode;
        const full: Record<string, unknown> = { curve: next };
        if (next !== 'none' && !live.curveAmount) full.curveAmount = 48;
        patch(full);
      });
      row.append(btn);
    }
    panel.append(row);
    if (props.curve === 'up' || props.curve === 'down') {
      panelLabel(panel, 'Amount');
      numberStepper(panel, Number(props.curveAmount ?? 48), 4, 0, 200, 'curve amount',
        (v) => patch({ curveAmount: v }));
    }
  });
  opacityStepper(root, st, [id]);
  separator(root);
}

/** The Text and Effects sections of the text More panel. */
export function textMoreSections(panel: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const props = (findItem(st.design, id)?.props ?? {}) as Record<string, string | number | boolean>;
  const patch = (p: Record<string, unknown>): void => void h.commit([{ op: 'update', id, patch: p }]);
  panelLabel(panel, 'Text');
  switchRow(panel, 'Strikethrough', 'Strikethrough', props.strikethrough === true,
    () => patch({ strikethrough: !(props.strikethrough === true) }));
  switchRow(panel, 'Bullet list', 'Bullet list', props.list === 'bullet',
    () => patch({ list: props.list === 'bullet' ? 'none' : 'bullet' }));
  switchRow(panel, 'Numbered list', 'Numbered list', props.list === 'numbered',
    () => patch({ list: props.list === 'numbered' ? 'none' : 'numbered' }));
  switchRow(panel, 'Shrink to fit', 'Shrink the size down to a minimum to stay in the box',
    props.shrinkToFit === true, () => patch({ shrinkToFit: !(props.shrinkToFit === true) }));
  if (props.shrinkToFit === true) {
    panelLabel(panel, 'Minimum size');
    numberStepper(panel, Number(props.minSize ?? 12), 2, 8, 200, 'minimum size',
      (v) => patch({ minSize: v }));
  }
  panelLabel(panel, 'Effects');
  const shadowOn = typeof props.shadowColor === 'string' && props.shadowColor !== '';
  switchRow(panel, 'Shadow', 'Drop shadow', shadowOn, () => patch(shadowOn
    ? { shadowColor: '' }
    : { shadowColor: 'rgba(0,0,0,0.35)', shadowX: 0, shadowY: 3, shadowBlur: 8 }));
  if (shadowOn) {
    const box = toolGroup(panel);
    colorSwatch(box, st, String(props.shadowColor), 'Shadow colour', 'text-shadow',
      (color) => patch({ shadowColor: color }),
      (color) => previewProps(st, id, { shadowColor: color }));
    panelLabel(panel, 'Shadow blur');
    numberStepper(panel, Number(props.shadowBlur ?? 8), 2, 0, 60, 'shadow blur',
      (v) => patch({ shadowBlur: v }));
  }
  switchRow(panel, 'Hollow', 'Hollow text', props.hollow === true,
    () => patch({ hollow: !(props.hollow === true) }));
  const outlineOn = typeof props.stroke === 'string' && props.stroke !== '' && Number(props.strokeWidth) > 0;
  switchRow(panel, 'Outline', 'Text outline', outlineOn, () => patch(outlineOn
    ? { stroke: '', strokeWidth: 0 }
    : { stroke: '#ffffff', strokeWidth: 2 }));
  if (outlineOn) {
    const box = toolGroup(panel);
    colorSwatch(box, st, String(props.stroke), 'Outline colour', 'text-outline',
      (color) => patch({ stroke: color }),
      (color) => previewProps(st, id, { stroke: color }));
    panelLabel(panel, 'Outline width');
    numberStepper(panel, Number(props.strokeWidth ?? 2), 1, 1, 20, 'outline width',
      (v) => patch({ strokeWidth: v }));
  }
  const glowOn = typeof props.haloColor === 'string' && props.haloColor !== '';
  switchRow(panel, 'Glow', 'Soft halo around the text', glowOn, () => patch(glowOn
    ? { haloColor: '' }
    : { haloColor: String(props.color ?? '#111111'), haloBlur: 14 }));
  if (glowOn) {
    const box = toolGroup(panel);
    colorSwatch(box, st, String(props.haloColor), 'Glow colour', 'text-glow',
      (color) => patch({ haloColor: color }),
      (color) => previewProps(st, id, { haloColor: color }));
    panelLabel(panel, 'Glow blur');
    numberStepper(panel, Number(props.haloBlur ?? 14), 2, 0, 60, 'glow blur',
      (v) => patch({ haloBlur: v }));
  }
  panelLabel(panel, 'Highlight');
  const hl = toolGroup(panel);
  colorSwatch(hl, st, typeof props.background === 'string' ? props.background : '', 'Highlight colour',
    'text-highlight', (background) => patch({ background }),
    (background) => previewProps(st, id, { background }));
  panelLabel(panel, 'Curve');
  const curveRow = document.createElement('div');
  curveRow.className = 'curve-row';
  for (const [mode, label] of [['up', 'Arc up'], ['down', 'Arc down']] as const) {
    const btn = document.createElement('button');
    btn.className = 'btn curve-btn' + (props.curve === mode ? ' on' : '');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', String(props.curve === mode));
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const live = (findItem(st.design, id)?.props ?? {}) as Record<string, unknown>;
      const next = live.curve === mode ? 'none' : mode;
      const full: Record<string, unknown> = { curve: next };
      if (next !== 'none' && !live.curveAmount) full.curveAmount = 48;
      patch(full);
    });
    curveRow.append(btn);
  }
  panel.append(curveRow);
  if (props.curve === 'up' || props.curve === 'down') {
    panelLabel(panel, 'Curve amount');
    numberStepper(panel, Number(props.curveAmount ?? 48), 4, 0, 200, 'curve amount',
      (v) => patch({ curveAmount: v }));
  }
}