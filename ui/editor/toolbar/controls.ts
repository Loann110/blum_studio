// Editor toolbar controls: buttons, steppers and switches.

import { hooks } from './hooks.js';
import { previewProps, type EditorState } from '../state.js';

export function iconButton(
  icon: string,
  title: string,
  onClick: () => void,
  on = false,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn icon' + (on ? ' on' : '');
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = `<i data-lucide="${icon}"></i>`;
  btn.addEventListener('click', onClick);
  return btn;
}

/** A short visible name in front of the last control added to `root`. */
export function caption(root: HTMLElement, text: string): void {
  const group = root.lastElementChild;
  if (!group) return;
  const label = document.createElement('span');
  label.className = 'tool-caption';
  label.textContent = text;
  label.setAttribute('aria-hidden', 'true');
  group.prepend(label);
}

export function separator(root: HTMLElement): void {
  const sep = document.createElement('div');
  sep.className = 'sep';
  root.append(sep);
}

export function toolGroup(root: HTMLElement): HTMLElement {
  const span = document.createElement('span');
  span.className = 'tool';
  root.append(span);
  return span;
}

export function numberStepper(
  root: HTMLElement,
  value: number,
  step: number,
  min: number,
  max: number,
  label: string,
  onChange: (v: number) => void,
): void {
  const g = toolGroup(root);
  const down = iconButton('minus', `Smaller ${label}`, () =>
    onChange(Math.max(min, value - step)),
  );
  const text = document.createElement('input');
  text.type = 'number';
  text.className = 'stepper-value';
  text.value = String(Math.round(value));
  text.min = String(min);
  text.max = String(max);
  text.setAttribute('aria-label', label[0].toUpperCase() + label.slice(1));
  text.addEventListener('change', () => {
    const next = Number(text.value);
    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))));
  });
  const up = iconButton('plus', `Bigger ${label}`, () =>
    onChange(Math.min(max, value + step)),
  );
  g.append(down, text, up);
}

export function decimalStepper(
  root: HTMLElement,
  value: number,
  step: number,
  min: number,
  max: number,
  label: string,
  onChange: (v: number) => void,
): void {
  const g = toolGroup(root);
  g.title = label;
  const round1 = (v: number): number => Math.round(v * 10) / 10;
  const down = iconButton('minus', `Smaller ${label}`, () =>
    onChange(round1(Math.max(min, value - step))),
  );
  const text = document.createElement('span');
  text.textContent = value.toFixed(1);
  text.style.minWidth = '34px';
  text.style.textAlign = 'center';
  text.style.fontSize = '12px';
  const up = iconButton('plus', `Bigger ${label}`, () =>
    onChange(round1(Math.min(max, value + step))),
  );
  g.append(down, text, up);
}

/** A labelled slider with live local preview: `input` redraws the page,
 * `change` commits once (one undo step) under the coalesce key. */
export function liveRange(
  panel: HTMLElement,
  st: EditorState,
  id: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  show: (v: number) => string,
  apply: (v: number) => Record<string, unknown>,
  coalesce: string,
): void {
  if (!hooks) return;
  const head = document.createElement('div');
  const name = document.createElement('span');
  name.textContent = label;
  name.style.fontSize = '12px';
  const echo = document.createElement('span');
  echo.textContent = show(value);
  echo.style.fontSize = '12px';
  echo.style.color = 'var(--muted)';
  echo.style.float = 'right';
  head.append(name, echo);
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  range.value = String(value);
  range.setAttribute('aria-label', label);
  range.style.width = '100%';
  range.addEventListener('input', () => {
    const v = Number(range.value);
    echo.textContent = show(v);
    previewProps(st, id, apply(v));
    hooks?.redraw();
  });
  range.addEventListener('change', () => {
    void hooks?.commit([{ op: 'update', id, patch: apply(Number(range.value)) }], coalesce);
  });
  panel.append(head, range);
}

/** A labelled on/off row for the text sections of the More panel. */
export function switchRow(
  panel: HTMLElement,
  label: string,
  title: string,
  on: boolean,
  run: () => void,
): void {
  const row = document.createElement('div');
  row.className = 'switch-row';
  const name = document.createElement('span');
  name.textContent = label;
  name.title = title;
  const btn = document.createElement('button');
  btn.className = 'btn switch' + (on ? ' on' : '');
  btn.title = title;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'On' : 'Off';
  btn.addEventListener('click', run);
  row.append(name, btn);
  panel.append(row);
}