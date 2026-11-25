// Engine document model: types, canvas sizes and safe margins.
import { pageOf, type PageFormat } from './formats.js';

/* ---- model ---- */

export interface GradientStop {
  at: number;
  color: string;
}

export interface Paint {
  color: string;
  gradient: { angle: number; stops: GradientStop[]; radial?: boolean } | null;
}

export interface FilterProps {
  preset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  vignette: number;
  grayscale: boolean;
  sepia: boolean;
}

export interface TextProps {
  text: string;
  font: string;
  size: number;
  weight: number;
  italic: boolean;
  align: string;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  decoration: string;
  strikethrough: boolean;
  textCase: string;
  background: string;
  list: string;
  curve: string;
  curveAmount: number;
  shrinkToFit: boolean;
  minSize: number;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  stroke: string;
  strokeWidth: number;
  gradient: { angle: number; stops: GradientStop[]; radial?: boolean } | null;
  hollow: boolean;
  haloColor: string;
  haloBlur: number;
  /** Torn edge amount in design px (0 = straight cut). */
  edge: number;
  field: string;
  label: string;
  textFill: string;
}

export interface ShapeProps {
  shape: string;
  fill: Paint;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  /** Torn edge amount in design px (0 = straight cut). */
  edge: number;
  bend: number;
  headSize: number;
  lineStyle: string;
  startCap: string;
  endCap: string;
  points: number;
  innerRatio: number;
  sides: number;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
}

export interface ImageProps {
  src: string;
  fit: string;
  cornerRadius: number;
  filter: FilterProps;
}

export interface StickerProps {
  sticker: string;
  tint: string;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
}

/** An agent-drawn SVG (see vector.ts): recoloured, outlined and shadowed like a sticker. */
export interface VectorProps extends Omit<StickerProps, 'sticker'> {
  svg: string;
}

export interface PhotoProps {
  field: string;
  label: string;
  mask: string;
  cornerRadius: number;
  /** Torn edge amount in design px (0 = straight cut). */
  edge: number;
  src: string;
  fit: string;
  filter: FilterProps;
  outlineColor: string;
  outlineWidth: number;
}

export interface GroupProps {
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
}

export type Props =
  | TextProps
  | ShapeProps
  | ImageProps
  | StickerProps
  | VectorProps
  | PhotoProps
  | GroupProps;

export type ItemType = 'text' | 'shape' | 'image' | 'sticker' | 'vector' | 'photo' | 'group';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  blend: string;
  locked: boolean;
  visible: boolean;
  props: Props;
  children: Item[];
}

export interface Background {
  kind: string;
  color: string;
  angle: number;
  radial: boolean;
  stops: GradientStop[];
  pattern: string;
  patternColor: string;
  patternBackground: string;
  patternScale: number;
  patternAngle: number;
  patternWeight: number;
  image: string;
  grain: number;
}

export interface Design {
  version: number;
  name: string;
  format: string;
  width?: number; // custom format only
  height?: number;
  background: Background;
  items: Item[];
}

/* ---- canvas (sizes come from formats.ts) ---- */

export function pageOfDesign(doc: Design): PageFormat {
  return pageOf(doc.format, doc.width, doc.height);
}

export function canvasWidth(doc: Design): number {
  return pageOfDesign(doc).width;
}

export function canvasHeight(doc: Design): number {
  return pageOfDesign(doc).height;
}

export function safeMargins(doc: Design): { top: number; bottom: number; sides: number } {
  return pageOfDesign(doc).safe;
}