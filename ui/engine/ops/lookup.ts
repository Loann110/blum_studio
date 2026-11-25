// Engine lookup: find items, mint fresh ids and clone.
import type { Design, Item } from '../model.js';

/* ---- lookup ---- */

export interface Found {
  item: Item;
  list: Item[];
  pos: number;
}

export function findIn(list: Item[], id: string): Found | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { item: list[i], list, pos: i };
    if (list[i].type === 'group') {
      const f = findIn(list[i].children, id);
      if (f) return f;
    }
  }
  return null;
}

export function findItem(doc: Design, id: string): Item | null {
  const f = findIn(doc.items, id);
  return f ? f.item : null;
}

export function freshId(doc: Design, base: string): string {
  const root = base === '' ? 'item' : base;
  if (!findItem(doc, root)) return root;
  for (let i = 2; i < 10000; i++) {
    const cand = `${root}-${i}`;
    if (!findItem(doc, cand)) return cand;
  }
  return `${root}-copy`;
}

export function collectTaken(it: Item, taken: Set<string>): void {
  taken.add(it.id);
  for (const c of it.children) collectTaken(c, taken);
}

export function freshNested(doc: Design, base: string, taken: Set<string>): string {
  const root = base === '' ? 'item' : base;
  let cand = root;
  for (let i = 2; taken.has(cand) || findItem(doc, cand); i++) {
    cand = `${root}-${i}`;
  }
  taken.add(cand);
  return cand;
}

export function freshenSubtree(doc: Design, root: Item, taken: Set<string>): void {
  for (const c of root.children) {
    c.id = freshNested(doc, c.id, taken);
    freshenSubtree(doc, c, taken);
  }
}

export function cloneItem(it: Item): Item {
  return {
    ...it,
    props: JSON.parse(JSON.stringify(it.props)) as Item['props'],
    children: it.children.map((c) => cloneItem(c)),
  };
}