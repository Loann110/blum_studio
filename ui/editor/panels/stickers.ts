// Editor stickers panel: library, favorites and insert.
// The whole catalogue is fetched once; every tab and filter works on that
// cached copy, and a shared virtual grid only mounts the visible rows.
import { centerOf, hooks, liveReplaceTarget, loadNote, replaceHint, setReplaceTarget } from './hooks.js';
import { getResources } from '../api.js';
import { createElement, Heart } from 'lucide';
import { favorites, freshId, pushRecent, recents, toggleFavorite, type EditorState } from '../state.js';
import { pageOf } from '../../engine/index.js';
import { VirtualGrid } from '../../render/virtual-grid.js';

// A second open invalidates the first one's pending fetch: without it two
// quick clicks append the controls twice.
let mountRun = 0;
// The live grid, if any: a new mount destroys the previous one so its scroll
// listener never outlives the panel.
let activeGrid: VirtualGrid<Entry> | null = null;

/** Readable style names for the pack ids the catalogue uses. */
const PACK_LABELS: Record<string, string> = {
  'blum': 'Blum',
  'blum-doodles': 'Doodles',
  'fluent-color': 'Emoji, colour',
  'fluent-flat': 'Emoji, flat',
  'tabler-icons': 'Line icons',
  'opendoodles': 'Open Doodles',
};
/** Short names inside the grouped Kenney styles. */
const KENNEY_LABELS: Record<string, string> = {
  'kenney-animal-pack-remastered': 'Animals',
  'kenney-background-elements-remastered': 'Backgrounds',
  'kenney-emotes-pack': 'Emotes',
  'kenney-particle-pack': 'Particles',
  'kenney-scribble-dungeons': 'Dungeons',
  'kenney-scribble-planes': 'Planes',
  'kenney-scribble-platformer': 'Platformer',
  'kenney-scribble-platformer-expansion': 'Platformer extras',
};

type Entry = { id: string; file?: unknown; label: string; category: string; pack: string; keywords?: unknown };

export async function renderStickers(root: HTMLElement, st: EditorState): Promise<void> {
  if (!hooks) return;
  activeGrid?.destroy();
  activeGrid = null;
  const mine = ++mountRun;
  const alive = (): boolean => mine === mountRun && root.isConnected;
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabNames = ['All', 'Favorites', 'Recent'] as const;
  let tab: (typeof tabNames)[number] = 'All';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search stickers…';
  search.setAttribute('aria-label', 'Search stickers');
  const cats = document.createElement('select');
  cats.setAttribute('aria-label', 'Sticker category');
  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  const emptyNote = document.createElement('p');
  emptyNote.style.fontSize = '12px';
  emptyNote.textContent = 'No stickers found.';
  emptyNote.hidden = true;

  // Style filter: the same fruit exists in several packs (blum, color,
  // flat…); picking one style removes the triplicates. Values stay the raw
  // pack ids so filtering is exact; only the labels are readable.
  const packs = document.createElement('select');
  packs.setAttribute('aria-label', 'Sticker style');
  packs.append(new Option('All styles', ''));
  const drawPackOptions = (all: Entry[]): void => {
    const seen = new Set<string>();
    const kenney: string[] = [];
    for (const e of all) {
      if (!e.pack || seen.has(e.pack)) continue;
      seen.add(e.pack);
      if (e.pack in KENNEY_LABELS) kenney.push(e.pack);
      else packs.append(new Option(PACK_LABELS[e.pack] ?? e.pack, e.pack));
    }
    if (kenney.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Illustrations (Kenney)';
      for (const pack of kenney) group.append(new Option(KENNEY_LABELS[pack] ?? pack, pack));
      packs.append(group);
    }
  };

  const drawTabs = (): void => {
    tabs.innerHTML = '';
    for (const t of tabNames) {
      const b = document.createElement('button');
      b.textContent = t;
      if (t === tab) b.className = 'active';
      b.addEventListener('click', () => {
        tab = t;
        drawTabs();
        applyFilter();
      });
      tabs.append(b);
    }
  };

  cats.addEventListener('change', () => applyFilter());
  packs.addEventListener('change', () => applyFilter());

  // The whole catalogue, fetched once: every tab and filter works on this
  // copy, so typing or switching tabs never re-downloads 400 KB.
  let all: Entry[] = [];
  let loadError = '';
  try {
    const [cats2, got] = await Promise.all([
      getResources<string[]>('categories'),
      getResources<Entry[]>('stickers', '', 10000),
    ]);
    if (!alive()) return;
    all = got;
    cats.append(new Option('All categories', ''));
    for (const c of cats2) cats.append(new Option(c, c));
    drawPackOptions(all);
  } catch (err) {
    if (!alive()) return;
    loadError = (err as Error).message;
  }
  if (!alive()) return;

  let timer = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => applyFilter(), 250);
  });

  // Same matching as the server's stickerMatches, over the cached catalogue.
  const fold = (text: string): string =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matches = (e: Entry, query: string): boolean => {
    if (!query) return true;
    const kw = Array.isArray(e.keywords) ? (e.keywords as unknown[]).join(' ') : '';
    const hay = fold([e.id, e.file, e.label, e.category, e.pack, kw].map((v) => String(v ?? '')).join(' '));
    return fold(query).split(/\s+/).every((part) => part === '' || hay.includes(part));
  };

  // Every tab filters the same way: the base list (all, favorites or
  // recents) then the search, category and style. Before, Favorites and
  // Recent silently ignored the search and both menus while still showing
  // them, so the grid did not match the visible controls.
  const currentEntries = (): Entry[] => {
    let base: Entry[];
    if (tab === 'Favorites') {
      const favs = new Set(favorites());
      base = all.filter((e) => favs.has(e.id));
    } else if (tab === 'Recent') {
      const byId = new Map(all.map((e) => [e.id, e]));
      base = recents().map((id) => byId.get(id)).filter((e) => e !== undefined);
    } else {
      base = all;
    }
    const query = search.value.trim();
    let entries = query ? base.filter((e) => matches(e, query)) : base.slice();
    if (cats.value) entries = entries.filter((e) => e.category === cats.value);
    if (packs.value) entries = entries.filter((e) => e.pack === packs.value);
    return entries;
  };

  // One heart cloned per tile: converting thousands of Lucide icons one by one took over a minute.
  const heart = createElement(Heart);
  const favs = new Set<string>(favorites());
  const renderTile = (fig: HTMLElement, e: Entry): void => {
    fig.title = e.label || e.id;
    const img = document.createElement('img');
    img.src = `/assets/stickers/${e.id}`;
    img.alt = e.label || e.id;
    img.loading = 'lazy';
    img.addEventListener('click', () => void insertSticker(e.id));
    const star = document.createElement('button');
    star.className = 'fav' + (favs.has(e.id) ? ' on' : '');
    star.title = 'Favorite';
    star.append(heart.cloneNode(true));
    star.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleFavorite(e.id);
      star.classList.toggle('on');
    });
    fig.append(img, star);
  };

  const applyFilter = (): void => {
    if (!activeGrid || !alive()) return;
    const entries = currentEntries();
    emptyNote.hidden = entries.length > 0;
    // Favorites may have changed since the mount (heart toggles only flip
    // the star's class), so re-read them before re-rendering the window.
    favs.clear();
    for (const id of favorites()) favs.add(id);
    activeGrid.setItems(entries);
  };

  const target = liveReplaceTarget('sticker');
  if (target) {
    replaceHint(root, 'Click a sticker to replace the selected one.', 'stickers');
  }

  const insertSticker = async (file: string): Promise<void> => {
    if (!hooks) return;
    const again = liveReplaceTarget('sticker');
    if (again) {
      const ok = await hooks.commit([{ op: 'update', id: again.id, patch: { sticker: file } }]);
      if (ok) {
        pushRecent(file);
        setReplaceTarget(null);
        hooks.showPanel('stickers');
      }
      return;
    }
    const c = centerOf(st);
    const id = freshId(st.design, 'sticker');
    const k = pageOf(st.design.format ?? 'story', st.design.width, st.design.height).width / 1080;
    const ok = await hooks.commit([
      {
        op: 'add',
        item: {
          id,
          name: 'Sticker',
          type: 'sticker',
          x: c.x,
          y: c.y,
          width: Math.round(240 * k),
          height: Math.round(240 * k),
          props: { sticker: file },
        },
      },
    ]);
    if (ok) {
      pushRecent(file);
      hooks.setSelection([id]);
    }
  };

  drawTabs();
  root.append(search, cats, packs, tabs, grid, emptyNote);
  if (loadError) {
    grid.append(loadNote(`Could not load: ${loadError}`));
    return;
  }
  // The panel root is the scroller; three fixed columns like the CSS grid.
  activeGrid = new VirtualGrid<Entry>(grid, {
    scrollParent: root,
    columns: () => 3,
    estimateRowHeight: () => (grid.clientWidth - 2 * 8) / 3 + 8,
    renderTile,
    createTile: () => document.createElement('figure'),
  });
  applyFilter();
}
