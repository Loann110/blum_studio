// Virtualized tile grid: only the visible rows live in the DOM.
// Shared by the editor sticker panel and the Resources page: both show the
// same catalogue (thousands of tiles) through a fixed-column grid with
// fixed-height tiles. The caller's tile markup and CSS stay untouched: the
// grid only adds a top and bottom spacer inside the grid box so the scroller
// keeps its full height, and renders the visible rows plus a small overscan.
// Tiles are keyed by item index, so rows that stay visible across a scroll
// keep their DOM nodes (their images stay decoded).
// Pure range math lives in visibleRange (tested); the class wires it to scroll
// and resize events. No DOM access happens at module load, so Node can import
// the pure half for tests.

/** Visible row window: [start, end), end exclusive. */
export interface GridRange {
  start: number;
  end: number;
}

/**
 * Which rows to render for a scroll position. Everything is in pixels except
 * overscanRows, the extra rows kept above and below the viewport.
 */
export function visibleRange(
  totalItems: number,
  columns: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscanRows: number,
): GridRange {
  if (totalItems <= 0 || columns <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
    return { start: 0, end: 0 };
  }
  const rows = Math.ceil(totalItems / columns);
  const over = Math.max(0, Math.floor(overscanRows));
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - over);
  const end = Math.min(rows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + over);
  return { start: Math.min(start, end), end };
}

/** Fixed column count that fits tiles of at least minTile wide plus gaps. */
export function columnsForWidth(width: number, minTile: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minTile + gap)));
}

export interface VirtualGridOptions<T> {
  /** The scroller: an overflow element, or window for page-level scroll. */
  scrollParent: HTMLElement | Window;
  /** Current fixed column count (recalled on resize, must match the CSS grid). */
  columns: () => number;
  /** Estimated tile height including the row gap; corrected after first paint. */
  estimateRowHeight: () => number;
  /** Extra rows kept above and below the viewport (default 2). */
  overscanRows?: number;
  /** Fills an empty tile node with one item's content. */
  renderTile: (host: HTMLElement, item: T, index: number) => void;
  /** Tile node factory (default: a plain div; callers pass figure). */
  createTile?: () => HTMLElement;
}

export class VirtualGrid<T> {
  private topPad: HTMLElement;
  private bottomPad: HTMLElement;
  private tiles = new Map<number, HTMLElement>();
  private pool: HTMLElement[] = [];
  private items: T[] = [];
  private columns = 1;
  private rowHeight = 0;
  private range: GridRange = { start: 0, end: 0 };
  private raf = 0;
  private onScroll = (): void => this.schedule();
  private observer: ResizeObserver | null = null;
  private dead = false;

  constructor(
    private anchor: HTMLElement,
    private opts: VirtualGridOptions<T>,
  ) {
    // Spacers are plain grid items spanning every column: the caller's own
    // grid CSS (columns, gaps, tile styles) keeps applying untouched.
    this.topPad = document.createElement('div');
    this.topPad.className = 'vg-pad';
    this.topPad.setAttribute('aria-hidden', 'true');
    this.bottomPad = document.createElement('div');
    this.bottomPad.className = 'vg-pad';
    this.bottomPad.setAttribute('aria-hidden', 'true');
    anchor.append(this.topPad, this.bottomPad);
    const parent = opts.scrollParent === window ? window : opts.scrollParent;
    parent.addEventListener('scroll', this.onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.onScroll);
      this.observer.observe(anchor);
    }
  }

  /** New filter result: replaces every tile and scrolls back to the top. */
  setItems(items: T[]): void {
    this.items = items;
    this.clearTiles();
    this.scrollToTop();
    this.layout();
  }

  /** Same items, new data (a favorite toggled): re-renders the window in place. */
  refresh(): void {
    this.clearTiles();
    this.layout();
  }

  destroy(): void {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    const parent = this.opts.scrollParent === window ? window : this.opts.scrollParent;
    parent.removeEventListener('scroll', this.onScroll);
    this.observer?.disconnect();
    this.topPad.remove();
    this.bottomPad.remove();
    for (const host of this.tiles.values()) host.remove();
    this.tiles.clear();
  }

  private clearTiles(): void {
    for (const host of this.tiles.values()) {
      host.remove();
      this.pool.push(host);
    }
    this.tiles.clear();
    this.range = { start: -1, end: -1 };
  }

  private scrollToTop(): void {
    if (this.opts.scrollParent === window) window.scrollTo(0, 0);
    else (this.opts.scrollParent as HTMLElement).scrollTop = 0;
  }

  private schedule(): void {
    if (this.dead || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.layout();
    });
  }

  /** Scroll position measured into the anchor, so element and window scrollers share the math. */
  private viewport(): { scrollTop: number; height: number } {
    const box = this.anchor.getBoundingClientRect();
    if (this.opts.scrollParent === window) {
      return { scrollTop: -box.top, height: window.innerHeight };
    }
    const parent = (this.opts.scrollParent as HTMLElement).getBoundingClientRect();
    return { scrollTop: parent.top - box.top, height: (this.opts.scrollParent as HTMLElement).clientHeight };
  }

  private layout(): void {
    if (this.dead || !this.anchor.isConnected) return;
    this.columns = Math.max(1, this.opts.columns());
    const estimated = this.opts.estimateRowHeight();
    if (estimated > 0) this.rowHeight = estimated;
    if (this.rowHeight <= 0) return;
    const view = this.viewport();
    const totalRows = Math.ceil(this.items.length / this.columns);
    const range = visibleRange(
      this.items.length, this.columns, this.rowHeight,
      view.scrollTop, view.height, this.opts.overscanRows ?? 2,
    );
    if (range.start === this.range.start && range.end === this.range.end) {
      this.placePads(totalRows, range);
      return;
    }
    this.range = range;
    const keep = new Set<number>();
    for (let row = range.start; row < range.end; row++) {
      for (let col = 0; col < this.columns; col++) {
        const index = row * this.columns + col;
        if (index >= this.items.length) break;
        keep.add(index);
        if (!this.tiles.has(index)) this.tiles.set(index, this.takeTile(index));
      }
    }
    for (const [index, host] of this.tiles) {
      if (!keep.has(index)) {
        host.remove();
        this.pool.push(host);
        this.tiles.delete(index);
      }
    }
    // Order tiles after the top spacer, before the bottom one.
    for (const [index, host] of [...this.tiles].sort((a, b) => a[0] - b[0])) {
      void index;
      this.anchor.insertBefore(host, this.bottomPad);
    }
    this.placePads(totalRows, range);
    this.correctRowHeight();
  }

  private takeTile(index: number): HTMLElement {
    const host = this.pool.pop() ?? (this.opts.createTile?.() ?? document.createElement('div'));
    host.replaceChildren();
    this.opts.renderTile(host, this.items[index], index);
    this.anchor.insertBefore(host, this.bottomPad);
    return host;
  }

  private placePads(totalRows: number, range: GridRange): void {
    this.topPad.style.height = `${range.start * this.rowHeight}px`;
    this.bottomPad.style.height = `${Math.max(0, totalRows - range.end) * this.rowHeight}px`;
  }

  /** First real tile sets the row height (its content is sized by CSS, so one read is stable). */
  private correctRowHeight(): void {
    if (this.tiles.size === 0) return;
    const first = [...this.tiles.values()][0];
    const gap = Number.parseFloat(getComputedStyle(this.anchor).rowGap) || 0;
    const measured = first.offsetHeight + gap;
    if (measured > 0 && Math.abs(measured - this.rowHeight) > 1) {
      this.rowHeight = measured;
      const totalRows = Math.ceil(this.items.length / this.columns);
      this.placePads(totalRows, this.range);
    }
  }
}
