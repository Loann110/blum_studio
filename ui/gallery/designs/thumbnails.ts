// Gallery thumbnails: lazy fetch, cache and paint.
import { renderDesign, type Design } from '../../render/render.js';
import { cards, dead, DEAD_RETRY_MS, designs, pending, rows } from './state.js';

export function thumbHtml(design: Design): string {
  // Safe for innerHTML sinks: renderDesign escapes every design string.
  return renderDesign(design, { assetsBase: '/assets', mediaBase: '/media' });
}

/* A hung request must never freeze the gallery: without a timeout one
 * stalled /api/designs answer would hold load.inflight (and one pump
 * slot) forever, silently stopping all polls and thumbnails. */
export const FETCH_TIMEOUT_MS = 30000;

export async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const control = new AbortController();
  const timer = window.setTimeout(() => control.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: control.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export const queue: string[] = [];
export let flying = 0;

export function fetchDesign(id: string): void {
  if (designs.has(id) || pending.has(id) || queue.includes(id)) return;
  const until = dead.get(id);
  if (until !== undefined) {
    if (until > Date.now()) return;
    dead.delete(id);
  }
  queue.push(id);
  pump();
}

export function pump(): void {
  while (flying < 6 && queue.length) {
    const id = queue.shift() as string;
    pending.add(id);
    flying += 1;
    fetchWithTimeout(`/api/designs/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        // The card may be gone by now (deleted elsewhere): never cache
        // or condemn an id the grid no longer shows.
        if (!cards.has(id)) return;
        if (body?.design) {
          const row = rows.find((r) => r.id === id);
          designs.set(id, {
            updated: row?.updated ?? 0,
            design: body.design as Design,
          });
          paintThumb(id);
        } else {
          // Missing or broken document: keep the placeholder and retry
          // later (or at once on a newer updated value).
          dead.set(id, Date.now() + DEAD_RETRY_MS);
        }
      })
      .catch(() => {
        // A dropped connection is transient: retry on the dead schedule
        // instead of waiting for the next document change.
        if (cards.has(id)) dead.set(id, Date.now() + DEAD_RETRY_MS);
      })
      .finally(() => {
        flying -= 1;
        pending.delete(id);
        pump();
      });
  }
}

export function paintThumb(id: string): void {
  const card = cards.get(id);
  const cached = designs.get(id);
  if (!card || !cached) return;
  const row = rows.find((r) => r.id === id);
  if (row && cached.updated !== row.updated) {
    // Stale render: refetch on the next visibility pass.
    designs.delete(id);
    card.renderedUpdated = -1;
    fetchDesign(id);
    return;
  }
  if (card.renderedUpdated === cached.updated) return;
  card.renderedUpdated = cached.updated;
  card.thumb.innerHTML = thumbHtml(cached.design);
  card.thumb.classList.remove('loading');
}

export const watcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const id = (entry.target as HTMLElement).dataset.design;
      if (id) {
        if (designs.has(id)) paintThumb(id);
        else fetchDesign(id);
      }
    }
  },
  { rootMargin: '600px' },
);