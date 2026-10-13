// spec/tests/js/rack-cord-width.mjs
// THE WIDTH A CABLE IS DRAWN AT (#1060). Every cable was drawn 3 mm wide, a
// patch lead to scale, so a power cord (7.1 mm, H05VV-F 3G1.0) was a thin line
// going into a plug stub drawn at the cord's real diameter. A power cord is now
// drawn at its type's outside diameter; every other media keeps WIDTH, so no
// rack that has none is drawn any differently.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../../kit/rack/cable-geometry.js';
import * as R from '../../../kit/rack/route.js';
import * as T from '../../../kit/rack/cable-types.js';

const TYPES = {
  'power-c13': {id: 'power-c13', media: 'power', od_mm: 7.1},
  'power-c19': {id: 'power-c19', media: 'power', od_mm: 7.9},
  cat6: {id: 'cat6', media: 'cat6', od_mm: 6.0},
};
const of = T.diameterLookup(TYPES);

test('a power cord that names no type is drawn at the power-c13 cord', () => {
  assert.equal(G.widthOf({media: 'power'}, of), 7.1);
  assert.equal(G.widthOf({media: 'power'}), 7.1);
});

test('a power cord that names a type is drawn at that type', () => {
  assert.equal(G.widthOf({media: 'power', type: 'power-c19'}, of), 7.9);
  assert.equal(G.widthOf({media: 'power', type: 'nope'}, of), 7.1);
});

test('a power cord is drawn as wide as its plug stub: the untyped figure is the kit fill figure', () => {
  assert.equal(G.widthOf({media: 'power'}), R.DIAMETERS.power);
});

test('every other media keeps the width it had', () => {
  for (const media of ['cat6', 'cat6a', 'os2', 'om3', 'om4', 'om5', 'dac', 'aoc', 'ground', undefined])
    assert.equal(G.widthOf({media, type: media === 'cat6' ? 'cat6' : undefined}, of), G.WIDTH, String(media));
  assert.equal(G.widthOf(null, of), G.WIDTH);
  assert.equal(G.WIDTH, 3);
});

test('a media named like something every object has is not a power cord', () => {
  assert.equal(G.widthOf({media: 'constructor'}, of), G.WIDTH);
});
