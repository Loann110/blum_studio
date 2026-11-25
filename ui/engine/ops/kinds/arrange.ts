// Engine arrange op.
import type { Design } from '../../model.js';
import type { Op } from '../op.js';
import { fail } from '../../errors.js';
import { solveLayout } from '../layout.js';

export function applyArrange(doc: Design, op: Op): void {
      if (!op.hasLayout) fail('arrange needs a layout');
      const err = solveLayout(doc, op.layout);
      if (err !== '') fail(`arrange: ${err}`);
}