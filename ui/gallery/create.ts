// Create: the home page. One big prompt, format pills, file uploads and
// the agent picker, then hand off to the session page once the run starts.
import { FORMATS } from '../engine/index.js';
import { renderRecents } from './designs/recents.js';

interface ConsoleAgent {
  id: string;
  name: string;
  version?: string;
  installed: boolean;
  usable: boolean;
  reason?: string;
}

const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const sendEl = document.getElementById('send') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const formatsEl = document.getElementById('formats') as HTMLElement;
const chipsEl = document.getElementById('chips') as HTMLElement;
const attachEl = document.getElementById('attach') as HTMLButtonElement;
const fileEl = document.getElementById('file') as HTMLInputElement;
const agentButton = document.getElementById('agent-button') as HTMLButtonElement;
const agentMenu = document.getElementById('agent-menu') as HTMLElement;

let agents: ConsoleAgent[] = [];
let agentId: string | null = null;
let format = 'story';
let sending = false;
const attachments: string[] = [];

initTheme();
renderRecents();
void loadAgents();
buildPills();
wireComposer();
wireAttachments();

/* ---- theme (same switch as the other gallery pages) ---- */

function initTheme(): void {
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
}

/* ---- format pills (a few up front, the rest in a select) ---- */

function buildPills(): void {
  const quick = ['story', 'post', 'square', 'a4'];
  const moreEl = document.createElement('select');
  for (const id of quick) {
    const found = FORMATS.find((f) => f.id === id);
    if (!found) continue;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill' + (id === format ? ' on' : '');
    pill.textContent = found.label.split(' ')[0] ?? id;
    pill.title = found.label;
    pill.setAttribute('aria-pressed', id === format ? 'true' : 'false');
    pill.addEventListener('click', () => {
      format = id;
      for (const other of formatsEl.querySelectorAll('.pill')) {
        const on = other === pill;
        other.classList.toggle('on', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      moreEl.value = '';
    });
    formatsEl.append(pill);
  }
  moreEl.id = 'format-more';
  moreEl.setAttribute('aria-label', 'More formats');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'More…';
  moreEl.append(placeholder);
  for (const entry of FORMATS) {
    if (quick.includes(entry.id)) continue;
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    moreEl.append(option);
  }
  moreEl.addEventListener('change', () => {
    if (!moreEl.value) return;
    format = moreEl.value;
    for (const other of formatsEl.querySelectorAll('.pill')) {
      other.classList.remove('on');
      other.setAttribute('aria-pressed', 'false');
    }
  });
  formatsEl.append(moreEl);
}

/* ---- agents (this page only lists the ones it can launch and limit to the Blum tools) ---- */

async function loadAgents(): Promise<void> {
  try {
    const res = await fetch('/api/console/agents');
    if (!res.ok) throw new Error();
    agents = (await res.json()) as ConsoleAgent[];
  } catch {
    statusEl.textContent = 'Could not detect the agents. Check that the server runs, then retry.';
    agentButton.textContent = 'No agent';
    return;
  }
  const usable = agents.find((a) => a.usable);
  agentId = usable?.id ?? null;
  paintAgentButton();
  buildAgentMenu();
  if (!usable) {
    statusEl.innerHTML = '';
    statusEl.textContent = 'No drawing agent is available. Connect one in ';
    const link = document.createElement('a');
    link.href = '/settings';
    link.textContent = 'Settings';
    statusEl.append(link, document.createTextNode('.'));
    sendEl.disabled = true;
  }
}

function paintAgentButton(): void {
  const current = agents.find((a) => a.id === agentId);
  agentButton.textContent = current ? current.name : 'Choose an agent';
}

function buildAgentMenu(): void {
  agentMenu.innerHTML = '';
  for (const agent of agents.filter((a) => a.usable)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.role = 'menuitemradio';
    item.className = 'agent-item';
    item.setAttribute('aria-checked', agent.id === agentId ? 'true' : 'false');
    const name = document.createElement('div');
    name.className = 'agent-item-name';
    name.textContent = agent.name;
    const state = document.createElement('div');
    state.className = 'agent-item-state';
    state.textContent = 'Ready';
    item.append(name, state);
    item.addEventListener('click', () => {
      agentId = agent.id;
      paintAgentButton();
      closeMenu();
      promptEl.focus();
    });
    agentMenu.append(item);
  }
  // Settings works for every agent; this page only launches the ones it can limit to the Blum tools.
  const note = document.createElement('p');
  note.className = 'agent-menu-note';
  const link = document.createElement('a');
  link.href = '/settings';
  link.textContent = 'Settings';
  note.append('Every agent can use Blum: connect Codex, Muse, Cursor or Claude Desktop in ', link,
    ' and ask it from its own app. This page only starts agents it can limit to the Blum tools.');
  agentMenu.append(note);
}

function closeMenu(): void {
  agentMenu.hidden = true;
  agentButton.setAttribute('aria-expanded', 'false');
}

agentButton.addEventListener('click', () => {
  if (agentMenu.hidden) {
    agentMenu.hidden = false;
    agentButton.setAttribute('aria-expanded', 'true');
  } else {
    closeMenu();
  }
});

document.addEventListener('click', (event) => {
  if (!agentMenu.hidden && !(event.target as HTMLElement).closest?.('.agent-pick')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

/* ---- attachments: photos the agent imports, documents it reads ---- */

function wireAttachments(): void {
  attachEl.addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', () => {
    const files = [...(fileEl.files ?? [])];
    fileEl.value = '';
    for (const file of files) void uploadFile(file);
  });
}

async function uploadFile(file: File): Promise<void> {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = `Uploading ${file.name}…`;
  chipsEl.append(chip);
  try {
    const body = new FormData();
    body.append('file', file, file.name);
    const res = await fetch('/api/console/uploads', {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
      body,
    });
    if (!res.ok) throw new Error();
    const { path } = (await res.json()) as { path: string };
    attachments.push(path);
    chip.textContent = file.name;
  } catch {
    chip.remove();
    statusEl.textContent = `Could not attach ${file.name}: use an image, a PDF or a text file (TXT, MD, CSV, JSON).`;
  }
}

/* ---- send (Enter sends, Shift+Enter breaks the line) ---- */

function wireComposer(): void {
  promptEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });
  sendEl.addEventListener('click', () => void send());
}

async function send(): Promise<void> {
  if (sending || !agentId) return;
  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = 'Describe your design first.';
    promptEl.focus();
    return;
  }
  sending = true;
  sendEl.disabled = true;
  statusEl.textContent = 'Starting the agent…';
  try {
    const res = await fetch('/api/console/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ prompt, agent: agentId, format, attachments }),
    });
    if (res.status === 409) {
      statusEl.textContent = 'Another agent is already running. Wait for it, then retry.';
      return;
    }
    if (!res.ok) {
      statusEl.textContent = 'Could not start the agent. Try again.';
      return;
    }
    const { id } = (await res.json()) as { id: string };
    window.location.href = `/create/${encodeURIComponent(id)}`;
  } catch {
    statusEl.textContent = 'Could not start the agent. Try again.';
  } finally {
    sending = false;
    sendEl.disabled = !agentId;
  }
}
