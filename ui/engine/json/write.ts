// Engine JSON output: designs to JSON (bindings parity).
import type {
  Design,
  FilterProps,
  GroupProps,
  ImageProps,
  Item,
  Paint,
  PhotoProps,
  ShapeProps,
  StickerProps,
  TextProps,
  VectorProps,
} from '../model.js';
import type { Json } from './read.js';

/* ---- JSON output (bindings parity) ---- */

function paintToJson(p: Paint): unknown {
  if (!p.gradient) return p.color;
  return {
    angle: p.gradient.angle,
    // New fields stay off the JSON unless set: old files round-trip byte-identical.
    ...(p.gradient.radial ? { radial: true } : {}),
    stops: p.gradient.stops.map((s) => ({ at: s.at, color: s.color })),
  };
}

function filterToJson(p: Json, f: FilterProps): void {
  p['filterPreset'] = f.preset;
  p['brightness'] = f.brightness;
  p['contrast'] = f.contrast;
  p['saturation'] = f.saturation;
  p['hue'] = f.hue;
  p['blur'] = f.blur;
  p['vignette'] = f.vignette;
  p['grayscale'] = f.grayscale;
  p['sepia'] = f.sepia;
}

function shadowToJson(
  p: Json,
  color: string,
  x: number,
  y: number,
  blur: number,
): void {
  p['shadowColor'] = color;
  p['shadowX'] = x;
  p['shadowY'] = y;
  p['shadowBlur'] = blur;
}

export function itemToJson(it: Item): Json {
  const d: Json = {
    id: it.id,
    name: it.name,
    type: it.type,
    x: it.x,
    y: it.y,
    width: it.width,
    height: it.height,
    angle: it.angle,
    opacity: it.opacity,
    locked: it.locked,
    visible: it.visible,
  };
  // New fields stay off the JSON unless set: old files round-trip byte-identical.
  if (it.blend !== '') d['blend'] = it.blend;
  const p: Json = {};
  if (it.type === 'text') {
    const t = it.props as TextProps;
    p['text'] = t.text;
    p['font'] = t.font;
    p['size'] = t.size;
    p['weight'] = t.weight;
    p['italic'] = t.italic;
    p['align'] = t.align;
    p['color'] = t.color;
    p['lineHeight'] = t.lineHeight;
    p['letterSpacing'] = t.letterSpacing;
    p['decoration'] = t.decoration;
    p['strikethrough'] = t.strikethrough;
    p['textCase'] = t.textCase;
    p['background'] = t.background;
    p['list'] = t.list;
    p['curve'] = t.curve;
    p['curveAmount'] = t.curveAmount;
    p['shrinkToFit'] = t.shrinkToFit;
    p['minSize'] = t.minSize;
    p['shadowColor'] = t.shadowColor;
    p['shadowX'] = t.shadowX;
    p['shadowY'] = t.shadowY;
    p['shadowBlur'] = t.shadowBlur;
    p['stroke'] = t.stroke;
    p['strokeWidth'] = t.strokeWidth;
    if (t.gradient) {
      p['gradient'] = {
        angle: t.gradient.angle,
        ...(t.gradient.radial ? { radial: true } : {}),
        stops: t.gradient.stops.map((s) => ({ at: s.at, color: s.color })),
      };
    }
    p['hollow'] = t.hollow;
    p['haloColor'] = t.haloColor;
    p['haloBlur'] = t.haloBlur;
    if (t.edge !== 0) p['edge'] = t.edge;
    p['field'] = t.field;
    p['label'] = t.label;
    if (t.textFill !== '') p['textFill'] = t.textFill;
  } else if (it.type === 'shape') {
    const s = it.props as ShapeProps;
    p['shape'] = s.shape;
    p['fill'] = paintToJson(s.fill);
    p['stroke'] = s.stroke;
    p['strokeWidth'] = s.strokeWidth;
    p['cornerRadius'] = s.cornerRadius;
    // New fields stay off the JSON unless set: old files round-trip byte-identical.
    if (s.edge !== 0) p['edge'] = s.edge;
    if (s.bend !== 0) p['bend'] = s.bend;
    if (s.headSize !== 0) p['headSize'] = s.headSize;
    if (s.lineStyle !== 'solid') p['lineStyle'] = s.lineStyle;
    if (s.startCap !== '') p['startCap'] = s.startCap;
    if (s.endCap !== '') p['endCap'] = s.endCap;
    if (s.points !== 5) p['points'] = s.points;
    if (s.innerRatio !== 0.42) p['innerRatio'] = s.innerRatio;
    if (s.sides !== 6) p['sides'] = s.sides;
    shadowToJson(p, s.shadowColor, s.shadowX, s.shadowY, s.shadowBlur);
  } else if (it.type === 'image') {
    const im = it.props as ImageProps;
    p['src'] = im.src;
    p['fit'] = im.fit;
    p['cornerRadius'] = im.cornerRadius;
    filterToJson(p, im.filter);
  } else if (it.type === 'sticker') {
    const st = it.props as StickerProps;
    p['sticker'] = st.sticker;
    p['tint'] = st.tint;
    if (st.outlineColor !== '') p['outlineColor'] = st.outlineColor;
    if (st.outlineWidth !== 0) p['outlineWidth'] = st.outlineWidth;
    shadowToJson(p, st.shadowColor, st.shadowX, st.shadowY, st.shadowBlur);
  } else if (it.type === 'vector') {
    const v = it.props as VectorProps;
    p['svg'] = v.svg;
    if (v.tint !== '') p['tint'] = v.tint;
    if (v.outlineColor !== '') p['outlineColor'] = v.outlineColor;
    if (v.outlineWidth !== 0) p['outlineWidth'] = v.outlineWidth;
    shadowToJson(p, v.shadowColor, v.shadowX, v.shadowY, v.shadowBlur);
  } else if (it.type === 'photo') {
    const ph = it.props as PhotoProps;
    p['field'] = ph.field;
    p['label'] = ph.label;
    p['mask'] = ph.mask;
    p['cornerRadius'] = ph.cornerRadius;
    p['src'] = ph.src;
    p['fit'] = ph.fit;
    filterToJson(p, ph.filter);
    if (ph.outlineColor !== '') p['outlineColor'] = ph.outlineColor;
    if (ph.outlineWidth !== 0) p['outlineWidth'] = ph.outlineWidth;
    if (ph.edge !== 0) p['edge'] = ph.edge;
  } else {
    const g = it.props as GroupProps;
    shadowToJson(p, g.shadowColor, g.shadowX, g.shadowY, g.shadowBlur);
  }
  d['props'] = p;
  if (it.type === 'group') {
    d['items'] = it.children.map((c) => itemToJson(c));
  }
  return d;
}

export function designToJson(doc: Design): Json {
  const b: Json = {
    kind: doc.background.kind,
    color: doc.background.color,
    angle: doc.background.angle,
    ...(doc.background.radial ? { radial: true } : {}),
    stops: doc.background.stops.map((s) => ({ at: s.at, color: s.color })),
    pattern: doc.background.pattern,
    patternColor: doc.background.patternColor,
    patternBackground: doc.background.patternBackground,
  };
  if (doc.background.patternScale !== 1) b['patternScale'] = doc.background.patternScale;
  if (doc.background.patternAngle !== 0) b['patternAngle'] = doc.background.patternAngle;
  if (doc.background.patternWeight !== 1) b['patternWeight'] = doc.background.patternWeight;
  b['image'] = doc.background.image;
  if (doc.background.grain !== 0) b['grain'] = doc.background.grain;
  return {
    version: doc.version,
    name: doc.name,
    format: doc.format,
    // Custom pages carry their size; table formats stay byte-identical to old files.
    ...(doc.width !== undefined ? { width: doc.width } : {}),
    ...(doc.height !== undefined ? { height: doc.height } : {}),
    background: b,
    items: doc.items.map((it) => itemToJson(it)),
  };
}