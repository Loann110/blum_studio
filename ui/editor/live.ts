// Live editor singletons: the open design state and the chrome element
// refs, filled in at boot. Shared here so modules never import the boot
// entry back.
import { blankState, type EditorState } from './state.js';

export const state: EditorState = blankState();

export let canvasScroll: HTMLElement;
export let contextbar: HTMLElement;
export let panelRoot: HTMLElement;
export let nameInput: HTMLInputElement;
export let dirtyDot: HTMLElement;
export let saveBadge: HTMLElement;

/** Filled in once at boot from the built chrome (same mount pattern as the hooks). */
export function setChromeRefs(refs: {
  canvasScroll: HTMLElement;
  contextbar: HTMLElement;
  panelRoot: HTMLElement;
  nameInput: HTMLInputElement;
  dirtyDot: HTMLElement;
  saveBadge: HTMLElement;
}): void {
  ({ canvasScroll, contextbar, panelRoot, nameInput, dirtyDot, saveBadge } = refs);
}
