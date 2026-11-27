// Engine JSON input: parse designs and ops (bindings parity).
import type {
  Background,
  Design,
  FilterProps,
  GradientStop,
  GroupProps,
  ImageProps,
  Item,
  ItemType,
  Paint,
  PhotoProps,
  ShapeProps,
  StickerProps,
  TextProps,
  VectorProps,
} from '../model.js';
import { fail } from '../errors.js';

/* ---- JSON parsing (bindings parity) ---- */

export type Json = Record<string, unknown>;

export function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function str(d: Json, key: string, fb = ''): string {
  const v = d[key];
  return typeof v === 'string' ? v : fb;
}

export function num(d: Json, key: string, fb = 0): number {
  const v = d[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fb;
}

export function bool(d: Json, key: string, fb = false): boolean {
  const v = d[key];
  return typeof v === 'boolean' ? v : fb;
}

export function int(d: Json, key: string, fb = 0): number {
  const v = d[key];
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fb;
}

export function has(d: Json, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(d, key);
}

export function parsePaint(v: unknown): Paint {
  if (typeof v === 'string') return { color: v, gradient: null };
  const d = v as Json;
  // An object without stops is a flat color ({color}); only a stops array
  // makes a gradient (a color beside stops is ignored, like CSS).
  if (!Array.isArray(d['stops'])) return { color: str(d, 'color'), gradient: null };
  const stops: GradientStop[] = [];
  const raw = d['stops'];
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const sd = s as Json;
      stops.push({ at: sd['at'] as number, color: sd['color'] as string });
    }
  }
  // radial: true draws a round halo from the center instead of a linear sweep.
  const gradient: { angle: number; stops: GradientStop[]; radial?: boolean } =
    { angle: num(d, 'angle', 135), stops };
  if (bool(d, 'radial')) gradient.radial = true;
  return { color: '', gradient };
}

export function parseFilter(p: Json): FilterProps {
  const preset = str(p, 'filterPreset', 'original');
  return {
    preset: preset !== '' ? preset : 'original',
    brightness: num(p, 'brightness'),
    contrast: num(p, 'contrast'),
    saturation: num(p, 'saturation'),
    hue: num(p, 'hue'),
    blur: num(p, 'blur'),
    vignette: num(p, 'vignette'),
    grayscale: bool(p, 'grayscale'),
    sepia: bool(p, 'sepia'),
  };
}

export function parseShadow(p: Json): {
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
} {
  return {
    shadowColor: str(p, 'shadowColor'),
    shadowX: num(p, 'shadowX', 0),
    shadowY: num(p, 'shadowY', 3),
    shadowBlur: num(p, 'shadowBlur', 8),
  };
}

// Text gradient fill ({angle, stops}, radial: true for a round halo),
// or null when absent. A flat text keeps color; only a stops array
// makes a gradient.
export function parseTextGradient(
  v: unknown,
): { angle: number; stops: GradientStop[]; radial?: boolean } | null {
  if (!isObj(v) || !Array.isArray((v as Json)['stops'])) return null;
  const d = v as Json;
  const stops: GradientStop[] = [];
  for (const s of d['stops'] as unknown[]) {
    const sd = s as Json;
    stops.push({ at: sd['at'] as number, color: sd['color'] as string });
  }
  const gradient: { angle: number; stops: GradientStop[]; radial?: boolean } =
    { angle: num(d, 'angle', 180), stops };
  if (bool(d, 'radial')) gradient.radial = true;
  return gradient;
}

export function parseBackground(b: unknown): Background {
  const d = (isObj(b) ? b : {}) as Json;
  const stops: GradientStop[] = [];
  if (Array.isArray(d['stops'])) {
    for (const s of d['stops']) {
      const sd = s as Json;
      stops.push({ at: sd['at'] as number, color: sd['color'] as string });
    }
  }
  // Agents send kind flat for a plain color (the old ops doc said so).
  const kind = str(d, 'kind', 'color');
  return {
    kind: kind === 'flat' ? 'color' : kind,
    color: str(d, 'color', '#ffffff'),
    angle: num(d, 'angle', 135),
    radial: bool(d, 'radial'),
    stops,
    pattern: str(d, 'pattern', 'dots'),
    patternColor: str(d, 'patternColor', '#111111'),
    patternBackground: str(d, 'patternBackground', ''),
    patternScale: num(d, 'patternScale', 1),
    patternAngle: num(d, 'patternAngle', 0),
    patternWeight: num(d, 'patternWeight', 1),
    image: str(d, 'image', ''),
    grain: num(d, 'grain'),
  };
}

export const ITEM_TYPES: ItemType[] = ['text', 'shape', 'image', 'sticker', 'vector', 'photo', 'group'];

export function parseItem(d: Json): Item {
  const typeStr = str(d, 'type');
  if (!ITEM_TYPES.includes(typeStr as ItemType)) fail('unknown item type');
  const type = typeStr as ItemType;
  const id = str(d, 'id');
  const p = (isObj(d['props']) ? d['props'] : {}) as Json;
  let props: Item['props'];
  if (type === 'text') {
    const field = str(p, 'field');
    const tp: TextProps = {
      text: str(p, 'text'),
      font: str(p, 'font', 'Inter'),
      size: num(p, 'size', 64),
      weight: has(p, 'weight') ? int(p, 'weight') : 400,
      italic: bool(p, 'italic'),
      align: str(p, 'align', 'left'),
      color: str(p, 'color', '#111111'),
      lineHeight: num(p, 'lineHeight', 1.2),
      letterSpacing: num(p, 'letterSpacing'),
      decoration: str(p, 'decoration', 'none'),
      strikethrough: bool(p, 'strikethrough'),
      textCase: str(p, 'textCase', 'none'),
      background: str(p, 'background'),
      list: str(p, 'list', 'none'),
      curve: str(p, 'curve', 'none'),
      curveAmount: num(p, 'curveAmount', 32),
      shrinkToFit: bool(p, 'shrinkToFit'),
      minSize: num(p, 'minSize', 12),
      shadowColor: str(p, 'shadowColor'),
      shadowX: num(p, 'shadowX', 0),
      shadowY: num(p, 'shadowY', 3),
      shadowBlur: num(p, 'shadowBlur', 8),
      stroke: str(p, 'stroke'),
      strokeWidth: num(p, 'strokeWidth', 0),
      gradient: parseTextGradient(p['gradient']),
      hollow: bool(p, 'hollow'),
      haloColor: str(p, 'haloColor'),
      haloBlur: num(p, 'haloBlur', 14),
      edge: num(p, 'edge'),
      field,
      label: has(p, 'label') ? str(p, 'label') : field,
      textFill: str(p, 'textFill'),
    };
    props = tp;
  } else if (type === 'shape') {
    const sp: ShapeProps = {
      shape: str(p, 'shape', 'rect'),
      fill: has(p, 'fill') ? parsePaint(p['fill']) : { color: '#111111', gradient: null },
      stroke: str(p, 'stroke'),
      strokeWidth: num(p, 'strokeWidth'),
      cornerRadius: num(p, 'cornerRadius'),
      edge: num(p, 'edge'),
      bend: num(p, 'bend'),
      headSize: num(p, 'headSize'),
      lineStyle: str(p, 'lineStyle', 'solid'),
      startCap: str(p, 'startCap', ''),
      endCap: str(p, 'endCap', ''),
      points: has(p, 'points') ? int(p, 'points') : 5,
      innerRatio: num(p, 'innerRatio', 0.42),
      sides: has(p, 'sides') ? int(p, 'sides') : 6,
      ...parseShadow(p),
    };
    props = sp;
  } else if (type === 'image') {
    const ip: ImageProps = {
      src: str(p, 'src'),
      fit: str(p, 'fit', 'cover'),
      cornerRadius: num(p, 'cornerRadius'),
      filter: parseFilter(p),
    };
    props = ip;
  } else if (type === 'sticker') {
    const sp: StickerProps = {
      sticker: str(p, 'sticker'),
      tint: str(p, 'tint'),
      outlineColor: str(p, 'outlineColor'),
      outlineWidth: num(p, 'outlineWidth'),
      ...parseShadow(p),
    };
    props = sp;
  } else if (type === 'vector') {
    const vp: VectorProps = {
      svg: str(p, 'svg'),
      tint: str(p, 'tint'),
      outlineColor: str(p, 'outlineColor'),
      outlineWidth: num(p, 'outlineWidth'),
      ...parseShadow(p),
    };
    props = vp;
  } else if (type === 'photo') {
    const field = str(p, 'field');
    const pp: PhotoProps = {
      field,
      label: has(p, 'label') ? str(p, 'label') : field,
      mask: str(p, 'mask', 'rect'),
      cornerRadius: num(p, 'cornerRadius', 48),
      edge: num(p, 'edge'),
      src: str(p, 'src'),
      fit: str(p, 'fit', 'cover'),
      filter: parseFilter(p),
      outlineColor: str(p, 'outlineColor'),
      outlineWidth: num(p, 'outlineWidth'),
    };
    props = pp;
  } else {
    const gp: GroupProps = { ...parseShadow(p) };
    props = gp;
  }
  const children: Item[] = [];
  if (type === 'group' && Array.isArray(d['items'])) {
    for (const c of d['items'] as unknown[]) {
      children.push(parseItem(c as Json));
    }
  }
  return {
    id,
    name: has(d, 'name') ? str(d, 'name') : id,
    type,
    x: num(d, 'x'),
    y: num(d, 'y'),
    width: num(d, 'width', 100),
    height: num(d, 'height', 100),
    angle: num(d, 'angle'),
    opacity: num(d, 'opacity', 1),
    blend: str(d, 'blend'),
    locked: has(d, 'locked') ? bool(d, 'locked') : false,
    visible: has(d, 'visible') ? bool(d, 'visible') : true,
    props,
    children,
  };
}

export function parseDesign(d: Json): Design {
  const bg = has(d, 'background') ? parseBackground(d['background']) : parseBackground({});
  const items: Item[] = [];
  if (Array.isArray(d['items'])) {
    for (const c of d['items'] as unknown[]) items.push(parseItem(c as Json));
  }
  return {
    version: has(d, 'version') ? int(d, 'version') : 1,
    name: str(d, 'name', 'Untitled'),
    format: str(d, 'format', 'story'),
    ...(typeof d['width'] === 'number' ? { width: d['width'] as number } : {}),
    ...(typeof d['height'] === 'number' ? { height: d['height'] as number } : {}),
    background: bg,
    items,
  };
}