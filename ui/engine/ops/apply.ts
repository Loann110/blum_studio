// Engine apply: batch ops dispatched by op kind.
import type { Design } from '../model.js';
import type { Op } from './op.js';
import { fail } from '../errors.js';
import { validateModel } from '../validate.js';
import { applyAdd, applyDuplicate, applyLock, applyRemove, applyUpdate } from './kinds/items.js';
import { applyReorder } from './kinds/order.js';
import { applyGroup, applyUngroup } from './kinds/group.js';
import { applyAlign, applyDistribute } from './kinds/align.js';
import { applySetBackground } from './kinds/look.js';
import { applyArrange } from './kinds/arrange.js';

export function applyOpsModel(doc: Design, ops: Op[]): void {
  for (const op of ops) {
    if (op.kind === 'add') applyAdd(doc, op);
    else if (op.kind === 'update') applyUpdate(doc, op);
    else if (op.kind === 'remove') applyRemove(doc, op);
    else if (op.kind === 'reorder') applyReorder(doc, op);
    else if (op.kind === 'duplicate') applyDuplicate(doc, op);
    else if (op.kind === 'lock') applyLock(doc, op);
    else if (op.kind === 'group') applyGroup(doc, op);
    else if (op.kind === 'ungroup') applyUngroup(doc, op);
    else if (op.kind === 'align') applyAlign(doc, op);
    else if (op.kind === 'distribute') applyDistribute(doc, op);
    else if (op.kind === 'set_background') applySetBackground(doc, op);
    else if (op.kind === 'arrange') applyArrange(doc, op);
    else {
      fail(`unknown op '${op.kind}'`);
    }
  }
  const errs = validateModel(doc);
  if (errs.length > 0) fail(errs[0]);
}
