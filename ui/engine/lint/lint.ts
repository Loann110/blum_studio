// Design checks (lint): small text, overflow, safe zone, overlaps,
// contrast, placeholders, plus a 0..100 care score.
import { pageOfDesign, type Design, type Item, type PhotoProps, type ShapeProps, type TextProps } from '../model.js';
import { boundingBox, canvasBox, inside, overlapRatio, safeBox } from '../geometry.js';
import { contrastRatio } from './colour.js';
import { TEXTURE_COLOURS } from './texture-colours.js';

/* ---- text case and width ---- */

// CSS text-transform, ASCII plus Latin-1 accents (covers French).
export function applyCase(text: string, mode: string): string {
  if (mode !== 'upper' && mode !== 'lower' && mode !== 'title') return text;
  let out = '';
  let wordStart = true;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    const isSpace = cp === 32 || cp === 10 || cp === 9;
    let mapped = cp;
    const upperWord = mode === 'upper' || (mode === 'title' && wordStart);
    if (!isSpace) {
      if (upperWord) {
        if (cp >= 97 && cp <= 122) mapped = cp - 32;
        else if (cp >= 0xe0 && cp <= 0xfe && cp !== 0xf7) mapped = cp - 32;
        else if (cp === 0xff) mapped = 0x178;
      } else if (mode !== 'title') {
        if (cp >= 65 && cp <= 90) mapped = cp + 32;
        else if (cp >= 0xc0 && cp <= 0xde && cp !== 0xd7) mapped = cp + 32;
      } else {
        if (cp >= 65 && cp <= 90) mapped = cp + 32;
        else if (cp >= 0xc0 && cp <= 0xde && cp !== 0xd7) mapped = cp + 32;
      }
    }
    out += String.fromCodePoint(mapped);
    wordStart = isSpace;
  }
  return out;
}

function textWidth(item: Item): number {
  const t = item.props as TextProps;
  const shaped = applyCase(t.text, t.textCase);
  let chars = 0;
  for (const _ch of shaped) chars++;
  let a = 0.52;
  if (t.weight >= 700) a += 0.04;
  if (t.italic) a += 0.02;
  return t.size * a * chars + t.letterSpacing * chars;
}

/* ---- report ---- */

export interface Finding {
  check: string;
  level: string;
  item: string;
  message: string;
}

export interface LintReport {
  findings: Finding[];
  score: number;
}

interface Placed {
  item: Item;
  absolute: Item;
}

function flatten(items: Item[], px: number, py: number, pa: number, out: Placed[]): void {
  const rad = (pa * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  for (const it of items) {
    const absolute: Item = {
      ...it,
      x: px + it.x * cosA - it.y * sinA,
      y: py + it.x * sinA + it.y * cosA,
      angle: it.angle + pa,
    };
    out.push({ item: it, absolute });
    if (it.type === 'group') {
      flatten(it.children, absolute.x, absolute.y, absolute.angle, out);
    }
  }
}

/* ---- what is behind a text ---- */

const LINE_SHAPES = new Set(['line', 'dotted', 'arrow', 'doubleArrow']);

function isLine(item: Item): boolean {
  return LINE_SHAPES.has((item.props as ShapeProps).shape);
}

function paintColours(color: string, stops: { color: string }[] | undefined): string[] {
  return stops && stops.length > 0 ? stops.map((s) => s.color) : [color];
}

// Page colours behind everything; null for a picture background. Paper
// textures have a measured mean colour, so text on them is really checked.
function backgroundColours(doc: Design): string[] | null {
  const bg = doc.background;
  if (bg.kind === 'image') {
    const mean = TEXTURE_COLOURS[bg.image];
    return mean ? [mean] : null;
  }
  if (bg.kind === 'gradient') return paintColours(bg.color, bg.stops);
  if (bg.kind === 'pattern' && bg.patternBackground !== '') {
    return [bg.patternBackground];
  }
  return [bg.color];
}

function contains(item: Item, x: number, y: number): boolean {
  const b = boundingBox(item);
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

// Colours under the text's centre and inner corners: the topmost filled
// shape drawn before it, else the page. Null when a picture is under it.
function coloursBehind(
  flat: Placed[],
  index: number,
  page: string[] | null,
): string[] | null {
  const box = boundingBox(flat[index].absolute);
  const dx = (box.maxX - box.minX) * 0.4;
  const dy = (box.maxY - box.minY) * 0.4;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const points = [[cx, cy], [cx - dx, cy - dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]];
  const out: string[] = [];
  for (const [x, y] of points) {
    let found: string[] | null | undefined;
    for (let j = index - 1; j >= 0 && found === undefined; j--) {
      const under = flat[j];
      if (!under.item.visible || under.item.type === 'group' || under.item.type === 'text') continue;
      if (!contains(under.absolute, x, y)) continue;
      if (under.item.type === 'shape') {
        const s = under.item.props as ShapeProps;
        if (isLine(under.item) || under.item.opacity < 0.6) continue;
        found = paintColours(s.fill.color, s.fill.gradient?.stops);
      } else {
        found = null; // photo, image or sticker
      }
    }
    if (found === undefined) found = page;
    if (found === null) return null;
    out.push(...found);
  }
  return out;
}

function ratioText(ratio: number): string {
  return ratio.toFixed(6).slice(0, 4);
}

// Worst contrast of a text against its own background: null when it sits on
// a picture and the eye must judge, undefined when the colours are not
// measurable hex (named CSS colours are not measured, only hex).
function textContrast(
  flat: Placed[],
  index: number,
  page: string[] | null,
): number | null | undefined {
  const t = flat[index].item.props as TextProps;
  const fg = t.color;
  const behind = t.background !== ''
    ? [t.background]
    : coloursBehind(flat, index, page);
  if (behind === null) return null;
  // shortcut: named CSS colours are not measured, only hex; resolve them if lint should cover them
  if (!fg.startsWith('#') || behind.length === 0 || !behind.every((c) => c.startsWith('#'))) return undefined;
  return Math.min(...behind.map((c) => contrastRatio(fg, c)));
}

// A text counts as decorative (never an overlap warning) when it holds no
// words or its measured contrast is a faint wash below 1.5:1.
function readableText(ratio: number | null | undefined, text: string): boolean {
  return text !== '' && (typeof ratio !== 'number' || ratio >= 1.5);
}

// Share of the lower box hidden under the upper one (boxes, not pixels).
function coverRatio(lower: Item, upper: Item): number {
  const x = boundingBox(lower);
  const y = boundingBox(upper);
  const ix = Math.max(0, Math.min(x.maxX, y.maxX) - Math.max(x.minX, y.minX));
  const iy = Math.max(0, Math.min(x.maxY, y.maxY) - Math.max(x.minY, y.minY));
  const area = (x.maxX - x.minX) * (x.maxY - x.minY);
  if (area <= 0) return 0;
  return (ix * iy) / area;
}

export function lintModel(doc: Design): LintReport {
  const findings: Finding[] = [];
  const add = (check: string, level: string, item: string, message: string): void => {
    findings.push({ check, level, item, message });
  };

  const pageColours = backgroundColours(doc);
  const page = pageOfDesign(doc);
  const contrasts = new Map<Item, number | null>();

  const flat: Placed[] = [];
  flatten(doc.items, 0, 0, 0, flat);
  const safe = safeBox(doc);
  const canvas = canvasBox(doc);

  let visibleCount = 0;
  for (const p of flat) {
    if (p.item.visible) visibleCount++;
  }
  if (visibleCount === 0) {
    add('empty_design', 'warn', '', 'This design is empty: add a title and a visual');
  }

  for (const p of flat) {
    const it = p.item;
    if (!it.visible) continue;
    const b = boundingBox(p.absolute);
    // Only text must stay readable; pictures and shapes may bleed on purpose.
    if (it.type !== 'text') {
      // no zone check
    } else if (!inside(b, canvas)) {
      add('off_canvas', 'warn', it.id, `'${it.id}' sticks out of the canvas`);
    } else if (!inside(b, safe)) {
      add('unsafe_zone', 'warn', it.id, `'${it.id}' is outside the safe zone`);
    }
    if (it.type === 'text') {
      const t = it.props as TextProps;
      if (t.text === '') {
        add('empty_text', 'info', it.id, `'${it.id}' has no text yet`);
      }
      if (t.size < page.minText) {
        add(
          'text_too_small', 'warn', it.id,
          page.kind === 'print'
            ? `'${it.id}' is ${Math.trunc(t.size)}px: too small to read once printed (min ${page.minText}px)`
            : `'${it.id}' is ${Math.trunc(t.size)}px: too small to read on a phone`,
        );
      }
      const w = textWidth(it);
      if (t.text !== '' && w > it.width * 1.05) {
        add(
          'text_overflow', 'warn', it.id,
          `'${it.id}' may overflow its box (estimated ${Math.trunc(w)}px for ` +
          `${Math.trunc(it.width)}px)`,
        );
      }
      const ratio = textContrast(flat, flat.indexOf(p), pageColours);
      contrasts.set(it, ratio ?? null);
      if (ratio === null) {
        const shadowed = t.shadowColor !== '' || t.haloColor !== '';
        if (!shadowed) {
          add(
            'contrast_picture', 'info', it.id,
            `'${it.id}' sits on a picture: check it reads (scrim, shadow or halo if not)`,
          );
        }
      } else if (typeof ratio === 'number') {
        const need = t.size >= 72 ? 3 : 4.5;
        if (ratio < 1.5 && t.size >= 200) {
          // A huge, nearly invisible glyph is a watermark (a pale ampersand
          // behind names), not text meant to be read.
          add('contrast', 'info', it.id, `'${it.id}' reads as a decorative watermark (${ratioText(ratio)}:1)`);
        } else if (ratio < 3) {
          add(
            'contrast', 'error', it.id,
            `'${it.id}' contrast is too low (${ratioText(ratio)}:1)`,
          );
        } else if (ratio < need) {
          add(
            'contrast', 'warn', it.id,
            `'${it.id}' contrast is low (${ratioText(ratio)}:1, aim for ` +
            `${need}:1)`,
          );
        }
      }
    }
    if (it.type === 'photo') {
      const ph = it.props as PhotoProps;
      if (ph.src === '' && ph.field === '') {
        add('photo_empty', 'warn', it.id, `'${it.id}' has no photo yet`);
      } else if (ph.src === '') {
        add(
          'photo_empty', 'info', it.id,
          `'${it.id}' is a visitor field waiting for a photo`,
        );
      }
    }
  }

  for (let i = 0; i < doc.items.length; i++) {
    for (let k = i + 1; k < doc.items.length; k++) {
      const a = doc.items[i];
      const c = doc.items[k];
      if (!a || !c || !a.visible || !c.visible) continue;
      // Only a readable text can lose its words: decorative washes never warn.
      if (a.type !== 'text' || !readableText(contrasts.get(a), (a.props as TextProps).text)) continue;
      if (c.type === 'text') {
        // Two readable texts on each other: the upper one hides the lower's words.
        if (!readableText(contrasts.get(c), (c.props as TextProps).text)) continue;
        const r = overlapRatio(a, c);
        if (r > 0.05) {
          add('overlap', 'warn', a.id, `'${a.id}' overlaps '${c.id}'`);
        }
      } else if (c.type === 'shape' && !isLine(c) && (c.opacity ?? 1) >= 0.6) {
        // A solid shape on top buries the words only past a third of their box.
        // Photos, images and stickers keep their transparency (a cut-out's box
        // overstates it), so their boxes alone never warn.
        if (coverRatio(a, c) > 0.3) {
          add('overlap', 'warn', a.id, `'${a.id}' overlaps '${c.id}'`);
        }
      }
    }
  }

  let score = 100;
  for (const f of findings) {
    if (f.level === 'error') score -= 20;
    else if (f.level === 'warn') score -= 8;
    // Notes are for the eye only and never lower the score.
  }
  return { findings, score: Math.max(0, score) };
}
