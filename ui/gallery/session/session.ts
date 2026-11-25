// Session: the agent run on the right, its design on the left. The stream
// arrives by POST (so the request carries the guard headers) and is read
// line by line; the composer sends while idle and stops while running.
import { openHref, startPreview, trackDesigns } from './preview.js';
import { appendEvent, type TranscriptEvent } from './transcript.js';
import { renderRecents } from '../designs/recents.js';

interface Session {
  id: string;
  title: string;
  agent: string;
  designIds: string[];
  status: string;
  transcript: TranscriptEvent[];
}

const sessionId = window.location.pathname.split('/').pop() ?? '';
const titleEl = document.getElementById('title') as HTMLElement;
const metaEl = document.getElementById('meta') as HTMLElement;
const transcriptEl = document.getElementById('transcript') as HTMLElement;
const composerEl = document.getElementById('composer') as HTMLTextAreaElement;
const sendEl = document.getElementById('send') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const openEl = document.getElementById('open-studio') as HTMLAnchorElement;
const renameEl = document.getElementById('rename') as HTMLButtonElement;
const removeEl = document.getElementById('remove') as HTMLButtonElement;

let running = false;
let stopping = false;

initTheme();
renderRecents();
void boot();

/* ---- theme (same switch as the other gallery pages) ---- */

function initTheme(): void {
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
}

/* ---- load, stream, send, stop ---- */

async function boot(): Promise<void> {
  let session: Session;
  try {
    const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error();
    session = (await res.json()) as Session;
  } catch {
    titleEl.textContent = 'Unknown session';
    statusEl.textContent = 'This session does not exist.';
    sendEl.disabled = true;
    return;
  }
  titleEl.textContent = session.title;
  metaEl.textContent = `${session.agent} · ${session.status}`;
  openEl.href = openHref();
  startPreview(session.designIds);
  for (const event of session.transcript) appendEvent(transcriptEl, event);
  shownEvents = session.transcript.length;
  if (session.status === 'running') void followStream(shownEvents);
  else setIdle(session.status);
  void refreshDesigns();
  // New designs land mid-run: re-read the session while the agent works.
  window.setInterval(() => {
    if (running && !document.hidden) void refreshDesigns();
  }, 2500);
}

function setRunning(): void {
  running = true;
  stopping = false;
  sendEl.textContent = 'Stop';
  sendEl.disabled = false;
  statusEl.textContent = 'The agent is working…';
  metaEl.textContent = `${metaEl.textContent.split(' · ')[0]} · running`;
}

function setIdle(status: string): void {
  running = false;
  stopping = false;
  sendEl.textContent = 'Send';
  sendEl.disabled = false;
  statusEl.textContent = status === 'error' ? 'The run stopped with an error.' : 'Idle.';
  openEl.href = openHref();
}

// Designs created mid-run join the tabs without a reload.
async function refreshDesigns(): Promise<void> {
  try {
    const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return;
    const session = (await res.json()) as Session;
    trackDesigns(session.designIds);
    titleEl.textContent = session.title;
    metaEl.textContent = `${session.agent} · ${session.status}`;
    openEl.href = openHref();
  } catch {
    /* the next stream line will say more */
  }
}

/** Events already on screen: the stream replays only what is newer. */
let shownEvents = 0;

async function followStream(after: number): Promise<void> {
  setRunning();
  let res: Response;
  try {
    res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ after }),
    });
  } catch {
    statusEl.textContent = 'Lost the connection. Reload the page.';
    return;
  }
  if (!res.ok || !res.body) {
    statusEl.textContent = 'Lost the connection. Reload the page.';
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    tail += decoder.decode(value, { stream: true });
    const parts = tail.split('\n');
    tail = parts.pop() ?? '';
    for (const line of parts) handleLine(line);
  }
  if (tail.trim()) handleLine(tail);
}

function handleLine(line: string): void {
  if (!line.trim()) return;
  let event: TranscriptEvent & { kind: string };
  try {
    event = JSON.parse(line) as TranscriptEvent & { kind: string };
  } catch {
    return;
  }
  if (event.kind === 'end') {
    const status = (event as unknown as { status?: string }).status;
    setIdle(status ?? 'idle');
    void refreshDesigns();
    return;
  }
  shownEvents += 1;
  if (event.kind === 'error' || event.kind === 'tool' || event.kind === 'text' || event.kind === 'done') {
    appendEvent(transcriptEl, event);
  }
}

async function send(): Promise<void> {
  if (running) {
    await stop();
    return;
  }
  const text = composerEl.value.trim();
  if (!text) {
    composerEl.focus();
    return;
  }
  // The stream renders the saved message: no local copy, which it would replay.
  sendEl.disabled = true;
  try {
    const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ text }),
    });
    if (res.status === 409) {
      statusEl.textContent = 'Another agent is already running. Wait for it, then retry.';
      sendEl.disabled = false;
      return;
    }
    if (!res.ok) throw new Error();
    composerEl.value = '';
    void followStream(shownEvents);
  } catch {
    statusEl.textContent = 'Could not send. Try again.';
    sendEl.disabled = false;
  }
}

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  sendEl.disabled = true;
  statusEl.textContent = 'Stopping…';
  try {
    await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
    });
  } catch {
    /* the stream end carries the outcome */
  }
}

sendEl.addEventListener('click', () => void send());
composerEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
});

/* ---- rename and delete (the designs stay) ---- */

let renaming = false;

renameEl.addEventListener('click', () => {
  if (renaming) return;
  renaming = true;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = titleEl.textContent ?? '';
  input.maxLength = 80;
  input.setAttribute('aria-label', 'Session title');
  titleEl.textContent = '';
  titleEl.append(input);
  input.focus();
  input.select();
  const commit = async (save: boolean): Promise<void> => {
    if (!renaming) return;
    renaming = false;
    const title = input.value.trim();
    if (!save || !title) {
      void refreshTitle();
      return;
    }
    try {
      const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
    } catch {
      /* the title stays until the next load */
    }
    titleEl.textContent = title;
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void commit(true);
    else if (event.key === 'Escape') void commit(false);
  });
  input.addEventListener('blur', () => void commit(true));
});

async function refreshTitle(): Promise<void> {
  try {
    const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}`);
    if (res.ok) titleEl.textContent = ((await res.json()) as Session).title;
  } catch {
    /* keep the input text */
  }
}

let arming = false;

removeEl.addEventListener('click', () => {
  if (!arming) {
    arming = true;
    removeEl.textContent = 'Sure?';
    window.setTimeout(() => {
      arming = false;
      removeEl.textContent = 'Delete';
    }, 3000);
    return;
  }
  void (async () => {
    try {
      const res = await fetch(`/api/console/sessions/${encodeURIComponent(sessionId)}/delete`, {
        method: 'POST',
        headers: { 'X-Blum-Request': '1' },
      });
      if (!res.ok) throw new Error();
      window.location.href = '/designs';
    } catch {
      statusEl.textContent = 'Could not delete the session.';
    } finally {
      arming = false;
      removeEl.textContent = 'Delete';
    }
  })();
});
