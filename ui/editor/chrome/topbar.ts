// Editor top bar: chrome, theme and menus.
import { state } from '../live.js';
import { PANELS, setPanel } from './rail.js';
import { buildZoomPill, setZoom } from './zoom.js';
import { renderAll } from '../render-loop.js';
import { deleteDesignFlow, doRedo, doUndo, exportPdf, exportPng, save } from '../actions/design.js';
import { showShortcuts } from '../overlays/shortcuts.js';
import { toggleMenu } from '../overlays/menus.js';
import { refreshIcons } from '../icons.js';

export function initTheme(): void {
  // Light only (the user's choice): clear any dark mode a browser kept from before.
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
}

export function buildChrome(): { canvasScroll: HTMLElement; contextbar: HTMLElement; panelRoot: HTMLElement; nameInput: HTMLInputElement; dirtyDot: HTMLElement; saveBadge: HTMLElement } {
  const app = document.getElementById('app');
  if (!app) throw new Error('editor chrome needs #app');
  app.innerHTML = '';
  app.removeAttribute('aria-busy');

  const top = document.createElement('header');
  top.className = 'topbar';
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<a class="back-link" href="/designs" title="Back to the designs" aria-label="Designs"><img src="/assets/brand/logo.svg" alt="" width="22" height="22" /><span class="label">Designs</span></a>';
  const nameInput = document.createElement('input');
  nameInput.className = 'doc-name';
  nameInput.setAttribute('aria-label', 'Design name');
  nameInput.addEventListener('change', () => {
    const next = nameInput.value.trim();
    if (next && next !== state.design.name) void save(next);
    else nameInput.value = state.design.name || '';
  });
  const badge = document.createElement('span');
  badge.className = 'format-badge';
  badge.id = 'format-badge';
  const dirtyDot = document.createElement('span');
  dirtyDot.className = 'dirty-dot';
  dirtyDot.title = 'Unsaved changes';
  const saveBadge = document.createElement('span');
  saveBadge.className = 'save-state';
  saveBadge.dataset.mode = 'saved';
  saveBadge.textContent = 'Saved';
  saveBadge.setAttribute('aria-live', 'polite');
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn icon';
  undoBtn.title = 'Undo (Ctrl+Z)';
  undoBtn.innerHTML = '<i data-lucide="undo-2"></i>';
  undoBtn.addEventListener('click', () => void doUndo());
  const redoBtn = document.createElement('button');
  redoBtn.className = 'btn icon';
  redoBtn.title = 'Redo (Ctrl+Shift+Z)';
  redoBtn.innerHTML = '<i data-lucide="redo-2"></i>';
  redoBtn.addEventListener('click', () => void doRedo());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.innerHTML = '<i data-lucide="save"></i><span class="label">Save</span>';
  saveBtn.setAttribute('aria-label', 'Save');
  saveBtn.addEventListener('click', () => void save());
  const fileWrap = document.createElement('div');
  fileWrap.className = 'menu-wrap';
  const fileBtn = document.createElement('button');
  fileBtn.className = 'btn';
  fileBtn.innerHTML = '<i data-lucide="folder-open"></i><span class="label">File</span>';
  fileBtn.setAttribute('aria-label', 'File');
  fileBtn.addEventListener('click', () => toggleMenu(fileBtn, 'file'));
  fileWrap.append(fileBtn);
  const viewWrap = document.createElement('div');
  viewWrap.className = 'menu-wrap';
  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn';
  viewBtn.innerHTML = '<i data-lucide="eye"></i><span class="label">View</span>';
  viewBtn.setAttribute('aria-label', 'View');
  viewBtn.addEventListener('click', () => toggleMenu(viewBtn, 'view'));
  viewWrap.append(viewBtn);
  const keysBtn = document.createElement('button');
  keysBtn.className = 'btn icon keys-btn';
  keysBtn.title = 'Shortcuts (?)';
  keysBtn.innerHTML = '<i data-lucide="keyboard"></i>';
  keysBtn.addEventListener('click', () => showShortcuts());
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn primary';
  exportBtn.innerHTML = '<i data-lucide="download"></i><span class="label">Export PNG</span>';
  exportBtn.setAttribute('aria-label', 'Export PNG');
  exportBtn.addEventListener('click', () => exportPng());
  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'btn';
  pdfBtn.innerHTML = '<i data-lucide="file-text"></i><span class="label">Export PDF</span>';
  pdfBtn.setAttribute('aria-label', 'Export PDF');
  pdfBtn.addEventListener('click', () => exportPdf());
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn';
  deleteBtn.innerHTML = '<i data-lucide="trash"></i><span class="label">Delete</span>';
  deleteBtn.setAttribute('aria-label', 'Delete');
  deleteBtn.title = 'Delete this design (with confirmation)';
  deleteBtn.addEventListener('click', () => deleteDesignFlow());
  top.append(brand, nameInput, badge, dirtyDot, saveBadge, spacer, undoBtn, redoBtn,
    saveBtn, fileWrap, viewWrap, keysBtn, exportBtn, pdfBtn, deleteBtn);

  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', 'Panels');
  for (const p of PANELS) {
    const btn = document.createElement('button');
    btn.dataset.panel = p.id;
    btn.innerHTML = `<i data-lucide="${p.icon}"></i><span>${p.label}</span>`;
    btn.addEventListener('click', () => setPanel(p.id));
    rail.append(btn);
  }
  const panelRoot = document.createElement('aside');
  panelRoot.className = 'side-panel';
  const zone = document.createElement('div');
  zone.className = 'canvas-zone';
  const contextbar = document.createElement('div');
  contextbar.className = 'contextbar';
  const scroll = document.createElement('div');
  scroll.className = 'canvas-scroll';
  const canvasScroll = scroll;
  zone.append(contextbar, scroll);
  zone.append(buildZoomPill((next) => {
    setZoom(next);
    renderAll();
  }));
  workspace.append(rail, panelRoot, zone);
  app.append(top, workspace);
  refreshIcons();
  return { canvasScroll, contextbar, panelRoot, nameInput, dirtyDot, saveBadge };
}