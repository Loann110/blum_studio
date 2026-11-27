// Engine background op.
import type { Design } from '../../model.js';
import type { Op } from '../op.js';
import { fail } from '../../errors.js';
import { isSafeImageSrc, localSrcHint } from '../../sources.js';

export function applySetBackground(doc: Design, op: Op): void {
      if (!op.hasBackground || !op.background) fail('set_background needs data');
      const bgk = op.background.kind;
      if (bgk !== 'color' && bgk !== 'gradient' && bgk !== 'pattern' && bgk !== 'image') {
        fail('background kind must be color|gradient|pattern|image');
      }
      if (op.background.image !== '' && !isSafeImageSrc(op.background.image)) {
        fail(`bad background image '${op.background.image}'${localSrcHint(op.background.image)}`);
      }
      doc.background = op.background;
}
