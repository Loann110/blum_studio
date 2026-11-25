// Engine reorder op.
import type { Design } from '../../model.js';
import type { Op } from '../op.js';
import { fail } from '../../errors.js';
import { findIn } from '../lookup.js';

export function applyReorder(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      if (f.list !== doc.items) fail('reorder only works on top-level items');
      if (f.item.locked) fail(`item '${op.id}' is locked`);
      const held = f.list.splice(f.pos, 1)[0];
      const list = doc.items;
      if (op.index >= 0) {
        if (op.index > list.length) fail('reorder index out of range');
        list.splice(op.index, 0, held);
      } else if (op.to === 'front') {
        list.push(held);
      } else if (op.to === 'back') {
        list.unshift(held);
      } else if (op.to === 'forward') {
        list.splice(Math.min(f.pos + 1, list.length), 0, held);
      } else if (op.to === 'backward') {
        list.splice(f.pos === 0 ? 0 : f.pos - 1, 0, held);
      } else {
        fail('reorder needs to=front|back|forward|backward');
      }
}