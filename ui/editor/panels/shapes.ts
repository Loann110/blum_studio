// Shapes panel: grouped sections that insert shapes onto the page.
// Every button draws its preview with our own SVG geometry; the insert goes
// through the same op pipeline as every other edit.
import type { Op } from '../api.js';
import { freshId, type EditorState } from '../state.js';
import { pageOf } from '../../engine/index.js';
import { staggerCenter } from './hooks.js';

export interface ShapesPanelHooks {
  commit(ops: Op[], coalesce?: string): Promise<boolean>;
  setSelection(ids: string[]): void;
}

interface ShapeEntry {
  shape: string;
  label: string;
  icon: string;
  width: number;
  height: number;
  frame?: boolean;
}

let addCounter = 0;

function centerOf(state: EditorState): { x: number; y: number } {
  addCounter += 1;
  return staggerCenter(state, addCounter);
}

/** New shapes: translucent blue (the user's choice). */
export const SHAPE_DEFAULT_FILL = 'rgba(47, 124, 246, 0.6)';

/* ---- catalog (one entry per engine shape name, in panel order) ---- */

const SECTIONS: { title: string; shapes: ShapeEntry[] }[] = [
  {
    title: 'Basics',
    shapes: [
      {
        shape: 'rect', label: 'Rectangle', width: 320, height: 320,
        icon: '<rect x="6" y="7" width="20" height="18" fill="currentColor"/>',
      },
      {
        shape: 'ellipse', label: 'Circle', width: 320, height: 320,
        icon: '<circle cx="16" cy="16" r="11" fill="currentColor"/>',
      },
      {
        shape: 'triangle', label: 'Triangle', width: 320, height: 320,
        icon: '<polygon points="16,5 27,27 5,27" fill="currentColor"/>',
      },
      {
        shape: 'line', label: 'Line', width: 360, height: 24,
        icon: '<rect x="3" y="14" width="26" height="4" rx="2" fill="currentColor"/>',
      },
    ],
  },
  {
    title: 'Decorative',
    shapes: [
      {
        shape: 'star', label: 'Star', width: 300, height: 300,
        icon: '<polygon points="16,4 19,13 28,13 21,19 23,28 16,23 9,28 11,19 4,13 13,13" fill="currentColor"/>',
      },
      {
        shape: 'diamond', label: 'Diamond', width: 300, height: 300,
        icon: '<polygon points="16,5 27,16 16,27 5,16" fill="currentColor"/>',
      },
      {
        shape: 'separator', label: 'Separator', width: 300, height: 48,
        icon: '<g fill="currentColor"><circle cx="6" cy="16" r="2"/><circle cx="11" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="21" cy="16" r="2"/><circle cx="26" cy="16" r="2"/></g>',
      },
      {
        shape: 'frame', label: 'Frame', width: 340, height: 340, frame: true,
        icon: '<rect x="6" y="6" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3"/>',
      },
    ],
  },
  {
    title: 'More basics',
    shapes: [
      {
        shape: 'rounded', label: 'Rounded rectangle', width: 320, height: 320,
        icon: '<rect x="6" y="7" width="20" height="18" rx="6" fill="currentColor"/>',
      },
      {
        shape: 'polygon', label: 'Polygon', width: 320, height: 320,
        icon: '<polygon points="16,5 25,10 25,22 16,27 7,22 7,10" fill="currentColor"/>',
      },
    ],
  },
  {
    title: 'Lines and arrows',
    shapes: [
      {
        shape: 'arrow', label: 'Arrow', width: 360, height: 160,
        icon: '<polygon points="3,13 19,13 19,8 29,16 19,24 19,19 3,19" fill="currentColor"/>',
      },
      {
        shape: 'doubleArrow', label: 'Double arrow', width: 360, height: 160,
        icon: '<polygon points="3,16 8,11 8,14 24,14 24,11 29,16 24,21 24,18 8,18 8,21" fill="currentColor"/>',
      },
      {
        shape: 'dotted', label: 'Dotted line', width: 360, height: 24,
        icon: '<line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 6"/>',
      },
    ],
  },
  {
    title: 'More shapes',
    shapes: [
      {
        shape: 'heart', label: 'Heart', width: 300, height: 300,
        icon: '<path d="M16 27 C8 20 3 16 3 11 C3 7 6 4 10 4 C13 4 15 6 16 8 C17 6 19 4 22 4 C26 4 29 7 29 11 C29 16 24 20 16 27 Z" fill="currentColor"/>',
      },
      {
        shape: 'bubble', label: 'Speech bubble', width: 340, height: 300,
        icon: '<rect x="5" y="5" width="22" height="14" rx="5" fill="currentColor"/><polygon points="11,19 9,27 17,19" fill="currentColor"/>',
      },
      {
        shape: 'blockArrow', label: 'Block arrow', width: 300, height: 300,
        icon: '<polygon points="3,13 19,13 19,8 29,16 19,24 19,19 3,19" fill="currentColor"/>',
      },
      {
        shape: 'cross', label: 'Cross', width: 300, height: 300,
        icon: '<polygon points="12,5 20,5 20,12 27,12 27,20 20,20 20,27 12,27 12,20 5,20 5,12 12,12" fill="currentColor"/>',
      },
      {
        shape: 'trapezoid', label: 'Trapezoid', width: 320, height: 280,
        icon: '<polygon points="10,7 22,7 27,25 5,25" fill="currentColor"/>',
      },
      {
        shape: 'parallelogram', label: 'Parallelogram', width: 340, height: 280,
        icon: '<polygon points="12,7 27,7 20,25 5,25" fill="currentColor"/>',
      },
      {
        shape: 'ring', label: 'Ring', width: 300, height: 300, frame: true,
        icon: '<circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="5"/>',
      },
      {
        shape: 'cloud', label: 'Cloud', width: 360, height: 260,
        icon: '<path d="M9 25 C4 25 2 21 4 18 C1 15 3 10 7 10 C8 6 14 4 18 6 C22 3 28 5 28 10 C32 11 32 17 29 19 C30 23 27 25 24 25 Z" fill="currentColor"/>',
      },
      {
        shape: 'bolt', label: 'Bolt', width: 260, height: 340,
        icon: '<polygon points="18,3 7,18 14,18 12,29 25,13 17,13" fill="currentColor"/>',
      },
    ],
  },
];

/* ---- entry ---- */

export function renderShapesPanel(
  root: HTMLElement,
  st: EditorState,
  hooks: ShapesPanelHooks,
): void {
  for (const section of SECTIONS) {
    const title = document.createElement('h3');
    title.className = 'panel-subtitle';
    title.textContent = section.title;
    root.append(title);
    const grid = document.createElement('div');
    grid.className = 'shape-grid';
    for (const entry of section.shapes) grid.append(shapeButton(st, hooks, entry));
    root.append(grid);
  }
}

function shapeButton(
  st: EditorState,
  hooks: ShapesPanelHooks,
  entry: ShapeEntry,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.title = entry.label;
  btn.setAttribute('aria-label', `Add ${entry.label}`);
  btn.innerHTML = `<svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">${entry.icon}</svg>`
    + `<span class="shape-name">${entry.label}</span>`;
  btn.addEventListener('click', () => {
    const c = centerOf(st);
    const id = freshId(st.design, entry.shape);
    const props: Record<string, unknown> = entry.frame
      ? {
          shape: entry.shape,
          fill: '#ffffff',
          stroke: '#111111',
          strokeWidth: entry.shape === 'ring' ? 24 : 12,
        }
      : {
          shape: entry.shape,
          fill: SHAPE_DEFAULT_FILL,
          cornerRadius: entry.shape === 'rounded' ? 60 : 0,
        };
    const k = pageOf(st.design.format ?? 'story', st.design.width, st.design.height).width / 1080;
    const item = {
      id,
      name: entry.label,
      type: 'shape',
      x: c.x,
      y: c.y,
      width: Math.round(entry.width * k),
      height: Math.round(entry.height * k),
      props,
    };
    void hooks.commit([{ op: 'add', item }]).then((ok) => {
      if (ok) hooks.setSelection([id]);
    });
  });
  return btn;
}
