// Gallery creation: new designs from the toolbar and the empty states.
// The creating flag keeps the poll from erasing the "Creating…" note.
import { grid, status } from './state.js';
import { editorUrl } from './cards.js';
import { fetchWithTimeout } from './thumbnails.js';

export let creating = false;
export function setCreating(busy: boolean): void {
  creating = busy;
  for (const id of ['new-story', 'new-post', 'new-create']) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) button.disabled = busy;
  }
  grid
    .querySelectorAll<HTMLButtonElement>('.empty .go')
    .forEach((b) => {
      b.disabled = busy;
    });
}

export async function createDesign(format: string, width?: number, height?: number): Promise<void> {
  if (creating) return;
  setCreating(true);
  const name = format === 'post' ? 'New post' : format === 'story' ? 'New story' : `New ${format}`;
  status.textContent = `Creating ${name.toLowerCase()}…`;
  try {
    const res = await fetchWithTimeout('/api/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ name, format, width, height }),
    });
    if (!res.ok) {
      status.textContent = 'Could not create the design. Try again.';
      return;
    }
    const made = (await res.json()) as { id: string };
    window.location.href = editorUrl(made.id);
  } catch {
    status.textContent = 'Could not create the design. Try again.';
  } finally {
    setCreating(false);
  }
}
