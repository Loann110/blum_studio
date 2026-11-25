// Shared render model: design, item and prop types.
export interface GradientStop {
  at: number;
  color: string;
}

export interface Paint {
  color?: string;
  angle?: number;
  /** True = round halo from the center instead of a linear sweep. */
  radial?: boolean;
  stops?: GradientStop[];
}

export interface TextProps {
  text?: string;
  font?: string;
  size?: number;
  weight?: number;
  italic?: boolean;
  align?: string;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  decoration?: string;
  strikethrough?: boolean;
  textCase?: string;
  /** Empty = none (highlight behind the text). */
  background?: string;
  /** Photo source drawn through the glyphs (background-clip: text). */
  textFill?: string;
  /** none | bullet | numbered. */
  list?: string;
  /** Curved text: none | up | down, with the arc height in design px. */
  curve?: string;
  curveAmount?: number;
  /** Keep the box height, shrink the size down to minSize while typing. */
  shrinkToFit?: boolean;
  minSize?: number;
  /** Drop shadow: empty color = off. */
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  /** Outline stroke: empty color = off. */
  stroke?: string;
  strokeWidth?: number;
  /** Gradient fill ({angle, stops}, radial: true for a round halo); overrides the flat color. */
  gradient?: { angle?: number; radial?: boolean; stops?: Array<{ at?: number; color?: string }> } | null;
  /** Hollow: transparent fill drawn through the outline. */
  hollow?: boolean;
  /** Halo: soft outer glow; empty color = off (falls back to the text color). */
  haloColor?: string;
  haloBlur?: number;
  /** Torn edge amount in design px (0 = straight cut). */
  edge?: number;
}

export interface ShapeProps {
  startCap?: string;
  endCap?: string;
  shape?: string;
  fill?: string | Paint;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  /** Torn edge amount in design px (0 = straight cut). */
  edge?: number;
  /** Bend of a line arrow as a fraction of its length (-1..1, 0 = straight). */
  bend?: number;
  /** Arrowhead size in design px (0 = automatic from the thickness). */
  headSize?: number;
  /** solid | dashed | dotted (lines and line arrows). */
  lineStyle?: string;
  /** Star points (3..12, default 5). */
  points?: number;
  /** Star spike depth (0.1..0.95, default 0.42). */
  innerRatio?: number;
  /** Polygon sides (3..12, default 6). */
  sides?: number;
  /** Drop shadow: empty color = off. */
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
}

/** Photo filters, shared by plain images and visitor photo frames. */
export interface FilterProps {
  /** original | vivid | warm | cold | mono | noir | faded | vintage | dramatic. */
  filterPreset?: string;
  /** -100..100 (% shift, 0 = off). */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  /** -180..180 degrees. */
  hue?: number;
  /** 0..100 design px. */
  blur?: number;
  /** 0..100 %. */
  vignette?: number;
  grayscale?: boolean;
  sepia?: boolean;
}

export interface ImageProps extends FilterProps {
  src?: string;
  fit?: string;
  cornerRadius?: number;
}

export interface StickerProps {
  sticker?: string;
  /** Vector items only: the agent-drawn SVG (checked by engine/vector.ts). */
  svg?: string;
  tint?: string;
  /** Silhouette outline: empty color or zero width = off. */
  outlineColor?: string;
  outlineWidth?: number;
  /** Drop shadow: empty color = off. */
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
}

export interface PhotoProps extends FilterProps {
  field?: string;
  label?: string;
  mask?: string;
  cornerRadius?: number;
  src?: string;
  /** Torn edge amount in design px (0 = straight cut). */
  edge?: number;
  fit?: string;
  /** Silhouette outline: empty color or zero width = off. */
  outlineColor?: string;
  outlineWidth?: number;
}

export interface GroupProps {
  /** Drop shadow over the whole group: empty color = off. */
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
}

export interface DesignItem {
  id: string;
  name?: string;
  type: 'text' | 'shape' | 'image' | 'sticker' | 'vector' | 'photo' | 'group';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  opacity?: number;
  /** CSS blend with the page behind (multiply, screen, overlay, ...). */
  blend?: string;
  locked?: boolean;
  visible?: boolean;
  props?: TextProps & ShapeProps & ImageProps & StickerProps & PhotoProps & GroupProps;
  items?: DesignItem[];
}

export interface DesignBackground {
  kind?: string;
  color?: string;
  grain?: number;
  angle?: number;
  radial?: boolean;
  stops?: GradientStop[];
  pattern?: string;
  patternColor?: string;
  patternBackground?: string;
  /** Pattern size multiplier, 0.25..4 (1 = default, off the JSON). */
  patternScale?: number;
  /** Pattern rotation, 0..360 degrees (0 = default, off the JSON). */
  patternAngle?: number;
  /** Pattern line width or dot size multiplier, 0.25..4 (1 = default). */
  patternWeight?: number;
  image?: string;
}

export interface Design {
  version?: number;
  name?: string;
  format?: string;
  width?: number; // custom format only
  height?: number;
  background?: DesignBackground;
  items?: DesignItem[];
}

export interface RenderOptions {
  assetsBase?: string;
  mediaBase?: string;
}