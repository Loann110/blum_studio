// SVG workshop: the vector item's allowlist, hex paint and JSON round trip.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EngineError, applyOps, validateDesign } from './index.js';
import { parseVector, serializeVector, VECTOR_MAX_BYTES } from './vector.js';

type Json = Record<string, unknown>;

const CUP = '<svg viewBox="0 0 24 24"><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#4f7a3a"/>'
  + '<path d="M16 10h2a2 2 0 0 1 0 4h-2" fill="none" stroke="#2b2f36" stroke-width="2"/></svg>';

const story = (): Json => ({
  version: 1, name: 'T', format: 'story', background: { kind: 'color', color: '#ffffff' },
  items: [],
});

const vector = (svg: string): Json => ({
  id: 'cup', name: 'cup', type: 'vector', x: 540, y: 960, width: 400, height: 400, props: { svg },
});

function refused(svg: string, why: RegExp): void {
  assert.throws(() => applyOps(story(), [{ op: 'add', item: vector(svg) }]), (e: unknown) => {
    if (!(e instanceof EngineError)) return false;
    assert.match(e.message, why);
    return true;
  });
}

describe('vector: the SVG allowlist', () => {
  it('accepts shapes, paint and transforms', () => {
    const out = applyOps(story(), [{ op: 'add', item: vector(CUP) }]) as { items: Json[] };
    assert.equal(out.items[0].type, 'vector');
    assert.deepEqual(validateDesign(out), []);
  });

  it('refuses scripts, events, links, styles, text and markup tricks', () => {
    refused('<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>', /<script> is not allowed/);
    refused('<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0h1"/></svg>', /'onload' is not allowed/);
    refused('<svg viewBox="0 0 24 24"><a href="https://x.example"><path d="M0 0"/></a></svg>', /<a> is not allowed/);
    refused('<svg viewBox="0 0 24 24"><use href="#x"/></svg>', /<use> is not allowed/);
    refused('<svg viewBox="0 0 24 24"><path d="M0 0" style="fill:red"/></svg>', /'style' is not allowed/);
    refused('<svg viewBox="0 0 24 24"><path d="M0 0" fill="url(#g)"/></svg>', /value of 'fill' is not allowed/);
    refused('<svg viewBox="0 0 24 24"><image width="1" height="1"/></svg>', /<image> is not allowed/);
    refused('<svg viewBox="0 0 24 24">hello</svg>', /only shape elements/);
    refused('<svg viewBox="0 0 24 24"><!-- x --><path d="M0 0"/></svg>', /only shape elements/);
    refused('<svg viewBox="0 0 24 24"><path d="M0 0&#59;"/></svg>', /not allowed/);
    refused('<svg viewBox="0 0 24 24"><path d=\'M0 0\'/></svg>', /only shape elements/);
  });

  it('needs one root svg with a viewBox, properly nested', () => {
    refused('<path d="M0 0"/>', /root <svg>/);
    refused('<svg><path d="M0 0"/></svg>', /viewBox/);
    refused('<svg viewBox="0 0 24 24"><g><path d="M0 0"/></svg>', /never closed|does not close/);
    refused('<svg viewBox="0 0 24 24"></svg><svg viewBox="0 0 1 1"></svg>', /one root <svg>/);
  });

  it('refuses paint that is not a colour and files over the size cap', () => {
    refused('<svg viewBox="0 0 24 24"><path d="M0 0" fill="red"/></svg>', /fill must be none/);
    refused('<svg viewBox="0 0 24 24"><path d="M0 0" fill="$nope"/></svg>', /nope/);
    const big = `<svg viewBox="0 0 24 24"><path d="${'M0 0 '.repeat(VECTOR_MAX_BYTES / 5)}"/></svg>`;
    refused(big, /larger than/);
  });
});

describe('vector: rendering copy and updates', () => {
  it('serializes a clean svg with an xmlns root', () => {
    const svg = serializeVector(parseVector(CUP));
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'));
    assert.ok(svg.includes('fill="#4f7a3a"'));
  });

  it('the clean copy parses again', () => {
    parseVector(serializeVector(parseVector(CUP)));
  });

  it('updates its svg and tint through ops, checked like an add', () => {
    let d = applyOps(story(), [{ op: 'add', item: vector(CUP) }]);
    d = applyOps(d, [{ op: 'update', id: 'cup', patch: { tint: '#ff0000' } }]);
    const props = (d as { items: Array<{ props: Json }> }).items[0].props;
    assert.equal(props.tint, '#ff0000');
    assert.throws(
      () => applyOps(d, [{ op: 'update', id: 'cup', patch: { svg: '<svg viewBox="0 0 1 1"><script/></svg>' } }]),
      EngineError,
    );
    assert.throws(() => applyOps(d, [{ op: 'update', id: 'cup', patch: { sticker: 'blum/pineapple.svg' } }]), EngineError);
  });
});
