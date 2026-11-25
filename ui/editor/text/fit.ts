// Text fit: a text box is as tall as its text, like in any design tool.
// Before a change reaches the engine, text items are measured off-screen with
// the shared renderer at 1080 px, and their height is set in the same batch
// (one undo step, no second commit).
import { curvedTextHeight, renderDesign, type Design, type DesignItem, type TextProps } from '../../render/render.js';
import type { Op } from '../api.js';
import { findItem } from '../state.js';

// Changing one of these can change how tall the text is. Curved text is
// measured apart (measureCurvedHeight): its arc is centred in the box.
const SIZE_KEYS = ['text', 'font', 'size', 'weight', 'italic', 'lineHeight', 'letterSpacing', 'textCase',
  'shrinkToFit', 'minSize', 'list'];

let probe: HTMLDivElement | null = null;

/** A hidden 1080 px stage: one design pixel is one CSS pixel inside it. */
export function measuringStage(): HTMLDivElement {
  if (probe) return probe;
  probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;width:1080px;visibility:hidden;pointer-events:none;';
  document.body.append(probe);
  return probe;
}

async function measureHeight(
  item: DesignItem,
  format: Design['format'],
  size?: number,
): Promise<number | null> {
  const props = (item.props ?? {}) as Record<string, unknown>;
  const font = String(props.font ?? 'Inter');
  try {
    await document.fonts.load(`${props.italic ? 'italic ' : ''}${Number(props.weight ?? 400)} 64px "${font}"`, String(props.text ?? 'A'));
  } catch {
    /* unknown font: measure with the fallback, as it will be drawn */
  }
  const stage = measuringStage();
  const sized: DesignItem = typeof size === 'number'
    ? { ...item, props: { ...(item.props ?? {}), size } }
    : item;
  // Height 1 so the box does not stretch the text; the span inside gives the real height.
  const sample: DesignItem = { ...sized, x: (sized.width ?? 1080) / 2, y: 1, height: 1, angle: 0 };
  // Safe: renderDesign escapes every design string; the probe is measured, never shown.
  stage.innerHTML = renderDesign({ version: 1, name: 'probe', format, items: [sample] } as Design);
  const span = stage.querySelector<HTMLElement>(`[data-id="${CSS.escape(item.id)}"] span`);
  if (!span) return null;
  const rect = span.getBoundingClientRect();
  return rect.height > 0 ? Math.ceil(rect.height) : null;
}

// Curved text also changes height with its arc.
const CURVE_KEYS = [...SIZE_KEYS, 'curve', 'curveAmount', 'width'];

function isCurved(props: Record<string, unknown>): boolean {
  return props.curve === 'up' || props.curve === 'down';
}

/**
 * Height a curved text needs so its frame wraps the arc, like the reference.
 * Computed, not measured: the SVG scales with its box, so a DOM probe would
 * read back whatever height it was given.
 */
async function measureCurvedHeight(item: DesignItem, _format: Design['format']): Promise<number | null> {
  return curvedTextHeight((item.props ?? {}) as TextProps);
}

/**
 * Largest size in [minSize, startSize] whose text fits boxH, or minSize when
 * even that overflows. Reduce-only ("reduce to fit"): deleting text
 * keeps the size; the user grows it again by hand.
 */
async function shrinkSize(
  item: DesignItem,
  format: Design['format'],
  boxH: number,
  startSize: number,
  minSize: number,
): Promise<number> {
  const fits = async (s: number): Promise<boolean> => {
    const h = await measureHeight(item, format, s);
    return h !== null && h <= boxH + 0.5;
  };
  if (await fits(startSize)) return startSize;
  if (await fits(minSize)) {
    let lo = minSize;
    let hi = startSize;
    for (let i = 0; i < 20 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      if (await fits(mid)) lo = mid;
      else hi = mid;
    }
    // Same half-point grid as the engine's fit_text_size.
    return Math.floor(lo * 2) / 2;
  }
  return minSize;
}

/** Returns the ops with a measured `height` added to every text add/update that can change the text's height. */
export async function withFittedText(ops: Op[], design: Design): Promise<Op[]> {
  const out: Op[] = [];
  for (const op of ops) {
    const o = op as Record<string, unknown>;
    if (o.op === 'add' && (o.item as DesignItem | undefined)?.type === 'text') {
      const item = o.item as DesignItem;
      const props = (item.props ?? {}) as Record<string, unknown>;
      if (isCurved(props)) {
        const h = await measureCurvedHeight(item, design.format);
        out.push(h ? ({ ...o, item: { ...item, height: h } } as unknown as Op) : op);
        continue;
      }
      if (props.shrinkToFit === true) {
        const boxH = Math.max(1, Number(item.height ?? 1));
        const start = Math.max(1, Number(props.size ?? 64));
        const min = Math.min(start, Math.max(1, Number(props.minSize ?? 12)));
        const s = await shrinkSize(item, design.format, boxH, start, min);
        out.push(s === start ? op : ({ ...o, item: { ...item, props: { ...props, size: s } } } as unknown as Op));
        continue;
      }
      const h = await measureHeight(item, design.format);
      out.push(h ? ({ ...o, item: { ...item, height: h } } as unknown as Op) : op);
      continue;
    }
    if (o.op === 'update' && typeof o.id === 'string') {
      const current = findItem(design, o.id);
      const patch = (o.patch ?? {}) as Record<string, unknown>;
      const touchesSize = SIZE_KEYS.some((k) => k in patch) || 'width' in patch;
      // Curved text: the frame grows or shrinks around the arc, centre kept.
      if (current?.type === 'text' && !('height' in patch)) {
        const curvedProps = { ...(current.props ?? {}), ...patch } as Record<string, unknown>;
        const wasCurved = isCurved((current.props ?? {}) as Record<string, unknown>);
        if ((isCurved(curvedProps) || wasCurved) && CURVE_KEYS.some((k) => k in patch)) {
          const merged: DesignItem = {
            ...current,
            width: typeof patch.width === 'number' ? (patch.width as number) : current.width,
            props: curvedProps,
          };
          const h = isCurved(curvedProps)
            ? await measureCurvedHeight(merged, design.format)
            : await measureHeight(merged, design.format);
          out.push(h && Math.abs(h - (current.height ?? 0)) >= 1
            ? ({ ...o, patch: { ...patch, height: h } } as unknown as Op)
            : op);
          continue;
        }
      }
      if (current?.type === 'text' && touchesSize && !('height' in patch)) {
        const mergedProps = { ...(current.props ?? {}), ...patch } as Record<string, unknown>;
        // Shrink to fit: the box stays fixed, the size shrinks down to minSize.
        if (mergedProps.shrinkToFit === true) {
          const merged: DesignItem = {
            ...current,
            width: typeof patch.width === 'number' ? patch.width as number : current.width,
            props: mergedProps,
          };
          const boxH = Math.max(1, Number(current.height ?? 1));
          const start = Math.max(1, Number(mergedProps.size ?? 64));
          const min = Math.min(start, Math.max(1, Number(mergedProps.minSize ?? 12)));
          const s = await shrinkSize(merged, design.format, boxH, start, min);
          out.push(s === Number(mergedProps.size ?? 64)
            ? op
            : ({ ...o, patch: { ...patch, size: s } } as unknown as Op));
          continue;
        }
      }
      if (current?.type === 'text' && touchesSize && !('height' in patch)) {
        const { width, ...propPatch } = patch;
        const merged: DesignItem = {
          ...current,
          width: typeof width === 'number' ? width : current.width,
          props: { ...(current.props ?? {}), ...propPatch },
        };
        const h = await measureHeight(merged, design.format);
        const oldH = current.height ?? h ?? 0;
        if (!h || Math.abs(h - oldH) < 1) {
          out.push(op);
          continue;
        }
        // Keep the top edge where it is: text grows downwards, as when typing.
        const top = (current.y ?? 0) - oldH / 2;
        const y = 'y' in patch ? (patch.y as number) : (current.angle ?? 0) === 0 ? top + h / 2 : (current.y ?? 0);
        out.push({ ...o, patch: { ...patch, height: h, y } } as unknown as Op);
        continue;
      }
    }
    out.push(op);
  }
  return out;
}
