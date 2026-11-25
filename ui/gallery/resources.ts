// Resources: browse everything the assistant can place in a design.
// Stickers, fonts and photos come from the same API the editor
// and the MCP server use, so this page never drifts from what is real.
export {};

import { renderRecents } from './designs/recents.js';
import { VirtualGrid, columnsForWidth } from '../render/virtual-grid.js';

const library = document.getElementById('library') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab')];
const searchEl = document.getElementById('search') as HTMLInputElement;
let currentKind = 'stickers';

/* ---- theme (same switch as the Designs page) ---- */

(function initTheme(): void {
  // Light only (the user's choice): clear any dark mode a browser kept from before.
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
})();

void renderRecents();

/* ---- tabs ---- */

/* Fast tab switches must not paint out of order: only the newest
 * request draws, older answers are dropped silently. */
let generation = 0;

/* The whole sticker catalogue, fetched once: the search filters this copy
 * in memory, over everything, without another download per keystroke. */
let stickerCache: StickerEntry[] | null = null;
let stickerGrid: VirtualGrid<StickerEntry> | null = null;

async function show(kind: string): Promise<void> {
  const mine = ++generation;
  currentKind = kind;
  for (const tab of tabs) {
    const active = tab.dataset.kind === kind;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  stickerGrid?.destroy();
  stickerGrid = null;
  library.innerHTML = '';
  statusEl.textContent = 'Loading…';
  // Large enough for the whole catalogue: images load lazily as they scroll in.
  const limit = 10000;
  const query = searchEl.value.trim();
  if (kind === 'stickers') {
    try {
      if (!stickerCache) {
        const res = await fetch(
          `/api/resources?kind=stickers&limit=${limit}`,
        );
        if (!res.ok) throw new Error(await res.text());
        stickerCache = (await res.json()) as StickerEntry[];
      }
    } catch {
      if (mine !== generation) return;
      statusEl.textContent = 'Could not load the resources. ';
      library.append(retryButton(kind));
      return;
    }
    if (mine !== generation) return;
    statusEl.textContent = '';
    drawStickers((stickerCache ?? []).filter((e) => stickerMatches(e, query)));
    return;
  }
  let res: Response;
  try {
    const encoded = encodeURIComponent(query);
    res = await fetch(
      `/api/resources?kind=${encodeURIComponent(kind)}&limit=${limit}&query=${encoded}`,
    );
  } catch {
    if (mine !== generation) return;
    statusEl.textContent = 'Could not load the resources. ';
    library.append(retryButton(kind));
    return;
  }
  if (!res.ok) {
    if (mine !== generation) return;
    statusEl.textContent = 'Could not load the resources. ';
    library.append(retryButton(kind));
    return;
  }
  let data: unknown;
  try {
    data = (await res.json()) as unknown;
  } catch {
    if (mine !== generation) return;
    statusEl.textContent = 'Could not load the resources. ';
    library.append(retryButton(kind));
    return;
  }
  if (mine !== generation) return;
  statusEl.textContent = '';
  if (kind === 'fonts') drawFonts(data as string[]);
  else drawPhotos(data as PhotoEntry[]);
  if (Array.isArray(data) && data.length === 0 && query) {
    statusEl.textContent = `Nothing matches “${query}”.`;
  }
  // The list is capped: say so, the search reaches the rest.
  if (Array.isArray(data) && data.length >= limit) statusEl.textContent += ', search to find more';
}

function retryButton(kind: string): HTMLElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mini';
  b.textContent = 'Retry';
  b.addEventListener('click', () => void show(kind));
  return b;
}

/* ---- stickers ---- */

interface StickerEntry {
  id: string;
  label: string;
  category: string;
  pack: string;
  keywords?: unknown;
}

/* Sticker SVGs are heavy to draw: handing dozens of new ones to the browser on
 * every scroll frame froze the page for seconds. Sources are set only once the
 * scroll has paused, for the tiles still on screen. */
const pendingImages = new Set<HTMLImageElement>();
let imageTimer = 0;

function deferImage(img: HTMLImageElement): void {
  pendingImages.add(img);
  window.clearTimeout(imageTimer);
  imageTimer = window.setTimeout(() => {
    for (const pending of pendingImages) {
      if (pending.isConnected && pending.dataset.src) pending.src = pending.dataset.src;
    }
    pendingImages.clear();
  }, 120);
}

/* Same matching as the server's stickerMatches, over the cached catalogue. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stickerMatches(entry: StickerEntry, query: string): boolean {
  if (!query) return true;
  const kw = Array.isArray(entry.keywords) ? (entry.keywords as unknown[]).join(' ') : '';
  const hay = fold([entry.id, entry.label, entry.category, entry.pack, kw].map((v) => String(v ?? '')).join(' '));
  return fold(query).split(/\s+/).every((part) => part === '' || hay.includes(part));
}

function drawStickers(entries: StickerEntry[]): void {
  statusEl.textContent =
    entries.length === 0
      ? (searchEl.value.trim() ? `Nothing matches “${searchEl.value.trim()}”.` : 'No stickers yet.')
      : `${entries.length} shown`;
  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  library.append(tiles);
  if (entries.length === 0) return;
  // Fixed columns like the CSS auto-fill would give, so the virtual rows
  // measure exactly what the grid shows; the look does not change.
  const measured = { width: 0, row: 0 };
  stickerGrid = new VirtualGrid<StickerEntry>(tiles, {
    scrollParent: window,
    columns: () => {
      const gap = 14;
      const n = columnsForWidth(tiles.clientWidth, 150, gap);
      tiles.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      return n;
    },
    // Measured once per width on a real tile (image + caption + row gap): an
    // estimate drifts row after row, and measuring on every layout forces a
    // reflow per scroll frame that froze the page.
    estimateRowHeight: () => {
      const width = tiles.clientWidth;
      if (measured.width === width && measured.row > 0) return measured.row;
      const tile = tiles.querySelector<HTMLElement>('.tile');
      const n = columnsForWidth(width, 150, 14);
      const row = tile ? tile.offsetHeight + 14 : (width - 14 * (n - 1)) / n + 40 + 14;
      if (tile) Object.assign(measured, { width, row });
      return row;
    },
    renderTile: (tile, entry) => {
      tile.className = 'tile';
      const img = document.createElement('img');
      img.dataset.src = `/assets/stickers/${entry.id}`;
      img.alt = entry.label || entry.id;
      img.decoding = 'async';
      deferImage(img);
      const caption = document.createElement('figcaption');
      caption.className = 'label';
      caption.textContent = entry.label || entry.id;
      caption.title = [entry.label, entry.category, entry.pack]
        .filter(Boolean)
        .join(' · ');
      tile.append(img, caption);
    },
    createTile: () => document.createElement('figure'),
  });
  stickerGrid.setItems(entries);
}

/* ---- fonts ---- */

function drawFonts(names: string[]): void {
  statusEl.textContent =
    names.length === 0 ? 'No fonts yet.' : `${names.length} shown`;
  const host = document.createElement('div');
  host.className = 'fonts';
  for (const name of names) {
    const card = document.createElement('div');
    card.className = 'font-card';
    const face = document.createElement('div');
    face.className = 'face';
    face.style.fontFamily = `"${name}", sans-serif`;
    face.textContent = name;
    const pangram = document.createElement('div');
    pangram.className = 'pangram';
    pangram.style.fontFamily = `"${name}", sans-serif`;
    pangram.textContent = 'Aa — The quick brown fox';
    card.append(face, pangram);
    host.append(card);
  }
  library.append(host);
}

/* ---- photos ---- */

interface PhotoEntry {
  id: string;
  url: string;
  description: string;
  themes: string[];
}

function drawPhotos(entries: PhotoEntry[]): void {
  statusEl.textContent =
    entries.length === 0 ? 'No photos yet.' : `${entries.length} shown`;
  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  for (const entry of entries) {
    const tile = document.createElement('figure');
    tile.className = 'tile photo';
    const img = document.createElement('img');
    img.src = entry.url;
    img.alt = entry.description || entry.id;
    img.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.className = 'label';
    const themes = [...new Set(entry.themes ?? [])].join(', ');
    caption.textContent = themes ? `${entry.id} — ${themes}` : entry.id;
    caption.title = entry.description || caption.textContent;
    tile.append(img, caption);
    tiles.append(tile);
  }
  library.append(tiles);
}

/* ---- wiring ---- */

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    void show(tab.dataset.kind ?? 'stickers');
  });
}
let searchTimer = 0;
searchEl.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void show(currentKind), 200);
});
void show('stickers');
