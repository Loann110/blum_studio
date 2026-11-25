// Editor background patterns.
import { PATTERN_DEFAULT_COLOUR, current, toHex, commitBg, previewBg, type BackgroundPanelHooks } from './hooks.js';
import type { DesignBackground } from '../../../render/render.js';
import type { EditorState } from '../../state.js';

const PATTERNS: { name: string; label: string; tile: string }[] = [
  {
    name: 'dots', label: 'Dots',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><g fill="currentColor"><circle cx="7" cy="7" r="2"/><circle cx="14" cy="7" r="2"/><circle cx="21" cy="7" r="2"/><circle cx="7" cy="14" r="2"/><circle cx="14" cy="14" r="2"/><circle cx="21" cy="14" r="2"/><circle cx="7" cy="21" r="2"/><circle cx="14" cy="21" r="2"/><circle cx="21" cy="21" r="2"/></g></svg>`,
  },
  {
    name: 'grid', label: 'Grid',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M3.5 3.5H24.5M3.5 10.5H24.5M3.5 17.5H24.5M3.5 24.5H24.5M3.5 3.5V24.5M10.5 3.5V24.5M17.5 3.5V24.5M24.5 3.5V24.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>`,
  },
  {
    name: 'stripes', label: 'Stripes',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M-2 9L9 -2M-2 18L18 -2M-2 27L27 -2M5 30L30 5M14 30L30 14M23 30L30 23" stroke="currentColor" stroke-width="3"/></svg>`,
  },
  {
    name: 'checker', label: 'Checker',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><g fill="currentColor"><rect x="0" y="0" width="7" height="7"/><rect x="14" y="0" width="7" height="7"/><rect x="7" y="7" width="7" height="7"/><rect x="21" y="7" width="7" height="7"/><rect x="0" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="7" y="21" width="7" height="7"/><rect x="21" y="21" width="7" height="7"/></g></svg>`,
  },
  {
    name: 'waves', label: 'Waves',
    tile: `<svg viewBox="0 0 32 24" width="34" height="26"><path d="M-2 8L6 2L14 8L22 2L30 8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M-2 20L6 14L14 20L22 14L30 20" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`,
  },
  {
    name: 'crosses', label: 'Crosses',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M7 4v6M4 7h6M14 4v6M11 7h6M21 4v6M18 7h6M7 11v6M4 14h6M14 11v6M11 14h6M21 11v6M18 14h6M7 18v6M4 21h6M14 18v6M11 21h6M21 18v6M18 21h6" stroke="currentColor" stroke-width="2"/></svg>`,
  },
  {
    name: 'zigzag', label: 'Zigzag',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M9 -2L14 5L9 12L14 19L9 26L14 33M20 -2L25 5L20 12L25 19L20 26L25 33" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>`,
  },
  {
    name: 'triangles', label: 'Triangles',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M14 6L23 22L5 22Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  },
  {
    name: 'hexagons', label: 'Hexagons',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M20 14L17 19.2L11 19.2L8 14L11 8.8L17 8.8Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  },
  {
    name: 'diamonds', label: 'Diamonds',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M14 5L21 14L14 23L7 14Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  },
  {
    name: 'scallops', label: 'Scallops',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M-2 12Q3 4 8 12Q13 4 18 12Q23 4 28 12M-2 22Q3 14 8 22Q13 14 18 22Q23 14 28 22" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  },
  {
    name: 'bricks', label: 'Bricks',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M2 9H26M2 19H26M14 9V19M8 19V26M20 19V26" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  },
  {
    name: 'hearts', label: 'Hearts',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M14 23C10 19 5 16 5 11.5C5 8.5 7.5 6.5 10 6.5C11.8 6.5 13.2 7.5 14 9C14.8 7.5 16.2 6.5 18 6.5C20.5 6.5 23 8.5 23 11.5C23 16 18 19 14 23Z" fill="currentColor"/></svg>`,
  },
  {
    name: 'stars', label: 'Stars',
    tile: `<svg viewBox="0 0 28 28" width="34" height="34"><path d="M14 4L16.5 11L24 11L18 15.5L20 23L14 18.5L8 23L10 15.5L4 11L11.5 11Z" fill="currentColor"/></svg>`,
  },
];

function patternBg(st: EditorState): DesignBackground {
  const bg = current(st);
  return bg.kind === 'pattern'
    ? { kind: 'pattern', pattern: bg.pattern ?? 'dots', patternColor: bg.patternColor ?? '#111111', patternBackground: bg.patternBackground ?? '' }
    : { kind: 'pattern', pattern: 'dots', patternColor: PATTERN_DEFAULT_COLOUR, patternBackground: '#ffffff' };
}

/** Pattern size, angle and thickness with the engine defaults (missing = default). */
function patternOpts(st: EditorState): { scale: number; angle: number; weight: number } {
  const bg = current(st);
  if (bg.kind !== 'pattern') return { scale: 1, angle: 0, weight: 1 };
  const numOr = (v: unknown, fb: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  const scale = numOr(bg.patternScale, 1);
  const weight = numOr(bg.patternWeight, 1);
  return {
    scale: scale > 0 ? scale : 1,
    angle: numOr(bg.patternAngle, 0),
    weight: weight > 0 ? weight : 1,
  };
}

/** A typeable stepper like the toolbar's: preview while typing, one commit on change. */
function patternStepper(
  box: HTMLElement,
  label: string,
  value: number,
  step: number,
  min: number,
  max: number,
  preview: (v: number) => void,
  commit: (v: number) => void,
): HTMLInputElement {
  const row = document.createElement('div');
  row.className = 'row';
  const name = document.createElement('span');
  name.style.cssText = 'font-size:12px;min-width:104px';
  name.textContent = label;
  const down = document.createElement('button');
  down.className = 'btn';
  down.textContent = '−';
  down.title = `Smaller ${label.toLowerCase()}`;
  down.setAttribute('aria-label', `Smaller ${label.toLowerCase()}`);
  const text = document.createElement('input');
  text.type = 'number';
  text.className = 'stepper-value';
  text.value = String(value);
  text.min = String(min);
  text.max = String(max);
  text.step = String(step);
  text.setAttribute('aria-label', label);
  const up = document.createElement('button');
  up.className = 'btn';
  up.textContent = '+';
  up.title = `Bigger ${label.toLowerCase()}`;
  up.setAttribute('aria-label', `Bigger ${label.toLowerCase()}`);
  const clamp = (v: number): number => Math.min(max, Math.max(min, Math.round(v)));
  down.addEventListener('click', () => {
    text.value = String(clamp(Number(text.value) - step));
    commit(Number(text.value));
  });
  up.addEventListener('click', () => {
    text.value = String(clamp(Number(text.value) + step));
    commit(Number(text.value));
  });
  text.addEventListener('input', () => {
    const next = Number(text.value);
    if (Number.isFinite(next)) preview(clamp(next));
  });
  text.addEventListener('change', () => {
    text.value = String(clamp(Number(text.value)));
    commit(Number(text.value));
  });
  row.append(name, down, text, up);
  box.append(row);
  return text;
}

export function renderPatterns(root: HTMLElement, st: EditorState, hooks: BackgroundPanelHooks): void {
  const box = document.createElement('div');
  box.innerHTML = '<h3>Patterns</h3>';

  const colorLabel = document.createElement('p');
  colorLabel.style.cssText = 'font-size:12px;margin:4px 0';
  colorLabel.textContent = 'Pattern color';
  const colorRow = document.createElement('div');
  colorRow.className = 'row';
  const colorPick = document.createElement('input');
  colorPick.type = 'color';
  colorPick.value = toHex(String(patternBg(st).patternColor ?? PATTERN_DEFAULT_COLOUR));
  colorPick.setAttribute('aria-label', 'Pattern color picker');
  const colorHex = document.createElement('input');
  colorHex.type = 'text';
  colorHex.value = String(patternBg(st).patternColor ?? PATTERN_DEFAULT_COLOUR);
  colorHex.setAttribute('aria-label', 'Pattern color');
  const washLabel = document.createElement('p');
  washLabel.style.cssText = 'font-size:12px;margin:4px 0';
  washLabel.textContent = 'Pattern background';
  const washRow = document.createElement('div');
  washRow.className = 'row';
  const washPick = document.createElement('input');
  washPick.type = 'color';
  washPick.value = toHex(String(patternBg(st).patternBackground || '#ffffff'));
  washPick.setAttribute('aria-label', 'Pattern background picker');
  const washHex = document.createElement('input');
  washHex.type = 'text';
  washHex.value = String(patternBg(st).patternBackground || '#ffffff');
  washHex.setAttribute('aria-label', 'Pattern background');
  washHex.placeholder = 'white when empty';

  const readColors = (): { ink: string; wash: string } => ({
    ink: colorHex.value.trim() || '#111111',
    wash: washHex.value.trim(),
  });

  // Size, angle and thickness with the engine defaults (missing = default).
  const opts = patternOpts(st);
  let sizeInput: HTMLInputElement;
  let angleInput: HTMLInputElement;
  let thickInput: HTMLInputElement;

  const readOpts = (): { scale: number; angle: number; weight: number } => ({
    scale: Math.round(Number(sizeInput.value)) / 100 || 1,
    angle: Math.round(Number(angleInput.value)) || 0,
    weight: Math.round(Number(thickInput.value)) / 100 || 1,
  });

  /** The whole pattern background; defaults stay out of the JSON. */
  function buildPattern(pattern?: string): DesignBackground {
    const { ink, wash } = readColors();
    const o = readOpts();
    const bg: DesignBackground = {
      kind: 'pattern',
      pattern: pattern ?? patternBg(st).pattern,
      patternColor: ink,
      patternBackground: wash,
    };
    if (o.scale !== 1) bg.patternScale = o.scale;
    if (o.angle !== 0) bg.patternAngle = o.angle;
    if (o.weight !== 1) bg.patternWeight = o.weight;
    return bg;
  }

  function previewAll(): void {
    previewBg(st, hooks, buildPattern());
  }

  function commitAll(): void {
    commitBg(hooks, buildPattern());
  }

  // Settings under the colours: type to preview live, Tab or the arrows
  // commit once, like the toolbar steppers.
  sizeInput = patternStepper(box, 'Pattern size', Math.round(opts.scale * 100), 25, 25, 400, previewAll, commitAll);
  angleInput = patternStepper(box, 'Pattern angle', Math.round(opts.angle), 15, 0, 360, previewAll, commitAll);
  thickInput = patternStepper(box, 'Pattern thickness', Math.round(opts.weight * 100), 25, 25, 400, previewAll, commitAll);

  for (const [pick, field] of [[colorPick, colorHex], [washPick, washHex]] as const) {
    pick.addEventListener('input', () => {
      field.value = pick.value;
      previewAll();
    });
    pick.addEventListener('change', commitAll);
    field.addEventListener('change', commitAll);
  }

  const grid = document.createElement('div');
  grid.className = 'shape-grid';
  for (const p of PATTERNS) {
    const btn = document.createElement('button');
    btn.title = p.label;
    btn.setAttribute('aria-label', `Background pattern ${p.label}`);
    btn.innerHTML = p.tile;
    btn.style.color = String(patternBg(st).patternColor ?? PATTERN_DEFAULT_COLOUR);
    btn.addEventListener('click', () => {
      commitBg(hooks, buildPattern(p.name));
    });
    grid.append(btn);
  }

  box.append(colorLabel, colorRow, washLabel, washRow, grid);
  colorRow.append(colorPick, colorHex);
  washRow.append(washPick, washHex);
  root.append(box);
}