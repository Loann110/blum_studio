// One complete, valid item per kind, served by api_info('items') so a client
// can build any element from scratch. server/test/mcp-designs.test.ts adds
// every example to a fresh design: keep them valid.
export const ITEM_EXAMPLES: Record<string, Record<string, unknown>> = {
  text: {
    id: "title", name: "title", type: "text", x: 540, y: 520, width: 860, height: 260, angle: 0, opacity: 1,
    props: {
      text: "Plus fort\nchaque jour", font: "Inter", size: 120, weight: 800, align: "left", color: "#111111",
      lineHeight: 0.95, letterSpacing: -3, textCase: "none",
    },
  },
  "text with highlight and shadow": {
    id: "cta", name: "cta", type: "text", x: 540, y: 1560, width: 700, height: 90,
    props: {
      text: "Essai gratuit", font: "Inter", size: 48, weight: 700, align: "center", color: "#ffffff",
      background: "#111111", shadowColor: "rgba(0,0,0,0.4)", shadowY: 4, shadowBlur: 12,
    },
  },
  "shape (filled rectangle)": {
    id: "band", name: "band", type: "shape", x: 540, y: 1500, width: 1080, height: 520, opacity: 1,
    props: { shape: "rect", fill: "#111111", cornerRadius: 0 },
  },
  "shape (gradient scrim)": {
    id: "scrim", name: "scrim", type: "shape", x: 540, y: 1500, width: 1080, height: 840, opacity: 0.7,
    props: { shape: "rect", fill: { angle: 180, stops: [{ at: 0, color: "rgba(0,0,0,0)" }, { at: 1, color: "#000000" }] } },
  },
  "shape (star, polygon)": {
    id: "badge", name: "badge", type: "shape", x: 860, y: 380, width: 260, height: 260, angle: -8,
    props: { shape: "star", fill: "#ffd60a", points: 12, innerRatio: 0.8 },
  },
  "shape (curved arrow)": {
    id: "arrow", name: "arrow", type: "shape", x: 540, y: 1200, width: 400, height: 120,
    props: { shape: "arrow", fill: "#111111", stroke: "#111111", strokeWidth: 8, bend: 0.4, endCap: "arrow", lineStyle: "solid" },
  },
  photo: {
    id: "hero", name: "hero", type: "photo", x: 540, y: 960, width: 1080, height: 1920,
    props: {
      src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1080&q=80",
      mask: "rect", cornerRadius: 0, fit: "cover", filterPreset: "original", brightness: -10,
    },
  },
  "photo (round portrait)": {
    id: "face", name: "face", type: "photo", x: 540, y: 700, width: 520, height: 520,
    props: { src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1080&q=80", mask: "circle", fit: "cover" },
  },
  sticker: {
    id: "fruit", name: "fruit", type: "sticker", x: 820, y: 1180, width: 220, height: 220, angle: 12,
    props: { sticker: "blum/pineapple.svg" },
  },
  "vector (or call draw_svg)": {
    id: "cup", name: "cup", type: "vector", x: 540, y: 1180, width: 240, height: 240,
    props: { svg: '<svg viewBox="0 0 24 24"><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#4f7a3a"/><path d="M16 10h2a2 2 0 0 1 0 4h-2" fill="none" stroke="#2b2f36" stroke-width="2" stroke-linecap="round"/></svg>' },
  },
  group: {
    id: "offer", name: "offer", type: "group", x: 540, y: 1300, width: 700, height: 200,
    props: {},
    items: [
      { id: "offer-bg", name: "offer-bg", type: "shape", x: 0, y: 0, width: 700, height: 200, props: { shape: "rounded", fill: "#ffd60a", cornerRadius: 40 } },
      { id: "offer-text", name: "offer-text", type: "text", x: 0, y: 0, width: 620, height: 90, props: { text: "-20 %", size: 80, weight: 800, align: "center", color: "#111111" } },
    ],
  },
};

export function itemExamplesDoc(): string {
  const lines = Object.entries(ITEM_EXAMPLES).map(([what, item]) => `${what}: ${JSON.stringify(item)}`);
  return (
    "Complete items for apply_ops add {item}. x/y is the item centre in design px, angle in degrees, " +
    "opacity 0..1; omitted props take their defaults. Group children use coordinates relative to the group centre. " +
    "Sizes below fit a 1080 px wide page: keep the same proportions on other page sizes (see list_formats). " +
    "Colours: #rrggbb or rgba(r,g,b,a). A shape fill is a colour string, {color} (flat) or {angle, stops} (gradient).\n" +
    "Text sits at the TOP of its box (no vertical centring): height ~ size x lineHeight x lines; the glyphs start " +
    "about 0.2-0.3 x size below the box top. letterSpacing also widens or eats the spaces: strong negative tracking " +
    "makes words collide, use a condensed font instead. Width/height are the unrotated size: a box turned by angle a " +
    "covers about w*cos(a) + h*sin(a). After each batch, preview and check_design (it reports wrapped text that overflows).\n" +
    lines.join("\n")
  );
}
