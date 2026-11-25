// Engine background op.
import type { Design } from '../../model.js';
import type { Op } from '../op.js';
import { fail } from '../../errors.js';

export function applySetBackground(doc: Design, op: Op): void {
      if (!op.hasBackground || !op.background) fail('set_background needs data');
      const bgk = op.background.kind;
      if (bgk !== 'color' && bgk !== 'gradient' && bgk !== 'pattern' && bgk !== 'image') {
        fail('background kind must be color|gradient|pattern|image');
      }
      doc.background = op.background;
}
