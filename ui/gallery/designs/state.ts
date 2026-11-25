// Gallery state: elements, rows, cards, queues and focus refs.
import type { Design } from '../../render/render.js';

export const grid = document.getElementById('grid') as HTMLElement;
export const count = document.getElementById('count') as HTMLElement;
export const status = document.getElementById('status') as HTMLElement;

export interface Row {
  id: string;
  name: string;
  format: string;
  width?: number;
  height?: number;
  items: number;
  updated: number;
  template?: boolean; // samples: read-only, never deleted
}

export interface Card {
  cell: HTMLElement;
  thumb: HTMLAnchorElement;
  nameEl: HTMLElement;
  subEl: HTMLElement;
  openLink: HTMLAnchorElement;
  signature: string;
  renderedUpdated: number;
  /** The row.updated this card already attempted to draw (success or dead). */
  seenUpdated: number;
  /** Item count and format at that attempt: a rename alone is metadata. */
  seenItems: number;
  seenFormat: string;
  seenWidth?: number;
  seenHeight?: number;
}

/* A design whose document never loads (deleted mid-flight, broken JSON):
 * remember it briefly so lazy scrolling does not refetch it in a loop,
 * but retry after a while: a transient failure must not blank a card
 * forever. A newer updated value always retries at once (see reconcile). */
export const dead = new Map<string, number>();
export const DEAD_RETRY_MS = 30000;

export let rows: Row[] = [];

// Full documents and cards, keyed by design id.
export const designs = new Map<string, { updated: number; design: Design }>();
export const cards = new Map<string, Card>();
export const pending = new Set<string>();

/* A design missing from one listing is not gone: a file mid-write
 * elsewhere (or a torn read) must not drop its card — and the keyboard
 * focus inside it. Removal takes two consecutive misses. */
export const absent = new Map<string, number>();

/* Keyboard focus the polls must never steal: track which card holds it,
 * and if a removal drops it (torn listings), hand it back to the same
 * link as soon as the card is back — but only if the user did not move
 * focus elsewhere themselves in the meantime. */
export let focusDesign: string | null = null;
export let focusKind: 'thumb' | 'open' = 'open';
export let focusRestore: { id: string; kind: 'thumb' | 'open' } | null = null;


grid.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement | null;
  const cell = target?.closest?.('.cell') as HTMLElement | null;
  // Any focus the user (or a test) drives clears a pending restore.
  focusRestore = null;
  if (cell?.dataset.design && target instanceof HTMLAnchorElement) {
    focusDesign = cell.dataset.design;
    focusKind = target.classList.contains('open') ? 'open' : 'thumb';
  } else {
    focusDesign = null;
  }
});

// A pointer press is the user taking over: never yank focus (and the
// scroll position) back afterwards. Keyboard focus keeps flowing through
// focusin above, which re-arms tracking after this clears it.
document.addEventListener(
  'pointerdown',
  () => {
    focusDesign = null;
    focusRestore = null;
  },
  true,
);

// ESM importers cannot rebind module state: list.ts writes through these.
export function setRows(next: Row[]): void { rows = next; }
export function setFocusTarget(id: string | null): void { focusDesign = id; }
export function setFocusRestore(next: { id: string; kind: 'thumb' | 'open' } | null): void { focusRestore = next; }