// Gallery list: reconcile, draw, load and empty states.
import type { Card, Row } from './state.js';
import { absent, cards, count, dead, designs, focusDesign, focusKind, focusRestore, grid, rows, setRows, setFocusTarget, setFocusRestore, status } from './state.js';
import { signatureOf } from './text.js';
import { fetchDesign, fetchWithTimeout, queue, watcher } from './thumbnails.js';
import { makeCard, syncCard } from './cards.js';
import { createDesign, creating } from './create-design.js';

export function reconcile(list: Row[]): void {
  list.forEach((row, index) => {
    let card = cards.get(row.id);
    if (!card) {
      card = makeCard(row, forgetDesign);
    } else {
      if (card.signature !== signatureOf(row)) syncCard(card, row);
      // A newer document needs a fresh render (an add, a move, a recolour
      // elsewhere — or just a rename, which the row cannot tell apart).
      // Structural changes (count, format) clear the old pixels at once;
      // otherwise the old pixels stay until the fresh render lands, so a
      // rename never flashes the card.
      if (card.seenUpdated !== row.updated) {
        const structural =
          card.seenItems !== row.items || card.seenFormat !== row.format
          || card.seenWidth !== row.width || card.seenHeight !== row.height;
        card.seenUpdated = row.updated;
        card.seenItems = row.items;
        card.seenFormat = row.format;
        card.seenWidth = row.width;
        card.seenHeight = row.height;
        // Drop the cached document either way so the refetch below is not
        // swallowed by fetchDesign's designs.has guard; only a structural
        // change also blanks the pixels (a rename or a move keeps showing
        // the old render until the fresh one lands — no flash).
        designs.delete(row.id);
        dead.delete(row.id);
        if (structural) {
          card.renderedUpdated = -1;
          card.thumb.innerHTML = '';
          card.thumb.classList.add('loading');
        }
        if (card.thumb.isConnected) fetchDesign(row.id);
      }
    }
    // Keep order without rebuilding: move only the card that is out of
    // place, so a poll never shuffles 170 nodes under the cursor.
    const want = grid.children[index] ?? null;
    if (card.cell !== want) grid.insertBefore(card.cell, want);
  });
}

export function dropMissing(ids: Set<string>): void {
  for (const [id, card] of [...cards]) {
    if (ids.has(id)) {
      absent.delete(id);
      continue;
    }
    const strikes = (absent.get(id) ?? 0) + 1;
    if (strikes < 2) {
      absent.set(id, strikes);
      continue;
    }
    absent.delete(id);
    if (focusDesign === id) {
      // Our own poll is about to drop the user's focus: remember where
      // to hand it back when the card returns.
      setFocusRestore({ id, kind: focusKind });
      setFocusTarget(null);
    }
    removeCard(id, card);
  }
}

/** Takes a card out of the grid and forgets everything about it. */
function removeCard(id: string, card: Card): void {
  watcher.unobserve(card.thumb);
  card.cell.remove();
  cards.delete(id);
  designs.delete(id);
  dead.delete(id);
  // Never fetch a design the grid no longer shows.
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i] === id) queue.splice(i, 1);
  }
}

/** A design the user deleted: its card goes at once, then the list refreshes. */
export function forgetDesign(id: string): void {
  const card = cards.get(id);
  if (card) removeCard(id, card);
  absent.delete(id);
  void load(false);
}

export function draw(): void {
  // Skeletons go first so reconcile can place cards by child index.
  grid.querySelectorAll('.skeleton').forEach((n) => n.remove());
  reconcile(rows);
  count.textContent =
    rows.length === 0
      ? 'No designs yet'
      : `${rows.length} design${rows.length === 1 ? '' : 's'}` +
        ', live as your agent creates them';
  setEmpty(rows.length === 0);
  // A poll must not erase the "Creating…" note mid-creation.
  if (!creating) status.textContent = '';
  if (
    focusRestore &&
    cards.has(focusRestore.id) &&
    (document.activeElement === null ||
      document.activeElement === document.body)
  ) {
    // The card a torn listing took is back and the user did not move
    // focus elsewhere: hand it back to the same link.
    const card = cards.get(focusRestore.id);
    const link =
      focusRestore.kind === 'open' ? card?.openLink : card?.thumb;
    setFocusRestore(null);
    link?.focus();
  }
}

export function setEmpty(empty: boolean): void {
  const existing = grid.querySelector(':scope > .empty');
  if (!empty) {
    if (
      existing instanceof HTMLElement &&
      existing.contains(document.activeElement)
    ) {
      // Designs arrived while the user was about to create: keep them on
      // the matching toolbar button instead of dropping focus to the body.
      const gos = [...existing.querySelectorAll('.go')];
      const target = document.getElementById(
        gos.indexOf(document.activeElement as HTMLElement) === 1
          ? 'new-post'
          : 'new-story',
      );
      existing.remove();
      if (target instanceof HTMLButtonElement) target.focus();
      return;
    }
    existing?.remove();
    return;
  }
  if (
    existing instanceof HTMLElement &&
    existing.contains(document.activeElement)
  ) {
    return;
  }
  if (existing) return;
  const box = document.createElement('div');
  box.className = 'empty';
  box.textContent = 'Nothing here yet. Start with a story or a post: ';
  for (const format of ['story', 'post'] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini go';
    b.textContent = format === 'post' ? 'New post' : 'New story';
    b.addEventListener('click', () => void createDesign(format));
    box.append(b, document.createTextNode(' '));
  }
  grid.append(box);
}

export async function load(initial: boolean): Promise<void> {
  // Polls never overlap: a slow list answer wins on its own, a newer poll
  // just waits for the next tick instead of racing it out of order.
  if (!initial && load.inflight) return;
  if (initial) {
    grid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      grid.append(skeleton());
    }
    status.textContent = 'Loading designs…';
  }
  load.inflight = true;
  try {
    let res: Response;
    try {
      res = await fetchWithTimeout('/api/designs');
    } catch {
      if (initial) showLoadError();
      return;
    }
    if (!res.ok) {
      if (initial) showLoadError();
      return;
    }
    let listed: Row[];
    try {
      listed = (await res.json()) as Row[];
    } catch {
      // A 200 with a torn body (restart mid-write): same as a failure.
      if (initial) showLoadError();
      return;
    }
    // Age disappearances on every poll, even when the row key below is
    // unchanged and skips the redraw. Same tick retries thumbnails whose
    // dead-line expired, so a transient failure heals without an edit.
    dropMissing(new Set(listed.map((r) => r.id)));
    const now = Date.now();
    for (const [id, until] of dead) {
      if (until <= now) {
        const card = cards.get(id);
        if (card?.thumb.isConnected) fetchDesign(id);
      }
    }
    const key = JSON.stringify(
      listed.map((r) => [r.id, r.updated, r.items, r.name, r.format]),
    );
    if (key === load.lastKey) return;
    load.lastKey = key;
    setRows(listed);
    draw();
  } finally {
    load.inflight = false;
  }
}

export namespace load {
  export let lastKey = '';
  export let inflight = false;
}

export function skeleton(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'cell skeleton';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML =
    '<div class="card"><div class="thumb"></div>' +
    '<div class="meta"><div class="name"></div></div></div>';
  return s;
}

export function showLoadError(): void {
  grid.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'empty';
  box.textContent = 'Could not load the designs. ';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mini';
  b.textContent = 'Retry';
  b.addEventListener('click', () => void load(true));
  box.append(b);
  grid.append(box);
}