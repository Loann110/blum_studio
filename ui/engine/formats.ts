// Page formats as data: every size in the app (engine, renderer, editor,
// gallery, export, MCP) comes from this table. Print formats are laid out at
// 150 design px per inch, so default text and shape sizes read the same as on
// a 1080-wide story; exports scale them up (PNG at 300 dpi, PDF in mm).

export const PRINT_DPI = 150;
export const EXPORT_DPI = 300;

export interface PageFormat {
  id: string;
  label: string;
  width: number; // design px
  height: number;
  kind: 'screen' | 'print';
  mm?: [number, number]; // print: exact page size
  safe: { top: number; bottom: number; sides: number };
  minText: number; // smallest readable text, design px
}

const mmPx = (mm: number): number => Math.round((mm / 25.4) * PRINT_DPI);
// Print safe zone: 5 mm inside the trim on every side.
const printSafe = { top: mmPx(5), bottom: mmPx(5), sides: mmPx(5) };

function print(id: string, label: string, w: number, h: number): PageFormat {
  return { id, label, width: mmPx(w), height: mmPx(h), kind: 'print', mm: [w, h], safe: printSafe, minText: 20 };
}

export const FORMATS: PageFormat[] = [
  { id: 'story', label: 'Story 1080×1920', width: 1080, height: 1920, kind: 'screen', safe: { top: 150, bottom: 280, sides: 64 }, minText: 30 },
  { id: 'post', label: 'Post 1080×1350', width: 1080, height: 1350, kind: 'screen', safe: { top: 90, bottom: 90, sides: 64 }, minText: 30 },
  { id: 'square', label: 'Square 1080×1080', width: 1080, height: 1080, kind: 'screen', safe: { top: 64, bottom: 64, sides: 64 }, minText: 30 },
  { id: 'landscape', label: 'Landscape 1920×1080', width: 1920, height: 1080, kind: 'screen', safe: { top: 64, bottom: 64, sides: 96 }, minText: 30 },
  print('a6', 'A6 105×148 mm', 105, 148),
  print('a5', 'A5 148×210 mm', 148, 210),
  print('a4', 'A4 210×297 mm', 210, 297),
  print('a3', 'A3 297×420 mm', 297, 420),
  print('a6-landscape', 'A6 landscape 148×105 mm', 148, 105),
  print('a5-landscape', 'A5 landscape 210×148 mm', 210, 148),
  print('a4-landscape', 'A4 landscape 297×210 mm', 297, 210),
  print('a3-landscape', 'A3 landscape 420×297 mm', 420, 297),
  print('letter', 'US Letter 8.5×11 in', 215.9, 279.4),
  print('dl', 'DL flyer 99×210 mm', 99, 210),
];

export const CUSTOM = 'custom';
export const CUSTOM_MIN = 100;
export const CUSTOM_MAX = 4000;

export function findFormat(id: string): PageFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}

/** The page of a design: a table entry, or a custom size (screen kind). */
export function pageOf(format: string, width?: number, height?: number): PageFormat {
  const known = findFormat(format);
  if (known) return known;
  if (format === CUSTOM && validCustom(width, height)) {
    const w = Math.round(width as number);
    const h = Math.round(height as number);
    const m = Math.round(Math.min(w, h) * 0.05);
    return { id: CUSTOM, label: `Custom ${w}×${h}`, width: w, height: h, kind: 'screen', safe: { top: m, bottom: m, sides: m }, minText: Math.round(Math.min(w, h) / 36) };
  }
  return FORMATS[0]; // unknown: render as a story, validation reports it
}

export function validCustom(width: unknown, height: unknown): boolean {
  return [width, height].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= CUSTOM_MIN && v <= CUSTOM_MAX);
}
