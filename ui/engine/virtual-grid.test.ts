// Virtual grid ranges: which rows a scroll position must render.
// Run with `npm run test:engine`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { columnsForWidth, visibleRange } from '../render/virtual-grid.js';

describe('visibleRange', () => {
  it('shows the first rows at the top with overscan below', () => {
    // 100 items, 4 columns = 25 rows of 100 px; viewport 400 px; overscan 2.
    assert.deepEqual(visibleRange(100, 4, 100, 0, 400, 2), { start: 0, end: 6 });
  });

  it('slides the window with the scroll position', () => {
    assert.deepEqual(visibleRange(100, 4, 100, 1000, 400, 2), { start: 8, end: 16 });
  });

  it('reaches the last row at the lowest physical scroll', () => {
    // A scroller clamps scrollTop to content minus viewport: 2500 - 400.
    assert.deepEqual(visibleRange(100, 4, 100, 2100, 400, 2), { start: 19, end: 25 });
  });

  it('renders nothing past the end of the list', () => {
    assert.deepEqual(visibleRange(100, 4, 100, 100000, 400, 2), { start: 25, end: 25 });
  });

  it('clamps a negative scroll to the first row', () => {
    assert.deepEqual(visibleRange(100, 4, 100, -500, 400, 2), { start: 0, end: 1 });
  });

  it('covers a partial last row', () => {
    // 10 items in 3 columns = 4 rows; the window reaches into row 3.
    assert.deepEqual(visibleRange(10, 3, 50, 0, 130, 0), { start: 0, end: 3 });
  });

  it('renders nothing for an empty list or a dead viewport', () => {
    assert.deepEqual(visibleRange(0, 3, 100, 0, 400, 2), { start: 0, end: 0 });
    assert.deepEqual(visibleRange(100, 3, 100, 0, 0, 2), { start: 0, end: 0 });
    assert.deepEqual(visibleRange(100, 0, 100, 0, 400, 2), { start: 0, end: 0 });
    assert.deepEqual(visibleRange(100, 3, 0, 0, 400, 2), { start: 0, end: 0 });
  });

  it('treats a negative overscan as zero', () => {
    assert.deepEqual(visibleRange(100, 4, 100, 1000, 400, -3), { start: 10, end: 14 });
  });

  it('keeps a single row when the list fits on one screen', () => {
    assert.deepEqual(visibleRange(3, 4, 100, 0, 800, 2), { start: 0, end: 1 });
  });
});

describe('columnsForWidth', () => {
  it('fits as many 150 px tiles as the width allows', () => {
    assert.equal(columnsForWidth(800, 150, 14), 4);
    assert.equal(columnsForWidth(300, 150, 14), 1);
  });

  it('never drops below one column', () => {
    assert.equal(columnsForWidth(0, 150, 14), 1);
    assert.equal(columnsForWidth(-50, 150, 14), 1);
  });
});
