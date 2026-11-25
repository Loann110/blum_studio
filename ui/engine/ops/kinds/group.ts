// Engine group and ungroup ops.
import type { Design, Item } from '../../model.js';
import type { Op } from '../op.js';
import type { Found } from '../lookup.js';
import { fail } from '../../errors.js';
import { boundingBox } from '../../geometry.js';
import { needIds } from '../op.js';
import { cloneItem, findIn, findItem, freshId } from '../lookup.js';

export function applyGroup(doc: Design, op: Op): void {
      needIds(op, 2, 'item ids');
      const parts: Found[] = [];
      for (const gid of op.ids) {
        const f = findIn(doc.items, gid);
        if (!f) fail(`unknown item '${gid}'`);
        if (f.list !== doc.items) fail('group needs top-level items');
        if (f.item.locked) fail(`item '${gid}' is locked`);
        parts.push(f);
      }
      let box = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let first = true;
      for (const p of parts) {
        const b = boundingBox(p.item);
        if (first) {
          box = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
          first = false;
        } else {
          box = {
            minX: Math.min(box.minX, b.minX),
            minY: Math.min(box.minY, b.minY),
            maxX: Math.max(box.maxX, b.maxX),
            maxY: Math.max(box.maxY, b.maxY),
          };
        }
      }
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const gid = op.name !== '' ? op.name : freshId(doc, 'group');
      if (findItem(doc, gid)) fail(`duplicate item id '${gid}'`);
      const group: Item = {
        id: gid,
        name: gid,
        type: 'group',
        x: cx,
        y: cy,
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
        angle: 0,
        opacity: 1,
        blend: '',
        locked: false,
        visible: true,
        props: { shadowColor: '', shadowX: 0, shadowY: 3, shadowBlur: 8 },
        children: parts.map((p) => {
          const child = cloneItem(p.item);
          child.x -= cx;
          child.y -= cy;
          return child;
        }),
      };
      for (const p of parts) {
        const f = findIn(doc.items, p.item.id);
        if (f && f.list === doc.items) doc.items.splice(f.pos, 1);
      }
      doc.items.push(group);
}

export function applyUngroup(doc: Design, op: Op): void {
      const f = findIn(doc.items, op.id);
      if (!f) fail(`unknown item '${op.id}'`);
      if (f.item.type !== 'group') fail(`'${op.id}' is not a group`);
      if (f.item.locked) fail(`item '${op.id}' is locked`);
      if (f.list !== doc.items) fail('ungroup only works on top-level groups');
      const gx = f.item.x;
      const gy = f.item.y;
      const ga = f.item.angle;
      const lifted = f.item.children.map((c) => cloneItem(c));
      const where = f.pos;
      doc.items.splice(where, 1);
      const rad = (ga * Math.PI) / 180;
      for (const child of lifted) {
        const rx = child.x * Math.cos(rad) - child.y * Math.sin(rad);
        const ry = child.x * Math.sin(rad) + child.y * Math.cos(rad);
        child.x = gx + rx;
        child.y = gy + ry;
        child.angle += ga;
        child.id = freshId(doc, child.id);
      }
      doc.items.splice(where, 0, ...lifted);
}