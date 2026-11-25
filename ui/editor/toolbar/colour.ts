// Editor toolbar colours: swatches, previews and gradients.
import { popButton, panelLabel } from './popover.js';
import { resolveColor } from '../../render/render.js';
import { findItem, type EditorState } from '../state.js';
import { hooks, type ToolbarHooks } from './hooks.js';

/** Round colour swatch; its panel offers basic colours first, then any colour. */
export function colorSwatch(
  root: HTMLElement,
  _st: EditorState,
  ref: string,
  title: string,
  key: string,
  onPick: (color: string) => void,
  preview: (color: string) => void,
  extra?: (panel: HTMLElement) => void,
): void {
  const btn = document.createElement('button');
  btn.className = 'swatch-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.style.background = resolveColor(ref, '#111111');
  popButton(root, btn, key, (panel) => {
    panelLabel(panel, 'Basics');
    const basics = document.createElement('div');
    basics.className = 'swatch-grid';
    for (const hex of BASIC_COLOURS) {
      const chip = document.createElement('button');
      chip.className = 'swatch-chip' + (ref.toLowerCase() === hex ? ' on' : '');
      chip.title = hex;
      chip.setAttribute('aria-label', `Colour ${hex}`);
      chip.style.background = hex;
      chip.addEventListener('click', () => onPick(hex));
      basics.append(chip);
    }
    panel.append(basics);
    extra?.(panel);
    panelLabel(panel, 'Custom colour');
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.setAttribute('aria-label', `${title}: custom`);
    custom.value = toHexInput(ref);
    // Live while the picker is open (local only), one commit when it closes: one undo step.
    custom.addEventListener('input', () => {
      btn.style.background = custom.value;
      preview(custom.value);
      hooks?.redraw();
    });
    custom.addEventListener('change', () => onPick(custom.value));
    panel.append(custom);
  });
}

export const BASIC_COLOURS = ['#111111', '#ffffff', '#6b6b6b', '#d9d9d9', '#e5484d', '#f5a524', '#30a46c', '#2f7cf6', '#7c5cff', '#ec5f98'];

/** Small gradient presets for the fill; the renderer already honours the gradient angle. */
export function gradientSwatch(root: HTMLElement, id: string): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const presets = [
    { name: 'Sunset', angle: 135, stops: [{ at: 0, color: '#ff6b35' }, { at: 1, color: '#f7c948' }] },
    { name: 'Ocean', angle: 135, stops: [{ at: 0, color: '#0ea5e9' }, { at: 1, color: '#1e3a8a' }] },
    { name: 'Berry', angle: 135, stops: [{ at: 0, color: '#ec4899' }, { at: 1, color: '#4c1d95' }] },
    { name: 'Night', angle: 135, stops: [{ at: 0, color: '#312e81' }, { at: 1, color: '#020617' }] },
  ];
  const g = document.createElement('div');
  g.className = 'swatch-grid';
  g.title = 'Gradient fill';
  root.append(g);
  for (const p of presets) {
    const btn = document.createElement('button');
    btn.className = 'swatch-chip';
    btn.title = `Gradient fill ${p.name}`;
    btn.setAttribute('aria-label', `Gradient fill ${p.name}`);
    const stops = p.stops.map((s) => `${s.color} ${s.at * 100}%`).join(', ');
    btn.style.background = `linear-gradient(135deg, ${stops})`;
    btn.addEventListener('click', () => {
      const patch = { fill: { angle: p.angle, stops: p.stops } };
      const target = findItem(h.state.design, id);
      if (target) target.props = { ...(target.props ?? {}), ...patch };
      h.redraw();
      void h.commit([{ op: 'update', id, patch }]);
    });
    g.append(btn);
  }
}

export function toHexInput(ref: string): string {
  const got = resolveColor(ref, '');
  if (/^#[0-9a-fA-F]{6}$/.test(got)) return got;
  if (/^#[0-9a-fA-F]{3}$/.test(got)) {
    return `#${got[1]}${got[1]}${got[2]}${got[2]}${got[3]}${got[3]}`;
  }
  return '#111111';
}
