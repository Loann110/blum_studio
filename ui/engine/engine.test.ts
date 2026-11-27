// Golden test: every case in ui/engine/golden/cases.json (recorded from the former
// C++ engine, lint cases updated on purpose since) replays through the engine
// and must give a deep-equal result, or an EngineError with the same message.
// Run with `npm run test:engine`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  EngineError,
  applyOps,
  lintDesign,
  snapMoveAt,
  validateDesign,
} from './index.js';
import { renderDesign } from '../render/render.js';

/* ---- helpers ---- */

type Json = Record<string, unknown>;

interface GoldenCase {
  name: string;
  design: Json;
  ops?: Json[];
  snap?: { id: string; dx: number; dy: number };
  result: { design?: Json; error?: string; snap?: Json };
  validate: string[];
  lint: { findings: unknown[]; score: number };
  result_validate?: string[];
  result_lint?: { findings: unknown[]; score: number };
}

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Order-insensitive deep equality; -0 and +0 compare equal (JSON has one
// zero), like comparing parsed JSON.
function deepEqual(a: unknown, b: unknown, at: string): void {
  if (typeof a === 'number' && typeof b === 'number') {
    assert.ok(
      a === b || (Number.isNaN(a) && Number.isNaN(b)),
      `${at}: ${a} !== ${b}`,
    );
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, `${at}: length ${a.length} !== ${b.length}`);
    for (let i = 0; i < a.length; i++) deepEqual(a[i], b[i], `${at}[${i}]`);
    return;
  }
  if (isRecord(a) && isRecord(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    assert.ok(
      ka.length === kb.length && ka.every((k, i) => k === kb[i]),
      `${at}: keys ${ka} !== ${kb}`,
    );
    for (const k of ka) deepEqual(a[k], b[k], `${at}.${k}`);
    return;
  }
  assert.ok(a === b, `${at}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

function loadCases(): GoldenCase[] {
  const raw = readFileSync('engine/golden/cases.json', 'utf8');
  return JSON.parse(raw) as GoldenCase[];
}

/* ---- cases ---- */

const cases = loadCases();

console.log(`golden cases: ${cases.length}`);

describe('engine golden cases', () => {
  for (const c of cases) {
    it(c.name, () => {
      const before = JSON.stringify(c.design);
      if (c.snap) {
        let out: unknown;
        try {
          out = snapMoveAt(c.design, c.snap.id, c.snap.dx, c.snap.dy);
        } catch (e) {
          assert.ok(
            c.result.error !== undefined,
            `expected snap output, threw ${(e as Error).message}`,
          );
          assert.equal((e as Error).message, c.result.error);
          assert.ok(e instanceof EngineError, 'must throw EngineError');
          return;
        }
        assert.ok(
          c.result.snap !== undefined,
          `expected error ${c.result.error}, got output`,
        );
        deepEqual(out, c.result.snap, 'snap');
      } else {
        let out: Json;
        try {
          out = applyOps(c.design, c.ops ?? []);
        } catch (e) {
          assert.ok(
            c.result.error !== undefined,
            `expected design output, threw ${(e as Error).message}`,
          );
          assert.equal((e as Error).message, c.result.error);
          assert.ok(e instanceof EngineError, 'must throw EngineError');
          deepEqual(validateDesign(c.design), c.validate, 'validate');
          deepEqual(lintDesign(c.design), c.lint, 'lint');
          assert.equal(JSON.stringify(c.design), before, 'input untouched');
          return;
        }
        assert.ok(
          c.result.design !== undefined,
          `expected error ${c.result.error}, got output`,
        );
        deepEqual(out, c.result.design, 'design');
        deepEqual(validateDesign(out), c.result_validate, 'result_validate');
        deepEqual(lintDesign(out), c.result_lint, 'result_lint');
      }
      deepEqual(validateDesign(c.design), c.validate, 'validate');
      deepEqual(lintDesign(c.design), c.lint, 'lint');
      assert.equal(JSON.stringify(c.design), before, 'input untouched');
    });
  }
});

describe('lint: what is really behind a text', () => {
  const text = (id: string, color: string, y = 960): Json => ({
    id, name: id, type: 'text', x: 540, y, width: 800, height: 140,
    props: { text: 'Hello', font: 'Inter', size: 96, weight: 700, color },
  });
  const band = (fill: string): Json => ({
    id: 'band', name: 'band', type: 'shape', x: 540, y: 960, width: 900, height: 400,
    props: { shape: 'rect', fill },
  });
  const story = (items: Json[], background: Json = { kind: 'color', color: '#ffffff' }): Json => ({
    version: 1, name: 'T', format: 'story', background, items,
  });
  const checks = (d: Json): string[] =>
    (lintDesign(d).findings as Array<{ check: string }>).map((f) => f.check);

  it('white text on a black band reads', () => {
    assert.deepEqual(checks(story([band('#000000'), text('t', '#ffffff')])), []);
  });

  it('dark text on a black band is an error', () => {
    assert.ok(checks(story([band('#000000'), text('t', '#222222')])).includes('contrast'));
  });

  it('text on a photo is a note, not an error', () => {
    const photo: Json = {
      id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 1080, height: 1920,
      props: { src: 'https://example.com/a.jpg' },
    };
    const got = checks(story([photo, text('t', '#ffffff')]));
    assert.ok(got.includes('contrast_picture') && !got.includes('contrast') && !got.includes('overlap'));
  });

  it('a huge faint glyph is a watermark note, a small faint text an error', () => {
    const big: Json = { ...text('amp', '#f2f2f2'), height: 900, props: { text: '&', font: 'Inter', size: 600, color: '#f2f2f2' } };
    const found = lintDesign(story([big])).findings as Array<{ check: string; level: string }>;
    assert.deepEqual(found.map((f) => `${f.check}:${f.level}`), ['contrast:info']);
    assert.ok(checks(story([text('t', '#f2f2f2')])).includes('contrast'));
    const small = lintDesign(story([text('t', '#f2f2f2')])).findings as Array<{ level: string }>;
    assert.equal(small[0].level, 'error');
  });

  it('two texts on each other still warn', () => {
    assert.ok(checks(story([text('a', '#111111'), text('b', '#111111')])).includes('overlap'));
  });
});

describe('text gradients', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#000000' }, items: [],
  });
  const grad = { angle: 180, stops: [{ at: 0, color: '#c4c4c4' }, { at: 1, color: '#161616' }] };
  const text = (patch: unknown): Json => ({
    op: 'add',
    item: {
      id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
      props: { text: 'Hi', font: 'Anton', size: 200, color: '#ffffff', ...(patch as Json) },
    },
  });

  it('add accepts a gradient fill', () => {
    const out = applyOps(story(), [text({ gradient: grad })]) as Json;
    const props = (out.items as Json[])[0].props as Json;
    assert.equal((props.gradient as Json).angle, 180);
    assert.equal(((props.gradient as Json).stops as unknown[]).length, 2);
  });

  it('update sets a gradient fill', () => {
    const one = applyOps(story(), [text({})]) as Json;
    const two = applyOps(one, [{ op: 'update', id: 't', patch: { gradient: grad } }]) as Json;
    const props = (two.items as Json[])[0].props as Json;
    assert.equal(((props.gradient as Json).stops as unknown[]).length, 2);
  });

  it('one stop still fails', () => {
    assert.throws(
      () => applyOps(story(), [text({ gradient: { angle: 180, stops: [{ at: 0, color: '#ffffff' }] } })]),
      /at least 2 stops/,
    );
  });
});

describe('paints', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });
  const ring = (fill: unknown): Json => ({
    op: 'add',
    item: {
      id: 'r', name: 'r', type: 'shape', x: 540, y: 960, width: 360, height: 360,
      props: { shape: 'ring', fill, stroke: '#ffffff', strokeWidth: 22 },
    },
  });
  const fillOf = (d: Json): Json => ((d.items as Json[])[0].props as Json).fill as Json;

  it('object fill without stops is a flat color', () => {
    const out = applyOps(story(), [ring({ color: 'rgba(255,255,255,0)' })]);
    assert.equal(fillOf(out), 'rgba(255,255,255,0)');
  });

  it('object fill with stops stays a gradient', () => {
    const out = applyOps(story(), [ring({ angle: 90, stops: [{ at: 0, color: '#000000' }, { at: 1, color: '#ffffff' }] })]);
    assert.equal((fillOf(out).stops as unknown[]).length, 2);
  });

  it('object fill without color or stops still fails', () => {
    assert.throws(() => applyOps(story(), [ring({})]), /bad color/);
  });
});

describe('radial gradients', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#000000' }, items: [],
  });
  const stops = [{ at: 0, color: '#777777' }, { at: 1, color: '#111111' }];

  it('set_background keeps radial and round-trips it', () => {
    const out = applyOps(story(), [
      { op: 'set_background', background: { kind: 'gradient', radial: true, stops } },
    ]) as Json;
    assert.equal((out.background as Json).radial, true);
  });

  it('linear backgrounds stay off radial (old files unchanged)', () => {
    const out = applyOps(story(), [
      { op: 'set_background', background: { kind: 'gradient', angle: 90, stops } },
    ]) as Json;
    assert.ok(!('radial' in (out.background as Json)));
  });

  it('shape fill keeps radial through add and update', () => {
    const shape = (fill: unknown): Json => ({
      op: 'add',
      item: {
        id: 'r', name: 'r', type: 'shape', x: 540, y: 960, width: 360, height: 360,
        props: { shape: 'ellipse', fill },
      },
    });
    const one = applyOps(story(), [shape({ radial: true, stops })]) as Json;
    assert.equal((((one.items as Json[])[0].props as Json).fill as Json).radial, true);
    const two = applyOps(one, [{ op: 'update', id: 'r', patch: { fill: { radial: true, stops } } }]) as Json;
    assert.equal((((two.items as Json[])[0].props as Json).fill as Json).radial, true);
  });

  it('text gradient keeps radial through add and update', () => {
    const text = (patch: unknown): Json => ({
      op: 'add',
      item: {
        id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
        props: { text: 'Hi', font: 'Anton', size: 200, color: '#ffffff', ...(patch as Json) },
      },
    });
    const one = applyOps(story(), [text({ gradient: { radial: true, stops } })]) as Json;
    const first = ((one.items as Json[])[0].props as Json).gradient as Json;
    assert.equal(first.radial, true);
    const two = applyOps(one, [{ op: 'update', id: 't', patch: { gradient: { radial: true, stops } } }]) as Json;
    const second = ((two.items as Json[])[0].props as Json).gradient as Json;
    assert.equal(second.radial, true);
  });
});

describe('torn edges', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#000000' }, items: [],
  });
  const photo = (patch: unknown): Json => ({
    op: 'add',
    item: {
      id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 800, height: 600,
      props: { src: 'media/a.png', mask: 'rect', ...(patch as Json) },
    },
  });
  const rect = (patch: unknown): Json => ({
    op: 'add',
    item: {
      id: 'r', name: 'r', type: 'shape', x: 540, y: 960, width: 800, height: 600,
      props: { shape: 'rect', fill: '#ffffff', ...(patch as Json) },
    },
  });

  it('photo edge rides add and update', () => {
    const one = applyOps(story(), [photo({ edge: 12 })]) as Json;
    assert.equal((((one.items as Json[])[0].props as Json).edge as unknown), 12);
    const two = applyOps(one, [{ op: 'update', id: 'p', patch: { edge: 20 } }]) as Json;
    assert.equal((((two.items as Json[])[0].props as Json).edge as unknown), 20);
  });

  it('shape edge rides add and update', () => {
    const one = applyOps(story(), [rect({ edge: 14 })]) as Json;
    assert.equal((((one.items as Json[])[0].props as Json).edge as unknown), 14);
    const two = applyOps(one, [{ op: 'update', id: 'r', patch: { edge: 8 } }]) as Json;
    assert.equal((((two.items as Json[])[0].props as Json).edge as unknown), 8);
  });

  it('out-of-range edge fails on update', () => {
    const one = applyOps(story(), [photo({})]) as Json;
    assert.throws(
      () => applyOps(one, [{ op: 'update', id: 'p', patch: { edge: 101 } }]),
      /within 0\.\.100/,
    );
  });

  it('straight cuts stay off the JSON (old files unchanged)', () => {
    const out = applyOps(story(), [photo({}), rect({})]) as Json;
    for (const it of out.items as Json[]) {
      assert.ok(!('edge' in ((it as Json).props as Json)));
    }
  });

  it('text edge rides add and update', () => {
    const text = (patch: unknown): Json => ({
      op: 'add',
      item: {
        id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
        props: { text: 'Hi', font: 'Anton', size: 200, color: '#ffffff', ...(patch as Json) },
      },
    });
    const one = applyOps(story(), [text({ edge: 3 })]) as Json;
    assert.equal((((one.items as Json[])[0].props as Json).edge as unknown), 3);
    const two = applyOps(one, [{ op: 'update', id: 't', patch: { edge: 5 } }]) as Json;
    assert.equal((((two.items as Json[])[0].props as Json).edge as unknown), 5);
  });
});

describe('lint: zones are about text', () => {
  const design = (items: Json[]): Json => ({
    version: 1, name: 'T', format: 'story', background: { kind: 'color', color: '#ffffff' }, items,
  });
  const checks = (d: Json): string[] =>
    (lintDesign(d).findings as Array<{ check: string }>).map((f) => f.check);

  it('a full-bleed photo is not a zone problem', () => {
    const photo: Json = { id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 1200, height: 2000, props: { src: 'https://example.com/a.jpg' } };
    assert.deepEqual(checks(design([photo])), []);
  });

  it('a text in the top bar still warns', () => {
    const t: Json = { id: 't', name: 't', type: 'text', x: 540, y: 60, width: 600, height: 80, props: { text: 'Hi', size: 48, color: '#111111' } };
    assert.ok(checks(design([t])).includes('unsafe_zone'));
  });

  it('a hidden group is not checked, and hiding everything leaves an empty design', () => {
    const tiny = (id: string): Json => ({ id, name: id, type: 'text', x: 0, y: 0, width: 300, height: 40, props: { text: '', size: 10, color: '#111111' } });
    const hidden: Json = { id: 'g', name: 'g', type: 'group', x: 540, y: 960, width: 300, height: 100, visible: false, items: [tiny('a'), tiny('b')] };
    assert.deepEqual(checks(design([hidden])), ['empty_design']);
  });
});

describe('lint: overlaps warn only when reading suffers', () => {
  const text = (id: string, color: string, words = 'Hello'): Json => ({
    id, name: id, type: 'text', x: 540, y: 960, width: 800, height: 140,
    props: { text: words, font: 'Inter', size: 96, weight: 700, color },
  });
  const rect = (id: string, w: number, h: number): Json => ({
    id, name: id, type: 'shape', x: 540, y: 960, width: w, height: h,
    props: { shape: 'rect', fill: '#111111' },
  });
  const story = (items: Json[], background: Json = { kind: 'color', color: '#ffffff' }): Json => ({
    version: 1, name: 'T', format: 'story', background, items,
  });
  const checks = (d: Json): string[] =>
    (lintDesign(d).findings as Array<{ check: string }>).map((f) => f.check);

  it('a pale wash over a title is no overlap', () => {
    const got = checks(story([text('wash', '#eeeeee', '&'), text('title', '#111111')]));
    assert.ok(!got.includes('overlap'));
  });

  it('two texts on each other inside a group still overlap', () => {
    const child = (id: string): Json => ({ ...text(id, '#111111'), x: 0, y: 0 });
    const group: Json = { id: 'g', name: 'g', type: 'group', x: 540, y: 960, width: 800, height: 140, items: [child('a'), child('b')] };
    assert.ok(checks(story([group])).includes('overlap'));
  });

  it('a pale wash under a title is no overlap either', () => {
    const got = checks(story([text('title', '#111111'), text('wash', '#eeeeee', '&')]));
    assert.ok(!got.includes('overlap'));
  });

  it('a cut-out photo over a title does not warn', () => {
    const shoe: Json = {
      id: 'shoe', name: 'shoe', type: 'photo', x: 540, y: 960, width: 1000, height: 1000,
      props: { src: 'media/cutout.png', mask: 'rect', fit: 'contain' },
    };
    const found = lintDesign(story([text('title', '#111111'), shoe])).findings as Array<{ check: string; level: string }>;
    // Never a warning (the box overstates a cut-out), only a note to look.
    assert.deepEqual(found.map((f) => `${f.check}:${f.level}`), ['covered:info']);
  });

  it('a vector drawn over a title asks to check it, without lowering the score', () => {
    const logo: Json = {
      id: 'logo', name: 'logo', type: 'vector', x: 540, y: 960, width: 800, height: 140,
      props: { svg: '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#222222"/></svg>' },
    };
    const report = lintDesign(story([text('title', '#111111'), logo])) as { findings: Array<{ check: string }>; score: number };
    assert.deepEqual(report.findings.map((f) => f.check), ['covered']);
    assert.equal(report.score, 100);
  });

  it('a solid band burying half a text still warns', () => {
    assert.ok(checks(story([text('title', '#111111'), rect('band', 400, 200)])).includes('overlap'));
  });

  it('a small solid badge on a big text does not warn', () => {
    assert.deepEqual(checks(story([text('title', '#111111'), rect('badge', 100, 100)])), []);
  });

  it('a paper texture background is measured, not a picture note', () => {
    const paper: Json = { kind: 'image', image: 'textures/paper-white.jpg' };
    assert.deepEqual(checks(story([text('title', '#3c4a2e')], paper)), []);
  });

  it('pale ink on a paper texture is a contrast error', () => {
    const paper: Json = { kind: 'image', image: 'textures/paper-white.jpg' };
    const got = checks(story([text('wash', '#e2e5d6', '&')], paper));
    assert.ok(got.includes('contrast') && !got.includes('contrast_picture'));
  });

  it('notes alone leave the score at 100', () => {
    const empty: Json = {
      id: 'e', name: 'e', type: 'text', x: 540, y: 960, width: 800, height: 140,
      props: { text: '', font: 'Inter', size: 96, weight: 700, color: '#111111' },
    };
    const report = lintDesign(story([empty])) as { findings: unknown[]; score: number };
    assert.deepEqual(checks(story([empty])), ['empty_text']);
    assert.equal(report.score, 100);
  });
});

describe('page formats', () => {
  const blank = (format: string, extra: Json = {}): Json => ({
    version: 1, name: 'T', format, background: { kind: 'color', color: '#ffffff' }, items: [], ...extra,
  });

  it('every table format validates, unknown ones do not', () => {
    for (const id of ['story', 'post', 'square', 'landscape', 'a6', 'a5', 'a4', 'a3', 'a4-landscape', 'letter', 'dl']) {
      assert.deepEqual(validateDesign(blank(id)), [], id);
    }
    assert.equal(validateDesign(blank('banner')).length, 1);
  });

  it('custom needs a size within limits and keeps it in the JSON', () => {
    assert.equal(validateDesign(blank('custom')).length, 1);
    assert.equal(validateDesign(blank('custom', { width: 50, height: 800 })).length, 1);
    assert.deepEqual(validateDesign(blank('custom', { width: 1200, height: 628 })), []);
    const out = applyOps(blank('custom', { width: 1200, height: 628 }), []) as Json;
    assert.equal(out.width, 1200);
    assert.equal(out.height, 628);
    assert.equal('width' in (applyOps(blank('story'), []) as Json), false);
  });

  it('print text minimum and safe zone follow the page', () => {
    const text = (y: number, size: number): Json => ({
      id: 't', name: 't', type: 'text', x: 620, y, width: 900, height: 80, props: { text: 'Hi', size, color: '#111111' },
    });
    const checks = (d: Json): string[] => (lintDesign(d).findings as Array<{ check: string }>).map((f) => f.check);
    assert.deepEqual(checks(blank('a4', { items: [text(600, 24)] })), []);
    assert.ok(checks(blank('a4', { items: [text(600, 16)] })).includes('text_too_small'));
    assert.ok(checks(blank('a4', { items: [text(50, 24)] })).includes('unsafe_zone'));
  });
});

describe('blend', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });
  const shape = (patch: unknown = {}): Json => ({
    op: 'add',
    item: {
      id: 's', name: 's', type: 'shape', x: 540, y: 960, width: 400, height: 400,
      ...(patch as Json), props: { shape: 'rect', fill: '#111111' },
    },
  });

  it('add accepts a blend mode on any item', () => {
    const out = applyOps(story(), [shape({ blend: 'multiply' })]) as Json;
    assert.equal((out.items as Json[])[0].blend, 'multiply');
  });

  it('update sets a blend mode, unset stays off the JSON', () => {
    const one = applyOps(story(), [shape()]) as Json;
    assert.ok(!('blend' in ((one.items as Json[])[0] as Json)));
    const two = applyOps(one, [{ op: 'update', id: 's', patch: { blend: 'screen' } }]) as Json;
    assert.equal((two.items as Json[])[0].blend, 'screen');
  });

  it('an unknown blend mode fails', () => {
    assert.throws(() => applyOps(story(), [shape({ blend: 'fry' })]), /bad blend mode/);
  });
});

describe('outline', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });
  const photo = (props: unknown): Json => ({
    op: 'add',
    item: {
      id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 600, height: 600,
      props: { src: 'https://example.com/a.jpg', ...(props as Json) },
    },
  });

  it('add keeps an outline, off by default', () => {
    const plain = applyOps(story(), [photo({})]) as Json;
    const props = (plain.items as Json[])[0].props as Json;
    assert.ok(!('outlineColor' in props) && !('outlineWidth' in props));
    const out = applyOps(story(), [photo({ outlineColor: '#ffffff', outlineWidth: 12 })]) as Json;
    const got = (out.items as Json[])[0].props as Json;
    assert.equal(got.outlineColor, '#ffffff');
    assert.equal(got.outlineWidth, 12);
  });

  it('a $role outline color is rejected', () => {
    const design = {
      version: 1, name: 'T', format: 'story',
      background: { kind: 'color', color: '#ffffff' },
      items: [{
        id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 600, height: 600,
        props: { src: 'https://example.com/a.jpg', outlineColor: '$ink', outlineWidth: 6 },
      }],
    };
    assert.deepEqual(validateDesign(design), ["item 'p': bad outline color '$ink'"]);
    assert.throws(
      () => applyOps(story(), [photo({ outlineColor: '$ink', outlineWidth: 6 })]),
      /bad outline color/,
    );
  });

  it('update sets an outline, bad values fail', () => {
    const one = applyOps(story(), [photo({})]) as Json;
    const two = applyOps(one, [{ op: 'update', id: 'p', patch: { outlineColor: '#fff', outlineWidth: 8 } }]) as Json;
    assert.equal(((two.items as Json[])[0].props as Json).outlineWidth, 8);
    assert.throws(
      () => applyOps(one, [{ op: 'update', id: 'p', patch: { outlineWidth: 101 } }]),
      /outlineWidth must be within/,
    );
    assert.throws(
      () => applyOps(one, [{ op: 'update', id: 'p', patch: { outlineColor: 'red' } }]),
      /bad color/,
    );
  });
});

describe('photo masks', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });
  const photo = (mask: string): Json => ({
    op: 'add',
    item: {
      id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 600, height: 600,
      props: { src: 'https://example.com/a.jpg', mask },
    },
  });

  it('star, blob and heart masks validate', () => {
    for (const mask of ['star', 'blob', 'heart']) {
      const out = applyOps(story(), [photo(mask)]) as Json;
      assert.equal(((out.items as Json[])[0].props as Json).mask, mask);
    }
  });

  it('an unknown mask still fails', () => {
    assert.throws(() => applyOps(story(), [photo('oval')]), /mask is rect\|circle\|arch\|star\|blob\|heart/);
  });
});

describe('background patterns', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });

  it('zellige, scales and arches validate', () => {
    for (const pattern of ['zellige', 'scales', 'arches']) {
      const out = applyOps(story(), [{
        op: 'set_background',
        background: { kind: 'pattern', pattern, patternColor: '#111111', patternBackground: '#ffffff' },
      }]) as Json;
      assert.equal((out.background as Json).pattern, pattern);
    }
  });

  it('an unknown pattern still fails', () => {
    assert.throws(
      () => applyOps(story(), [{
        op: 'set_background',
        background: { kind: 'pattern', pattern: 'paisley', patternColor: '#111111' },
      }]),
      /background pattern must be/,
    );
  });
});

describe('text photo fill and background grain', () => {
  const story = (background: Json = { kind: 'color', color: '#000000' }): Json => ({
    version: 1, name: 'T', format: 'story', background, items: [],
  });

  it('textFill rides add and update', () => {
    const add = {
      op: 'add',
      item: {
        id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
        props: { text: 'Hi', font: 'Anton', size: 200, color: '#ffffff', textFill: 'media/a.jpg' },
      },
    };
    const one = applyOps(story(), [add]) as Json;
    assert.equal(((one.items as Json[])[0].props as Json).textFill, 'media/a.jpg');
    const two = applyOps(one, [{ op: 'update', id: 't', patch: { textFill: '' } }]) as Json;
    assert.ok(!('textFill' in (((two.items as Json[])[0].props) as Json)));
  });

  it('grain rides set_background and stays within 0..100', () => {
    const out = applyOps(story(), [{ op: 'set_background', background: { kind: 'color', color: '#000000', grain: 40 } }]) as Json;
    assert.equal((out.background as Json).grain, 40);
    assert.throws(
      () => applyOps(story(), [{ op: 'set_background', background: { kind: 'color', color: '#000000', grain: 101 } }]),
      /grain must be within/,
    );
  });
});

describe('removed palette', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });

  it('apply_palette is an unknown op', () => {
    assert.throws(
      () => applyOps(story(), [{ op: 'apply_palette', palette: { ink: '#111111' } }]),
      /unknown op 'apply_palette'/,
    );
  });

  it('a palette key on old files is ignored, and dropped on write', () => {
    const old = { ...story(), palette: { ink: '#111111' } };
    assert.deepEqual(validateDesign(old), []);
    assert.deepEqual(validateDesign(applyOps(old, [])), []);
    assert.ok(!('palette' in (applyOps(old, []) as Json)));
  });
});

describe('safe image sources', () => {
  const story = (): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items: [],
  });
  const photo = (src: string): Json => ({
    op: 'add',
    item: {
      id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 600, height: 600,
      props: { src, mask: 'rect' },
    },
  });
  const text = (textFill: string): Json => ({
    op: 'add',
    item: {
      id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
      props: { text: 'Hi', font: 'Anton', size: 200, color: '#ffffff', textFill },
    },
  });
  const bg = (image: string): Json => ({
    op: 'set_background', background: { kind: 'image', image },
  });

  it('local and escaping sources fail, media, assets and remote pass', () => {
    const bad = ['file:///x.png', '/etc/x.png', 'C:\\x.png', 'media/../../x.png', 'textures/%2e%2e/x.png', 'designs/media/../x.png'];
    for (const src of bad) {
      assert.throws(() => applyOps(story(), [photo(src)]), /bad image src/);
      assert.throws(() => applyOps(story(), [text(src)]), /bad textFill/);
      assert.throws(() => applyOps(story(), [bg(src)]), /bad background image/);
    }
    const seeded = applyOps(story(), [photo('media/a.png'), text('media/a.png')]) as Json;
    for (const src of bad) {
      assert.throws(() => applyOps(seeded, [{ op: 'update', id: 'p', patch: { src } }]), /bad image src/);
      assert.throws(() => applyOps(seeded, [{ op: 'update', id: 't', patch: { textFill: src } }]), /bad textFill/);
    }
    const good = [
      'media/a.png',
      'designs/media/a.png',
      'textures/paper-white.jpg',
      'stickers/blum/pineapple.svg',
      'https://example.com/a.jpg',
      'data:image/png;base64,iVBORw0KGgo=',
    ];
    for (const src of good) {
      const out = applyOps(story(), [photo(src), text(src), bg(src)]) as Json;
      assert.equal(((out.items as Json[])[0].props as Json).src, src);
      assert.equal(((out.items as Json[])[1].props as Json).textFill, src);
      assert.equal((out.background as Json).image, src);
    }
  });
});

describe('css injection', () => {
  const story = (items: Json[] = []): Json => ({
    version: 1, name: 'T', format: 'story',
    background: { kind: 'color', color: '#ffffff' }, items,
  });
  const text = (props: Json, extra: Json = {}): Json => ({
    id: 't', name: 't', type: 'text', x: 540, y: 960, width: 800, height: 200,
    ...extra,
    props: { text: 'Hi', font: 'Inter', size: 96, color: '#111111', ...props },
  });
  const photo = (src: string): Json => ({
    id: 'p', name: 'p', type: 'photo', x: 540, y: 960, width: 600, height: 600,
    props: { src, mask: 'rect' },
  });
  const sticker = (id: string): Json => ({
    id: 's', name: 's', type: 'sticker', x: 540, y: 960, width: 300, height: 300,
    props: { sticker: id },
  });

  it('a colour smuggling a declaration is rejected', () => {
    const bad = 'rgba(0,0,0,1);background:url(x)';
    assert.ok(validateDesign(story([text({ color: bad })])).length > 0);
    assert.throws(() => applyOps(story(), [{ op: 'add', item: text({ color: bad }) }]), /bad text color/);
  });

  it('the rgba grammar is strict', () => {
    for (const color of ['rgba(300,0,0,1)', 'rgba(0,0,0,1.5)', 'rgba(0,0,0)', 'rgba(0,0,0,1) ']) {
      assert.ok(validateDesign(story([text({ color })])).length > 0, color);
    }
    for (const color of ['rgba(0,0,0,0)', 'rgba(255,255,255,1)', 'rgba(47, 124, 246, 0.6)', 'rgba(0,0,0,.5)']) {
      assert.deepEqual(validateDesign(story([text({ color })])), [], color);
    }
  });

  it('a font breaking out of font-family is rejected', () => {
    const bad = "x');background:url(y);a:('";
    assert.ok(validateDesign(story([text({ font: bad })])).length > 0);
    assert.throws(() => applyOps(story(), [{ op: 'add', item: text({ font: bad }) }]), /bad font/);
    const one = applyOps(story(), [{ op: 'add', item: text({}) }]) as Json;
    assert.throws(() => applyOps(one, [{ op: 'update', id: 't', patch: { font: bad } }]), /bad font/);
  });

  it('a src breaking out of url() is rejected', () => {
    const bad = 'media/a.png");x="y';
    assert.ok(validateDesign(story([photo(bad)])).length > 0);
    assert.throws(() => applyOps(story(), [{ op: 'add', item: photo(bad) }]), /bad image src/);
    const one = applyOps(story(), [{ op: 'add', item: photo('media/a.png') }]) as Json;
    assert.throws(() => applyOps(one, [{ op: 'update', id: 'p', patch: { src: bad } }]), /bad image src/);
    // Parentheses and ' are harmless inside url("..."): real URLs and SVG data use them.
    for (const ok of ['https://example.com/File_(1).jpg', "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"]) {
      assert.deepEqual(validateDesign(story([photo(ok)])), [], ok);
    }
  });

  it('a blend smuggling a declaration is rejected', () => {
    const bad = 'multiply;x:1';
    assert.ok(validateDesign(story([text({}, { blend: bad })])).length > 0);
    assert.throws(() => applyOps(story(), [{ op: 'add', item: text({}, { blend: bad }) }]), /bad blend mode/);
  });

  it('a sticker escaping the catalogue is rejected', () => {
    const bad = '../../secret';
    assert.ok(validateDesign(story([sticker(bad)])).length > 0);
    assert.throws(() => applyOps(story(), [{ op: 'add', item: sticker(bad) }]), /bad sticker id/);
    const one = applyOps(story(), [{ op: 'add', item: sticker('blum/pineapple.svg') }]) as Json;
    assert.throws(() => applyOps(one, [{ op: 'update', id: 's', patch: { sticker: bad } }]), /bad sticker id/);
  });

  it('valid colours and fonts still pass', () => {
    for (const color of ['#fff', '#ffffff', 'rgba(47, 124, 246, 0.6)']) {
      assert.deepEqual(validateDesign(story([text({ color })])), [], color);
    }
    for (const font of ['Playfair Display', 'DM Serif Text']) {
      assert.deepEqual(validateDesign(story([text({ font })])), [], font);
    }
  });

  it('a hand-made design renders none of the injected declarations', () => {
    const html = renderDesign(story([
      text({ color: 'rgba(0,0,0,1);background:url(x)', font: "x');background:url(y);a:('" }, { blend: 'multiply;x:1' }),
      photo('media/a.png");x="y'),
      sticker('../../secret'),
      { ...sticker('x");x="y'), id: 's2', name: 's2' },
    ]) as never);
    for (const needle of ['background:url(', 'url(x)', 'url(y)', ';x:1', '../', 'a.png&quot;', 'stickers/x&quot;']) {
      assert.ok(!html.includes(needle), `leaked ${needle}`);
    }
    assert.ok(html.includes("font-family:'Inter'"));
    assert.ok(html.includes('color:#111111'));
  });
});
