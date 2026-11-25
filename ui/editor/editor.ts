// Editor bootstrap: builds the chrome, wires every module, owns the loop.
// Each batch applies locally first through the TS engine (instant page),
// then goes to the server in the background; the server stays the authority
// (files on disk, MCP, history) and a mismatch falls back to its design.

import { createDesign, getState, listDesigns, syncBaseline } from './api.js';
import { loadViewFlags, toast, topItems } from './state.js';
import { canvasScroll, panelRoot, setChromeRefs, state } from './live.js';
import { renderAll, setDirty, setSelection } from './render-loop.js';
import { commit, reloadRemote, watchRemote } from './commits.js';
import { setZoom } from './chrome/zoom.js';
import { startTextEdit } from './overlays/text-edit.js';
import { closePanel, markRail, setPanel } from './chrome/rail.js';
import { drawStage } from './canvas/stage.js';
import { save, doUndo, doRedo, exportPdf, exportPng, duplicateDesign, deleteDesignFlow, resetDesign } from './actions/design.js';
import { commitText, copy, cut, paste, duplicateSel, deleteSel, reorder, toggleLockSel, groupSel, ungroupSel } from './actions/items.js';
import { buildChrome, initTheme } from './chrome/topbar.js';
import { setReplaceTarget } from './panels/hooks.js';
import { mountPanels } from './panels/index.js';
import { mountToolbar } from './toolbar/hooks.js';
import { mountCanvas } from './canvas/stage.js';
import { drawOverlay } from './canvas/overlay.js';
import { queueRulers } from './canvas/rulers.js';
import { mountOverlays } from './overlays/hooks.js';
import { hideStart, showStart } from './overlays/start-screen.js';
import { applyContrast } from './overlays/menus.js';
import { bindCanvasKeys, bindCanvasPress } from './gestures/dispatch.js';
import { wireDouble } from './gestures/double-click.js';
import { wireViewport } from './canvas/viewport.js';
import { wireCanvasMenu } from './overlays/index.js';
import { bindKeys } from './keyboard.js';
import { trackSliderFill } from './chrome/sliders.js';
import { mountRulers, setRulersVisible } from './canvas/rulers.js';

async function openDesign(id: string): Promise<void> {
  state.id = id;
  const got = await getState(id);
  state.design = got.design;
  state.updated = got.updated;
  state.selection = [];
  setDirty(false);
  await syncBaseline(id);
  hideStart();
  renderAll();
  watchRemote();
}

async function boot(): Promise<void> {
  initTheme();
  Object.assign(state.view, loadViewFlags());
  applyContrast(state.view.contrast);
  setChromeRefs(buildChrome());
  mountPanels({
    state,
    commit,
    renderAll,
    setSelection,
    showPanel: (p) => setPanel(p),
    startTextEdit,
    closePanel,
    redraw: drawStage,
  });
  mountToolbar({
    state,
    commit,
    renderAll,
    setSelection,
    openImages: (replace) => {
      setReplaceTarget(replace ?? null);
      setPanel('images');
    },
    openStickers: (replace) => {
      setReplaceTarget(replace ?? null);
      setPanel('stickers');
    },
    redraw: drawStage,
  });
  mountCanvas(canvasScroll, {
    state,
    commit,
    renderAll,
    setSelection,
    setDirty,
    setZoom: (zoom) => {
      setZoom(zoom);
      renderAll();
    },
    startTextEdit,
    drawOverlay,
    queueRulers,
  });
  mountOverlays({
    state,
    save,
    undo: () => void doUndo(),
    redo: () => void doRedo(),
    exportPng,
    exportPdf,
    setPanel,
    commitText,
    renderAll,
    cut,
    copy,
    paste: () => void paste(),
    duplicateSel,
    deleteSel,
    reorder,
    toggleLockSel,
    groupSel,
    ungroupSel,
    selectAll: () => setSelection(topItems(state.design).filter((it) => it.visible !== false).map((it) => it.id)),
    reloadRemote,
    dismissBanner: () => {
      state.ignoredRemote = state.updated;
    },
    resetDesign,
    duplicateDesign,
    deleteDesignFlow,
  });
  mountRulers(canvasScroll);
  bindCanvasKeys();
  bindCanvasPress(canvasScroll);
  wireDouble(canvasScroll);
  wireViewport(canvasScroll);
  wireCanvasMenu(canvasScroll);
  bindKeys();
  trackSliderFill();
  setRulersVisible(state.view.rulers);
  // The editor opens with the panel closed and the page large.
  state.panel = 'text';
  panelRoot.classList.add('collapsed');
  markRail(state.panel);

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    try {
      await openDesign(id);
    } catch (err) {
      toast(`Could not open: ${(err as Error).message}`);
      await showStartScreen();
    }
    return;
  }
  await showStartScreen();
}

async function showStartScreen(): Promise<void> {
  try {
    const designs = await listDesigns();
    showStart(
      designs,
      (id) => {
        window.location.search = `?id=${encodeURIComponent(id)}`;
      },
      async (format, width, height) => {
        const made = await createDesign(`New ${format}`, format, width, height);
        window.location.search = `?id=${encodeURIComponent(made.id)}`;
      },
    );
  } catch (err) {
    toast(`Could not list designs: ${(err as Error).message}`);
  }
}


void boot();