// Engine op: batch op shape and parsing.
import type { Background, Item, Paint } from '../model.js';
import type { Json } from '../json/read.js';
import { fail } from '../errors.js';
import {
  bool,
  has,
  int,
  isObj,
  parseBackground,
  parseItem,
  parsePaint,
  str,
} from '../json/read.js';

/* ---- ops ---- */

export interface FieldPatch {
  strings: Map<string, string>;
  numbers: Map<string, number>;
  bools: Map<string, boolean>;
  ints: Map<string, number>;
  paints: Map<string, Paint>;
}

export interface LayoutSpec {
  stack: string;
  items: string[];
  align: string;
  gap: string;
  zone: string;
  anchors: Map<string, string>;
}

export interface Op {
  kind: string;
  id: string;
  item?: Item;
  patch: FieldPatch;
  ids: string[];
  name: string;
  to: string;
  index: number;
  align: string;
  locked: boolean;
  background?: Background;
  hasBackground: boolean;
  layout: LayoutSpec;
  hasLayout: boolean;
}

export function parseOp(d: Json): Op {
  let item: Item | undefined;
  if (has(d, 'item')) item = parseItem(d['item'] as Json);
  const patch: FieldPatch = {
    strings: new Map(),
    numbers: new Map(),
    bools: new Map(),
    ints: new Map(),
    paints: new Map(),
  };
  if (isObj(d['patch'])) {
    const p = d['patch'] as Json;
    for (const k of Object.keys(p)) {
      const v = p[k];
      if (typeof v === 'boolean') patch.bools.set(k, v);
      else if (isObj(v)) patch.paints.set(k, parsePaint(v));
      else if (typeof v === 'number' && Number.isInteger(v)) patch.ints.set(k, v);
      else if (typeof v === 'number') patch.numbers.set(k, v);
      else patch.strings.set(k, v as string);
    }
  }
  const ids: string[] = [];
  if (Array.isArray(d['ids'])) {
    for (const i of d['ids'] as unknown[]) ids.push(i as string);
  }
  const layout: LayoutSpec = {
    stack: '',
    items: [],
    align: '',
    gap: 'md',
    zone: 'safe',
    anchors: new Map(),
  };
  let hasLayout = false;
  if (isObj(d['layout'])) {
    const l = d['layout'] as Json;
    layout.stack = str(l, 'stack');
    layout.align = str(l, 'align');
    layout.gap = str(l, 'gap', 'md');
    layout.zone = str(l, 'zone', 'safe');
    if (Array.isArray(l['items'])) {
      for (const i of l['items'] as unknown[]) layout.items.push(i as string);
    }
    if (isObj(l['anchors'])) {
      for (const k of Object.keys(l['anchors'] as Json)) {
        layout.anchors.set(k, (l['anchors'] as Json)[k] as string);
      }
    }
    hasLayout = true;
  }
  return {
    kind: str(d, 'op'),
    id: str(d, 'id'),
    item,
    patch,
    ids,
    name: str(d, 'name'),
    to: str(d, 'to'),
    index: has(d, 'index') ? int(d, 'index') : -1,
    align: str(d, 'align'),
    locked: has(d, 'locked') ? bool(d, 'locked') : false,
    background: has(d, 'background') ? parseBackground(d['background']) : undefined,
    hasBackground: has(d, 'background'),
    layout,
    hasLayout,
  };
}

export function needIds(op: Op, n: number, what: string): void {
  if (op.ids.length < n) fail(`${op.kind} needs at least ${n} ${what}`);
}
