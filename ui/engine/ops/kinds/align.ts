// Engine align and distribute ops.
import type { Design, Item } from '../../model.js';
import type { Op } from '../op.js';
import { fail } from '../../errors.js';
import { boundingBox } from '../../geometry.js';
import { needIds } from '../op.js';
import { findItem } from '../lookup.js';

export function applyAlign(doc: Design, op: Op): void {
      needIds(op, 2, 'item ids');
      const modes = ['left', 'center-x', 'right', 'top', 'center-y', 'bottom'];
      if (!modes.includes(op.align)) {
        fail('align must be left|center-x|right|top|center-y|bottom');
      }
      const parts: Item[] = [];
      for (const aid of op.ids) {
        const it = findItem(doc, aid);
        if (!it) fail(`unknown item '${aid}'`);
        if (it.locked) fail(`item '${aid}' is locked`);
        parts.push(it);
      }
      const value = (p: Item): number => {
        const b = boundingBox(p);
        if (op.align === 'left' || op.align === 'top') {
          return op.align === 'left' ? b.minX : b.minY;
        } else if (op.align === 'right' || op.align === 'bottom') {
          return op.align === 'right' ? b.maxX : b.maxY;
        }
        return op.align === 'center-x' ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
      };
      let target = 0;
      let first = true;
      for (const p of parts) {
        const vv = value(p);
        if (first) {
          target = vv;
          first = false;
        } else if (op.align === 'left' || op.align === 'top') {
          target = Math.min(target, vv);
        } else {
          target = Math.max(target, vv);
        }
      }
      const horiz = op.align === 'left' || op.align === 'center-x' || op.align === 'right';
      for (const p of parts) {
        const d = target - value(p);
        if (horiz) p.x += d;
        else p.y += d;
      }
}

export function applyDistribute(doc: Design, op: Op): void {
      needIds(op, 3, 'item ids');
      if (op.align !== 'x' && op.align !== 'y') fail('distribute axis must be x|y');
      const parts: Item[] = [];
      for (const aid of op.ids) {
        const it = findItem(doc, aid);
        if (!it) fail(`unknown item '${aid}'`);
        if (it.locked) fail(`item '${aid}' is locked`);
        parts.push(it);
      }
      const horiz = op.align === 'x';
      parts.sort((a, b2) => (horiz ? a.x - b2.x : a.y - b2.y));
      const center = (p: Item): number => {
        const b = boundingBox(p);
        return horiz ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
      };
      const firstC = center(parts[0]);
      const lastC = center(parts[parts.length - 1]);
      for (let k = 1; k + 1 < parts.length; k++) {
        const want = firstC + ((lastC - firstC) * k) / (parts.length - 1);
        const d = want - center(parts[k]);
        if (horiz) parts[k].x += d;
        else parts[k].y += d;
      }
}