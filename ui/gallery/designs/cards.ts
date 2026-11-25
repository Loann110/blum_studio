// Gallery cards: build and sync DOM cards (thumbnail frame, title, actions).
import type { Card, Row } from './state.js';
import { cards } from './state.js';
import { pageOf } from '../../engine/index.js';
import { dims, itemCount, signatureOf } from './text.js';
import { watcher } from './thumbnails.js';
import { deleteButton } from './delete.js';

export function editorUrl(id: string): string {
  return `/editor/?id=${encodeURIComponent(id)}`;
}

/* ---- build ---- */

export function makeCard(row: Row, onDelete: (id: string) => void): Card {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.design = row.id;

  const article = document.createElement('article');
  article.className = 'card';

  // Every card has the same frame height whatever the page format, so rows
  // line up; the thumbnail keeps its own aspect inside it.
  const frame = document.createElement('div');
  frame.className = 'frame';
  const thumb = document.createElement('a');
  thumb.className = 'thumb loading';
  thumb.dataset.design = row.id;
  frame.append(thumb);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const text = document.createElement('div');
  text.className = 'text';
  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  const subEl = document.createElement('div');
  subEl.className = 'sub';
  text.append(nameEl, subEl);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const openLink = document.createElement('a');
  openLink.className = 'open';
  openLink.textContent = 'Open';
  actions.append(openLink);
  const del = deleteButton(row, onDelete);
  if (del) actions.append(del);

  meta.append(text, actions);
  article.append(frame, meta);
  cell.append(article);

  const card: Card = {
    cell,
    thumb,
    nameEl,
    subEl,
    openLink,
    signature: '',
    renderedUpdated: -2,
    seenUpdated: row.updated,
    seenItems: row.items,
    seenFormat: row.format,
    seenWidth: row.width,
    seenHeight: row.height,
  };
  syncCard(card, row);
  cards.set(row.id, card);
  watcher.observe(thumb);
  return card;
}

/* ---- sync ---- */

export function syncCard(card: Card, row: Row): void {
  card.signature = signatureOf(row);
  card.thumb.href = editorUrl(row.id);
  card.thumb.setAttribute('aria-label', `Open ${row.name} in Studio`);
  thumbAspect(card.thumb, row.format, row.width, row.height);
  card.nameEl.textContent = row.name;
  card.nameEl.title = row.name;
  // Short format name on the card ("A4", "Story"), the full size on hover.
  const full = dims(row.format, row.width, row.height);
  const short = row.format === 'custom' ? full.replace(/^Custom\s+/, '') : full.replace(/\s+\d.*$/, '');
  card.subEl.textContent = `${short} · ${itemCount(row.items)}`;
  card.subEl.title = full;
  card.openLink.href = editorUrl(row.id);
  card.openLink.setAttribute('aria-label', `Open ${row.name} in Studio`);
}

/** Thumbnails keep the page aspect and fit the frame by height or by width. */
export function thumbAspect(thumb: HTMLElement, format: string, width?: number, height?: number): void {
  const page = pageOf(format ?? 'story', width, height);
  thumb.style.aspectRatio = `${page.width} / ${page.height}`;
  // The frame is 4:5: taller pages fill its height, wider ones its width.
  thumb.classList.toggle('tall', page.width / page.height < 0.8);
}
