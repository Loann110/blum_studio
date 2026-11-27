// Engine item ops: add, update, remove, duplicate, lock.
import type { Design, Item, PhotoProps } from '../../model.js';
import type { Op } from '../op.js';
import { canvasHeight, canvasWidth } from '../../model.js';
import { fail } from '../../errors.js';
import { checkItem } from '../../validate.js';
import { applyPatch } from '../fields/index.js';
import { cloneItem, collectTaken, findIn, findItem, freshenSubtree, freshId } from '../lookup.js';

// A full-bleed photo with rounded corners shows the page behind in the corners.
function coversPage(doc: Design, it: Item): boolean {
  const left = it.x - it.width / 2;
  const top = it.y - it.height / 2;
  return left <= 1 && top <= 1 &&
    left + it.width >= canvasWidth(doc) - 1 &&
    top + it.height >= canvasHeight(doc) - 1;
}

export function applyAdd(doc: Design, op: Op): void {
      if (!op.item) fail('add needs an item');
      if (op.item.id === '') fail('add needs an item id');
      if (findItem(doc, op.item.id)) fail(`duplicate item id '${op.item.id}'`);
      const errs: string[] = [];
      checkItem(op.item, 'item', errs);
      if (errs.length > 0) fail(errs[0]);
      if (op.item.type === 'photo' && !op.hasCornerRadius && coversPage(doc, op.item)) {
        (op.item.props as PhotoProps).cornerRadius = 0;
      }
      doc.items.push(cloneItem(op.item));
}

export function applyUpdate(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      if (f.item.locked) fail(`item '${op.id}' is locked`);
      applyPatch(f.item, op.id, op.patch);
}

export function applyRemove(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      if (f.item.locked) fail(`item '${op.id}' is locked`);
      f.list.splice(f.pos, 1);
}

export function applyDuplicate(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      if (f.list !== doc.items) fail('duplicate only works on top-level items');
      const copy = cloneItem(f.item);
      copy.id = op.name !== '' ? op.name : freshId(doc, `${op.id}-copy`);
      if (findItem(doc, copy.id)) fail(`duplicate item id '${copy.id}'`);
      const taken = new Set<string>();
      for (const it of doc.items) collectTaken(it, taken);
      taken.add(copy.id);
      freshenSubtree(doc, copy, taken);
      copy.x += 24;
      copy.y += 24;
      copy.locked = false;
      doc.items.splice(f.pos + 1, 0, copy);
}

export function applyLock(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      f.item.locked = op.locked;
}