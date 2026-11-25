// Text panel: add titles, curved text, and font pairs.
// Inserts go through the same op pipeline as every other edit.
import type { Op } from '../api.js';
import { refreshIcons } from '../icons.js';
import { freshId, type EditorHooks, type EditorState } from '../state.js';
import { pageOf } from '../../engine/index.js';
import { staggerCenter } from './hooks.js';

export interface TextPanelHooks extends EditorHooks {
  startTextEdit(id: string): void;
}

let hooks: TextPanelHooks | null = null;

export function mountTextPanel(h: TextPanelHooks): void {
  hooks = h;
}

let addCounter = 0;

function centerOf(state: EditorState): { x: number; y: number } {
  addCounter += 1;
  return staggerCenter(state, addCounter);
}

/* ---- presets ---- */

interface TextPreset {
  label: string;
  text: string;
  font: string;
  size: number;
  weight: number;
}

const TEXT_PRESETS: TextPreset[] = [
  { label: 'Title', text: 'Add a title', font: 'Plus Jakarta Sans', size: 96, weight: 800 },
  { label: 'Subtitle', text: 'Add a subtitle', font: 'Plus Jakarta Sans', size: 52, weight: 600 },
  { label: 'Body', text: 'Add some text', font: 'Inter', size: 36, weight: 400 },
];

// Two-font combinations: a display face for the title, a quiet one for the line under it.
// Font pairs: classic, modern, editorial, playful; every face is shipped locally.
const FONT_PAIRS: { label: string; title: TextPreset; line: TextPreset }[] = [
  {
    label: 'Classic',
    title: { label: 'Title', text: 'Add a title', font: 'Playfair Display', size: 104, weight: 700 },
    line: { label: 'Line', text: 'A short line of text', font: 'Lora', size: 36, weight: 400 },
  },
  {
    label: 'Modern',
    title: { label: 'Title', text: 'ADD A TITLE', font: 'Anton', size: 132, weight: 400 },
    line: { label: 'Line', text: 'A short line of text', font: 'Space Grotesk', size: 36, weight: 500 },
  },
  {
    label: 'Editorial',
    title: { label: 'Title', text: 'Add a title', font: 'Fraunces', size: 104, weight: 700 },
    line: { label: 'Line', text: 'A short line of text', font: 'Inter', size: 36, weight: 400 },
  },
  {
    label: 'Playful',
    title: { label: 'Title', text: 'Add a title', font: 'Righteous', size: 104, weight: 400 },
    line: { label: 'Line', text: 'A short line of text', font: 'Nunito', size: 38, weight: 600 },
  },
];

function textItem(st: EditorState, p: TextPreset, x: number, y: number, id?: string): Op {
  const k = pageOf(st.design.format ?? 'story', st.design.width, st.design.height).width / 1080;
  const size = Math.round(p.size * k);
  return {
    op: 'add',
    item: {
      id: id ?? freshId(st.design, p.label.toLowerCase()),
      name: p.label,
      type: 'text',
      x,
      y,
      width: Math.round(900 * k),
      height: Math.round(size * 1.4),
      props: { text: p.text, font: p.font, size, weight: p.weight, align: 'center', color: '#111111' },
    },
  };
}

/** Adds the items, selects the first one and opens it for typing, so the first key replaces the placeholder. */
function addAndEdit(ops: Op[], firstId: string): void {
  if (!hooks) return;
  void hooks.commit(ops).then((ok) => {
    if (!ok) return;
    hooks?.setSelection([firstId]);
    requestAnimationFrame(() => hooks?.startTextEdit(firstId));
  });
}

function presetCard(caption: string, lines: TextPreset[]): HTMLButtonElement {
  const card = document.createElement('button');
  card.className = 'text-preset';
  const label = document.createElement('span');
  label.className = 'text-preset-label';
  label.textContent = caption;
  card.append(label);
  for (const p of lines) {
    const sample = document.createElement('span');
    sample.className = 'text-preset-sample';
    sample.textContent = p.text;
    // Preview scale: canvas sizes are for 1080 px, the card is about 250 px wide.
    sample.style.cssText = `font-family:'${p.font}',sans-serif;font-weight:${p.weight};font-size:${Math.max(13, Math.round(p.size / 4))}px`;
    card.append(sample);
  }
  return card;
}

/* ---- curved text (acts on the selected text, like the toolbar) ---- */

function selectedTextId(st: EditorState): string | null {
  if (st.selection.length !== 1) return null;
  const it = (st.design.items ?? []).find((c) => c.id === st.selection[0]);
  return it && it.type === 'text' && !it.locked ? it.id : null;
}

function renderCurve(root: HTMLElement, st: EditorState): void {
  const title = document.createElement('h3');
  title.className = 'panel-subtitle';
  title.textContent = 'Curved text';
  root.append(title);
  const id = selectedTextId(st);
  const props = ((st.design.items ?? []).find((c) => c.id === id)?.props ?? {}) as Record<string, unknown>;
  const row = document.createElement('div');
  row.className = 'curve-row';
  const modes: [string, string, string][] = [
    ['up', 'Arc up', 'The middle rises'],
    ['down', 'Arc down', 'The middle sags'],
  ];
  for (const [mode, label, hint] of modes) {
    const btn = document.createElement('button');
    btn.className = 'btn curve-btn' + (props.curve === mode ? ' on' : '');
    btn.title = id ? hint : 'Select one text first';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', String(props.curve === mode));
    btn.disabled = !id;
    btn.innerHTML = `<span>${label}</span><svg viewBox="0 0 48 16" width="48" height="16" aria-hidden="true">`
      + (mode === 'up'
        ? '<path d="M4,13 Q24,-5 44,13" fill="none" stroke="currentColor" stroke-width="2"/>'
        : '<path d="M4,3 Q24,21 44,3" fill="none" stroke="currentColor" stroke-width="2"/>')
      + '</svg>';
    btn.addEventListener('click', () => {
      if (!hooks || !id) return;
      const live = ((st.design.items ?? []).find((c) => c.id === id)?.props ?? {}) as Record<string, unknown>;
      const next = live.curve === mode ? 'none' : mode;
      const patch: Record<string, unknown> = { curve: next };
      if (next !== 'none' && !live.curveAmount) patch.curveAmount = 48;
      void hooks.commit([{ op: 'update', id, patch }]);
    });
    row.append(btn);
  }
  root.append(row);
  if (id && (props.curve === 'up' || props.curve === 'down')) {
    const wrap = document.createElement('label');
    wrap.className = 'slider-field';
    const head = document.createElement('span');
    head.className = 'slider-field-head';
    const name = document.createElement('span');
    name.textContent = 'Amount';
    const value = document.createElement('span');
    value.className = 'slider-field-value';
    value.textContent = String(Number(props.curveAmount ?? 48));
    head.append(name, value);
    wrap.append(head);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '200';
    input.step = '2';
    input.value = String(Number(props.curveAmount ?? 48));
    input.setAttribute('aria-label', 'Curve amount');
    input.addEventListener('input', () => {
      value.textContent = input.value;
    });
    input.addEventListener('change', () => {
      if (!hooks) return;
      void hooks.commit([{ op: 'update', id, patch: { curveAmount: Number(input.value) } }],
        `curve:${id}`);
    });
    wrap.append(input);
    root.append(wrap);
  }
}

/* ---- entry ---- */

export function renderTextPanel(root: HTMLElement, st: EditorState): void {
  for (const p of TEXT_PRESETS) {
    const card = presetCard(p.label, [p]);
    card.addEventListener('click', () => {
      if (!hooks) return;
      const c = centerOf(hooks.state);
      const id = freshId(hooks.state.design, p.label.toLowerCase());
      addAndEdit([textItem(hooks.state, p, c.x, c.y, id)], id);
    });
    root.append(card);
  }

  renderCurve(root, st);

  const pairsTitle = document.createElement('h3');
  pairsTitle.className = 'panel-subtitle';
  pairsTitle.textContent = 'Font pairs';
  root.append(pairsTitle);
  for (const pair of FONT_PAIRS) {
    const card = presetCard(pair.label, [pair.title, pair.line]);
    card.addEventListener('click', () => {
      if (!hooks) return;
      const c = centerOf(hooks.state);
      const id = freshId(hooks.state.design, 'title');
      addAndEdit([textItem(hooks.state, pair.title, c.x, c.y - 60, id),
        textItem(hooks.state, pair.line, c.x, c.y + 70, `${id}-line`)], id);
    });
    root.append(card);
  }
  refreshIcons();
}
