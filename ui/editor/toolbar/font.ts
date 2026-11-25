// Editor toolbar fonts: cache, picker and weights.
import { getResources } from '../api.js';
import { toolGroup } from './controls.js';

export let fontsCache: string[] | null = null;
export async function fonts(): Promise<string[]> {
  if (!fontsCache) {
    try {
      fontsCache = (await getResources<string[]>('fonts'));
    } catch {
      fontsCache = ['Inter'];
    }
  }
  return fontsCache;
}

/** A button showing the current font in its own face; it opens a searchable list where every font previews itself. */
export function fontPicker(list: string[], current: string, onPick: (font: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'font-picker';
  const button = document.createElement('button');
  button.className = 'btn font-picker-button';
  button.title = 'Font';
  button.setAttribute('aria-label', `Font: ${current}`);
  button.setAttribute('aria-haspopup', 'listbox');
  // The face name comes from the design file: DOM, never markup.
  const face = document.createElement('span');
  face.style.fontFamily = `'${current}',sans-serif`;
  face.textContent = current;
  const chevron = document.createElement('i');
  chevron.setAttribute('data-lucide', 'chevron-down');
  button.append(face, chevron);
  wrap.append(button);

  const close = (): void => {
    wrap.querySelector('.font-picker-menu')?.remove();
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onOutside = (ev: Event): void => {
    if (!wrap.contains(ev.target as Node)) close();
  };

  button.addEventListener('click', () => {
    if (wrap.querySelector('.font-picker-menu')) return close();
    const menu = document.createElement('div');
    menu.className = 'font-picker-menu';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search fonts';
    search.setAttribute('aria-label', 'Search fonts');
    const items = document.createElement('div');
    items.className = 'font-picker-list';
    items.setAttribute('role', 'listbox');
    const fill = (query: string): void => {
      items.innerHTML = '';
      const q = query.trim().toLowerCase();
      for (const font of list.filter((f) => f.toLowerCase().includes(q))) {
        const option = document.createElement('button');
        option.className = 'font-picker-option' + (font === current ? ' on' : '');
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(font === current));
        option.style.fontFamily = `'${font}',sans-serif`;
        option.textContent = font;
        option.addEventListener('click', () => {
          close();
          onPick(font);
        });
        items.append(option);
      }
    };
    search.addEventListener('input', () => fill(search.value));
    search.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') close();
      if (ev.key === 'Enter') (items.querySelector('button') as HTMLButtonElement | null)?.click();
    });
    fill('');
    menu.append(search, items);
    wrap.append(menu);
    search.focus();
    items.querySelector('.on')?.scrollIntoView({ block: 'center' });
    document.addEventListener('pointerdown', onOutside, true);
  });
  return wrap;
}

export const WEIGHTS: [number, string][] = [
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semi-bold'],
  [700, 'Bold'],
  [800, 'Extra-bold'],
  [900, 'Black'],
];

export function weightSelect(root: HTMLElement, value: number, onPick: (weight: number) => void): void {
  const select = document.createElement('select');
  select.className = 'weight-select';
  select.title = 'Font weight';
  select.setAttribute('aria-label', 'Font weight');
  const nearest = WEIGHTS.reduce((a, b) => (Math.abs(b[0] - value) < Math.abs(a[0] - value) ? b : a))[0];
  for (const [w, name] of WEIGHTS) {
    const option = document.createElement('option');
    option.value = String(w);
    option.textContent = name;
    option.selected = w === nearest;
    select.append(option);
  }
  select.addEventListener('change', () => onPick(Number(select.value)));
  toolGroup(root).append(select);
}