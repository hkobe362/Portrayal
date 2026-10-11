// spec/tests/js/rack-half-units.mjs
// HALF-UNIT POSITIONS (docs/rack-file-v4-design.md section 2, build part 2):
// heights in halves, half-open spans, the one box that says where a body is,
// the hole rule, packing, labels, the manager host rule, the commands, and
// what the exports write for a half position (section 2.7).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as F from '../../../kit/rack/fit.js';
import * as G from '../../../kit/rack/managers.js';
import * as Q from '../../../kit/rack/queries.js';
import * as R from '../../../kit/rack/route.js';
import * as S from '../../../kit/rack/solids.js';
import * as X from '../../../kit/rack/export-data.js';
import {apply, COMMANDS} from '../../../kit/rack/commands.js';
import {createRackEditor} from '../../../kit/rack/editor.js';
import {validate} from '../../../kit/rack/validate.js';
import {RU, holesIn} from '../../../kit/rack/rails.js';
import * as OWNER from './route-direct-fixture.mjs';

// The three catalogue devices whose height is not a whole number of units,
// with a 1U switch and a lacer; heights as their manifests state them.
const SIZES = {
  xcu: {ru: 0.5, w: 482.6, h: 22.2, d: 284, model: 'XCU10'},
  'tm-7124s': {ru: 1.5, w: 440, h: 66, d: 300, model: 'TM-7124S'},
  mx104: {ru: 3.5, w: 441, h: 155, d: 241, model: 'MX104'},
  qfx: {ru: 1, w: 440, h: 43.6, d: 520, model: 'QFX5120-48Y'},
  r2: {ru: 2, w: 440, h: 87, d: 700, model: 'R2'},
  mgr: {ru: 1, w: 482.6, h: 44, d: 110, mount: 'rack-face', model: 'FHD-CMP5DR'},
  bracket: {ru: 1, w: 60, h: 44, d: 110, mount: 'rack-face', model: 'Bracket'},
};
const chassisOf = ref => SIZES[ref] || null;
const ctx = {chassisOf};
const rackOf = (heightRU = 42, numbering = 'bottom-up') =>
  ({...M.newRack(), frame: M.normalizeFrame({kind: 'four-post', heightRU, numbering})});
const put = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: '', ru, label: extra.label ?? SIZES[ref]?.model ?? ref, ...extra}).rack;
const run = (rack, cmds) => apply(rack, cmds, ctx);

// ── heights and spans ────────────────────────────────────────────────────

test('unitsOf: the stated height rounded up to the next half, never under 0.5, and 1 when none is stated', () => {
  assert.deepEqual([0.5, 1, 1.5, 3.5, 2, 10].map(ru => F.unitsOf({ru})), [0.5, 1, 1.5, 3.5, 2, 10]);
  assert.deepEqual([0.2, 0.6, 1.2, 0].map(ru => F.unitsOf({ru})), [0.5, 1, 1.5, 0.5]);
  assert.deepEqual([{}, null, undefined, {ru: null}, {ru: 'tall'}].map(F.unitsOf), [1, 1, 1, 1, 1]);
});

test('a span is half-open, and two meet when each starts below the end of the other', () => {
  const it = (ref, ru) => ({ref, ru});
  assert.deepEqual(F.spanOf(it('xcu', 12.5), chassisOf), [12.5, 13]);
  assert.deepEqual(F.spanOf(it('tm-7124s', 1), chassisOf), [1, 2.5]);
  assert.deepEqual(F.spanOf(it('qfx', 2), chassisOf), [2, 3]);
  assert.deepEqual(F.spanOf(it('unknown', 7), chassisOf), [7, 8]);
  assert.equal(F.spansMeet([1, 2.5], [2, 3]), true);
  assert.equal(F.spansMeet([12, 12.5], [12.5, 13]), false);
  assert.equal(F.spansMeet([1, 2], [2, 3]), false);
  assert.equal('span' in F, false, 'the closed whole-unit span is gone');
});

// ── the four rows of section 2.2, each with its right answer ─────────────

test('a 0.5U item at U20 leaves the other half of U20 for a second one', () => {
  const r = put(rackOf(), 'xcu', 20, {label: 'ODF A'});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 20.5, face: 'front'}, chassisOf), {ok: true});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 20, face: 'front'}, chassisOf), {ok: false, reason: 'Taken by ODF A on the front.'});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 19.5, face: 'front'}, chassisOf), {ok: true});
});

test('a 1U item is refused over the top half of a 1.5U item', () => {
  const r = put(rackOf(), 'tm-7124s', 1, {label: 'agg-1'});
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 2, face: 'front'}, chassisOf), {ok: false, reason: 'Taken by agg-1 on the front.'});
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 3, face: 'front'}, chassisOf), {ok: true});
  // the half above it is free for what may start on a half
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 2.5, face: 'front'}, chassisOf), {ok: true});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 2, face: 'front'}, chassisOf), {ok: false, reason: 'Taken by agg-1 on the front.'});
});

test('a 1U item is refused over the top half of a 3.5U item', () => {
  const r = put(rackOf(), 'mx104', 10, {label: 'pe-1'});
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 13, face: 'front'}, chassisOf), {ok: false, reason: 'Taken by pe-1 on the front.'});
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 14, face: 'front'}, chassisOf), {ok: true});
  // front and rear share the unit only when the two depths fit between the rails
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 13, face: 'rear'}, chassisOf), {ok: false, reason: '520 mm deep; 499 mm free behind pe-1.'});
});

test('a 3.5U item at U10 and a 1U item at U20, shrunk to 12U: the 1U item lands at U5, and the result parses', () => {
  let r = put(put(rackOf(), 'mx104', 10), 'qfx', 20);
  const s = F.shrinkRack(r, 12, chassisOf);
  assert.deepEqual(s.rack.items.map(i => i.ru), [1, 5], 'half a unit stays free under the 1U item');
  assert.deepEqual([s.moved, s.removed], [['i1', 'i2'], []]);
  const doc = {...M.newDoc(), racks: [s.rack]};
  assert.doesNotThrow(() => M.parseDoc(M.serialize(doc)));
  assert.deepEqual(M.parseDoc(M.serialize(doc)).racks[0].items.map(i => i.ru), [1, 5]);
  // and every survivor still fits where it landed
  for (const it of s.rack.items) assert.deepEqual(F.fits(s.rack, it, chassisOf, {ignoreId: it.id}), {ok: true}, it.id);
});

// ── packing ──────────────────────────────────────────────────────────────

test('what a shrink drops is judged by the packed top edge, not by the heights added up', () => {
  let r = rackOf();
  for (const [ref, ru] of [['mx104', 5], ['qfx', 12], ['mx104', 20], ['qfx', 30]]) r = put(r, ref, ru);
  // 3.5 + 1 + 3.5 + 1 is 9U, and packs to 10U: 1 to 4.5, 5 to 6, 6 to 9.5, 10 to 11
  const ten = F.shrinkRack(r, 10, chassisOf);
  assert.deepEqual(ten.rack.items.map(i => i.ru), [1, 5, 6, 10]);
  assert.deepEqual(ten.removed, []);
  assert.equal(Math.max(...ten.rack.items.map(i => F.spanOf(i, chassisOf)[1])), 11, 'the packed top edge');
  // at 9U the lowest goes, and the other three pack to 6U
  const nine = F.shrinkRack(r, 9, chassisOf);
  assert.deepEqual(nine.removed.map(i => i.id), ['i1']);
  assert.deepEqual(nine.rack.items.map(i => [i.id, i.ru]), [['i2', 1], ['i3', 2], ['i4', 6]]);
  assert.equal(Math.max(...nine.rack.items.map(i => F.spanOf(i, chassisOf)[1])), 7);
  // the limit: a packed top exactly half a unit over the rack does not fit.
  // 3.5U and 1.5U pack to a top edge of 6 (5U of rack); with a panel on top, 6.5
  let half = put(put(put(rackOf(), 'mx104', 10), 'tm-7124s', 20), 'xcu', 30);
  const fits5 = F.shrinkRack(half, 5, chassisOf);
  assert.deepEqual([fits5.rack.items.map(i => i.ru), fits5.removed.map(i => i.id)], [[1, 2.5], ['i1']],
    'a top edge of 6.5 is half a unit over 5U, so the lowest goes');
  const fits6 = F.shrinkRack(half, 6, chassisOf);
  assert.deepEqual([fits6.rack.items.map(i => i.ru), fits6.removed], [[1, 4.5, 6], []], 'a top edge of 6.5 is inside 6U');
  half = {...half, items: half.items.slice(0, 2)};
  assert.deepEqual(F.shrinkRack(half, 5, chassisOf).removed, [], 'a top edge of 6 is the top of 5U');
  assert.deepEqual(F.shrinkRack(half, 4, chassisOf).removed.map(i => i.id), ['i1'], 'and a whole unit over 4U');
  for (const s of [ten, nine]) assert.doesNotThrow(() => M.parseDoc(M.serialize({...M.newDoc(), racks: [s.rack]})));
});

test('a cluster keeps its parity: two half-unit panels move together, and a whole-unit device never lands on a half', () => {
  // two panels in U30, a 1.5U item at U20 with a 1U item on the rear of U21
  let r = put(put(rackOf(), 'xcu', 30), 'xcu', 30.5);
  r = put(put(r, 'tm-7124s', 20), 'xcu', 21.5, {face: 'rear'});
  r = put(r, 'qfx', 35);
  const s = F.shrinkRack(r, 6, chassisOf);
  // 1.5U + its rear half-unit panel (20 to 22) pack to 1; the two panels, a
  // cluster each, to 3 and 3.5; the 1U item starts on a whole unit at 4
  assert.deepEqual(s.rack.items.map(i => i.ru), [3, 3.5, 1, 2.5, 4]);
  assert.deepEqual(s.removed, []);
  // a panel alone on a half packs to the cursor, half or whole
  const lone = F.shrinkRack(put(put(rackOf(), 'tm-7124s', 20), 'xcu', 30.5), 4, chassisOf);
  assert.deepEqual(lone.rack.items.map(i => i.ru), [1, 2.5]);
  // a rack-face part holds its cluster to whole shifts too
  let m = put(put(rackOf(), 'tm-7124s', 20), 'xcu', 30.5, {label: 'ODF'});
  m = put(m, 'mgr', 30, {on: 'i2', unit: 1});
  const withMgr = F.shrinkRack(m, 4, chassisOf);
  assert.deepEqual(withMgr.rack.items.map(i => i.ru), [1, 3.5, 3], 'the panel and its manager keep U and half');
  assert.deepEqual(F.shrinkRack(rackOf(), 10, chassisOf).rack.frame.heightRU, 10);
});

// ── the box ──────────────────────────────────────────────────────────────

test('two 0.5U items in one unit do not overlap, and their boxes tile the unit', () => {
  const r = put(put(rackOf(), 'xcu', 12, {label: 'ODF A'}), 'xcu', 12.5, {label: 'ODF B'});
  const [a, b] = r.items.map(i => F.itemBox(r, i, chassisOf));
  assert.deepEqual([a.lo, a.hi, b.lo, b.hi], [11 * RU, 11.5 * RU, 11.5 * RU, 12 * RU]);
  assert.ok(a.y1 <= b.y0, `the lower ends at ${a.y1}, the upper starts at ${b.y0}`);
  // each 22.2 mm body is centred in its 22.225 mm half
  for (const box of [a, b]) {
    assert.equal(box.h, 22.2);
    assert.ok(Math.abs((box.y0 - box.lo) - (box.hi - box.y1)) < 1e-9 && box.y0 >= box.lo && box.y1 <= box.hi);
  }
  // the solids stand where the boxes say
  const solids = S.solidsOf(r, {chassisOf});
  assert.deepEqual(solids.map(s => [s.item, s.box.y0, s.box.y1]), [['i1', a.y0, a.y1], ['i2', b.y0, b.y1]]);
  assert.deepEqual(F.itemsWithU(r, chassisOf).map(i => i.u), [0.5, 0.5]);
});

test('itemBox centres a body in its span, shorter or taller, and falls back to the span with no height', () => {
  const r = rackOf();
  const box = (c, ru) => F.itemBox(r, {ref: 'x', ru}, () => c);
  // 43.6 in a 44.45 unit: 0.425 above the bottom, where 3D stood it on the bottom before
  const short = box({ru: 1, h: 43.6}, 3);
  assert.ok(Math.abs(short.y0 - (2 * RU + 0.425)) < 1e-9 && Math.abs(short.y1 - (3 * RU - 0.425)) < 1e-9);
  // a duct taller than its span overhangs both edges equally
  const tall = box({ru: 1, h: 57.8}, 3);
  assert.ok(Math.abs((tall.lo - tall.y0) - 6.675) < 1e-9 && Math.abs((tall.y1 - tall.hi) - 6.675) < 1e-9);
  assert.deepEqual(box({ru: 2}, 1), {y0: 0, y1: 2 * RU, h: 2 * RU, lo: 0, hi: 2 * RU});
  assert.deepEqual(box(null, 1), {y0: 0, y1: RU, h: RU, lo: 0, hi: RU});
});

// ── the hole rule ────────────────────────────────────────────────────────

test('a whole-unit device is refused at a half position, with its sentence', () => {
  const r = rackOf();
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 12.5, face: 'front'}, chassisOf), {ok: false, reason:
    'QFX5120-48Y is 1U; its ears meet the rail holes only at a whole unit, and U12.5 is a half unit.'});
  assert.equal(F.fits(r, {ref: 'r2', ru: 3.5, face: 'rear'}, chassisOf).reason,
    'R2 is 2U; its ears meet the rail holes only at a whole unit, and U3.5 is a half unit.');
  // a top-down frame names the half the way it counts
  assert.equal(F.fits(rackOf(42, 'top-down'), {ref: 'qfx', ru: 12.5, face: 'front'}, chassisOf).reason,
    'QFX5120-48Y is 1U; its ears meet the rail holes only at a whole unit, and U30.5 is a half unit.');
  // a height that is not whole may start on either
  for (const [ref, ru] of [['xcu', 12], ['xcu', 12.5], ['tm-7124s', 12], ['tm-7124s', 12.5], ['mx104', 12.5]])
    assert.deepEqual(F.fits(r, {ref, ru, face: 'front'}, chassisOf), {ok: true}, `${ref} at ${ru}`);
  // anything that is not a step of 0.5 is no position
  for (const ru of [12.25, NaN, '12', undefined])
    assert.deepEqual(F.fits(r, {ref: 'xcu', ru, face: 'front'}, chassisOf), {ok: false, reason: 'A position is a whole unit or a half unit, counted from 1.'});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 0.5, face: 'front'}, chassisOf), {ok: false, reason: 'Below U1.'});
});

test('the top of the rack: an item fits when its top edge is the top of the last unit', () => {
  const r = rackOf(42);
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 42.5, face: 'front'}, chassisOf), {ok: true});
  assert.deepEqual(F.fits(r, {ref: 'xcu', ru: 43, face: 'front'}, chassisOf), {ok: false, reason: '0.5U needed; 0U free from U43 to the top.'});
  assert.deepEqual(F.fits(r, {ref: 'tm-7124s', ru: 41.5, face: 'front'}, chassisOf), {ok: true});
  assert.deepEqual(F.fits(r, {ref: 'tm-7124s', ru: 42, face: 'front'}, chassisOf), {ok: false, reason: '1.5U needed; 1U free from U42 to the top.'});
  assert.deepEqual(F.fits(r, {ref: 'mx104', ru: 39.5, face: 'front'}, chassisOf), {ok: true});
  assert.deepEqual(F.fits(r, {ref: 'qfx', ru: 42, face: 'front'}, chassisOf), {ok: true});
});

test('holesIn: a half unit does not repeat the pattern of a unit', () => {
  assert.deepEqual(holesIn(0, RU), [6.35, 22.22, 38.10]);
  assert.deepEqual(holesIn(0, RU / 2), [6.35], 'the lower half holds one usable hole');
  assert.deepEqual(holesIn(RU / 2, RU), [38.10], 'the upper half holds the other; the middle one is on the line between');
  assert.deepEqual(holesIn(RU, 2.5 * RU).map(y => Math.round((y - RU) * 100) / 100), [6.35, 22.22, 38.1, 50.8]);
  assert.deepEqual(holesIn(10, 10), []);
});

// ── labels ───────────────────────────────────────────────────────────────

test('positionOf and uText on a top-down frame: the lower half is 31.5 and the upper 31', () => {
  const down = M.normalizeFrame({heightRU: 42, numbering: 'top-down'}), up = M.normalizeFrame({heightRU: 42});
  assert.equal(M.positionOf(down, 12, 0.5), 31.5);
  assert.equal(M.positionOf(down, 12.5, 0.5), 31);
  assert.deepEqual([M.uText(down, 12, 0.5), M.uText(down, 12.5, 0.5)], ['U31.5', 'U31']);
  assert.deepEqual([M.positionOf(up, 12, 0.5), M.positionOf(up, 12.5, 0.5)], [12, 12.5]);
  assert.deepEqual([M.uText(up, 12, 0.5), M.uText(up, 12.5, 0.5)], ['U12', 'U12.5']);
  // a whole height reads as it always did: the lowest-numbered unit it covers
  for (const [ru, u] of [[1, 1], [12, 1], [12, 2], [40, 3], [2, 10]]) {
    assert.equal(M.positionOf(up, ru, u), ru);
    assert.equal(M.positionOf(down, ru, u), M.uLabel(down, ru + u - 1), `${u}U at ${ru}`);
  }
  assert.equal(M.positionOf(down, 12), 31, 'one unit when no height is given');
  // a height that is missing in any way counts as one unit, as it always did
  for (const none of [null, 0, undefined, NaN]) {
    assert.equal(M.positionOf(down, 12, none), 31, String(none));
    assert.equal(M.positionOf(up, 12, none), 12, String(none));
    assert.equal(M.uText(down, 12, none), 'U31');
  }
  // a 1.5U item at U13 on the top-down frame: its top edge is 14.5 up
  assert.equal(M.positionOf(down, 13, 1.5), 29.5);
});

test('a span in words: whole units as before, and a half named as a half', () => {
  const up = M.normalizeFrame({heightRU: 42});
  const text = (ref, ru, frame = up) => F.spanText(frame, {ref, ru}, chassisOf);
  assert.deepEqual([text('qfx', 13), text('r2', 13)], ['U13', 'U13-U14']);
  assert.deepEqual([text('xcu', 7), text('xcu', 7.5)], ['the lower half of U7', 'the upper half of U7']);
  assert.equal(text('tm-7124s', 13), 'U13 to the lower half of U14');
  assert.equal(text('tm-7124s', 12.5), 'the upper half of U12 to U13');
  assert.equal(text('mx104', 10), 'U10 to the lower half of U13');
  // lower and upper are as the item hangs, whichever way the frame counts
  const down = M.normalizeFrame({heightRU: 42, numbering: 'top-down'});
  assert.deepEqual([text('r2', 13, down), text('xcu', 12, down), text('xcu', 12.5, down)],
    ['U29-U30', 'the lower half of U31', 'the upper half of U31']);
  assert.equal(text('tm-7124s', 13, down), 'U30 to the lower half of U29');
  const r = put(put(rackOf(), 'xcu', 12, {label: 'ODF A'}), 'xcu', 12.5, {label: 'ODF B'});
  const lines = Q.describe(r, ctx).split('\n');
  assert.ok(lines.some(l => l.startsWith('i2 ODF B the upper half of U12 front')), lines.join(' | '));
  assert.ok(lines.some(l => l.startsWith('i1 ODF A the lower half of U12 front')), lines.join(' | '));
});

test('no two placements read the same: every height of the catalogue at every whole and half position', () => {
  // the heights rack.json can state, in halves, and a few more
  const heights = new Set([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 7, 10, 13, 21]);
  for (const c of Object.values(OWNER.SIZES)) heights.add(F.unitsOf(c));
  for (const c of Object.values(SIZES)) heights.add(F.unitsOf(c));
  for (const numbering of ['bottom-up', 'top-down']) {
    const frame = M.normalizeFrame({heightRU: 24, numbering}), seen = new Map();
    let n = 0;
    for (const u of heights) for (let ru = 1; ru + u <= 25; ru += 0.5) {
      const t = F.unitsText(frame, ru, u), was = seen.get(t);
      assert.equal(was, undefined, `${numbering}: "${t}" is ${u}U at ${ru} and ${was}`);
      seen.set(t, `${u}U at ${ru}`);
      n++;
    }
    assert.ok(n > 400, `${n} placements were read`);
  }
});

// ── queries and commands ─────────────────────────────────────────────────

test('fitsAt and freeUs take and return half positions', () => {
  let r = put(rackOf(6), 'tm-7124s', 1);                      // fills 1 to 2.5
  r = put(r, 'xcu', 5);                                       // the lower half of U5
  assert.deepEqual(Q.freeUs(r, {ref: 'qfx', face: 'front'}, ctx), [3, 4, 6], 'whole positions for a whole-unit device');
  assert.deepEqual(Q.freeUs(r, {ref: 'xcu', face: 'front'}, ctx), [2.5, 3, 3.5, 4, 4.5, 5.5, 6, 6.5]);
  assert.deepEqual(Q.freeUs(r, {ref: 'tm-7124s', face: 'front'}, ctx), [2.5, 3, 3.5, 5.5]);
  assert.deepEqual(Q.fitsAt(r, {ref: 'xcu', face: 'front', ru: 5.5}, ctx), {ok: true});
  assert.equal(Q.fitsAt(r, {ref: 'qfx', face: 'front', ru: 3.5}, ctx).ok, false);
  // a rack-face part is offered whole units only
  assert.deepEqual(Q.freeUs(rackOf(3), {ref: 'mgr', face: 'front'}, ctx), [1, 2, 3]);
});

test('place and move take ru in steps of 0.5; any other step, and a half for a part on the rail face, is refused', () => {
  const placed = run(rackOf(), [{op: 'place', ref: 'xcu', face: 'front', ru: 12, label: 'ODF A'},
                                {op: 'place', ref: 'xcu', face: 'front', ru: 12.5, label: 'ODF B'}]);
  assert.equal(placed.error, undefined);
  assert.equal(placed.summary, 'Placed ODF A at U12 on the front. Placed ODF B at U12.5 on the front.');
  assert.deepEqual(placed.rack.items.map(i => i.ru), [12, 12.5]);
  const moved = run(placed.rack, {op: 'move', id: 'i1', ru: 20.5});
  assert.equal(moved.summary, 'Moved ODF A to U20.5 on the front.');
  assert.deepEqual(run(placed.rack, {op: 'move', id: 'i1', ru: 12.5}), {error: 'Taken by ODF B on the front.', index: 0});
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'xcu', face: 'front', ru: 12.25}),
    {error: 'place needs ru, a number in steps of 0.5 from 1.', index: 0});
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'xcu', face: 'front', ru: 0.5}),
    {error: 'place needs ru, a number in steps of 0.5 from 1.', index: 0});
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'qfx', face: 'front', ru: 12.5}), {index: 0, error:
    'QFX5120-48Y is 1U; its ears meet the rail holes only at a whole unit, and U12.5 is a half unit.'});
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'xcu', face: 'front', ru: 42.5}).rack.items[0].ru, 42.5);
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'xcu', face: 'front', ru: 43}), {error: 'U43 is past the top of this 42U rack.', index: 0});
  // on the rail face
  assert.deepEqual(run(rackOf(), {op: 'side.place', ref: 'bracket', face: 'front', ru: 12.5, side: 'left'}),
    {error: 'side.place needs ru, a whole number from 1.', index: 0});
  assert.deepEqual(run(rackOf(), {op: 'place', ref: 'mgr', face: 'front', ru: 12.5}), {index: 0, error:
    'FHD-CMP5DR bolts to the rail face at a whole unit, and U12.5 is a half unit.'});
  // the schemas an agent reads say so
  const ruOf = op => COMMANDS[op].args.properties.ru;
  for (const op of ['place', 'move']) {
    assert.deepEqual([ruOf(op).type, ruOf(op).minimum, ruOf(op).multipleOf], ['number', 1, 0.5], op);
    assert.deepEqual(validate(COMMANDS[op].args, {ref: 'x', id: 'i1', face: 'front', ru: 12.5}).filter(e => e.keyword !== 'additionalProperties'), []);
  }
  for (const op of ['side.place', 'zerou.place', 'zerou.update']) assert.equal(ruOf(op).type, 'integer', op);
});

// ── a manager and its host ───────────────────────────────────────────────

test('a manager on a host that starts on a half stands on the whole unit the host is in', () => {
  // two panels in U12, and a manager put over U12: its host is the lower one
  let r = put(put(rackOf(), 'xcu', 12, {label: 'ODF A'}), 'xcu', 12.5, {label: 'ODF B'});
  assert.equal(G.hostAt(r, 'front', 12, chassisOf).id, 'i1', 'the lower one when two fill the unit equally');
  assert.equal(G.hostAt(r, 'front', 13, chassisOf), null);
  // whichever the rack lists first: the upper panel placed before the lower
  const upperFirst = put(put(rackOf(), 'xcu', 12.5, {label: 'ODF B'}), 'xcu', 12, {label: 'ODF A'});
  assert.deepEqual(upperFirst.items.map(i => [i.id, i.ru]), [['i1', 12.5], ['i2', 12]]);
  assert.equal(G.hostAt(upperFirst, 'front', 12, chassisOf).id, 'i2');
  // the upper panel alone: it fills half of U12 and is the host there
  let one = put(rackOf(), 'xcu', 12.5, {label: 'ODF B'});
  assert.deepEqual(G.placement(one, {face: 'front', ru: 12}, chassisOf), {face: 'front', ru: 12, on: 'i1', unit: 1});
  const res = run(one, {op: 'place', ref: 'mgr', face: 'front', ru: 12, label: 'CM'});
  assert.equal(res.error, undefined);
  assert.deepEqual(res.rack.items[1], {id: 'i2', ref: 'mgr', cfg: '', label: 'CM', ru: 12, face: 'front', turned: false,
                                       swaps: {}, fields: {}, on: 'i1', unit: 1});
  // the host moves to another half: the manager goes to floor(ru) + unit - 1
  const moved = run(res.rack, {op: 'move', id: 'i1', ru: 20.5});
  assert.deepEqual(moved.rack.items.map(i => i.ru), [20.5, 20]);
  // and on a rack opened out of step, settleManagers puts it back there
  const off = {...moved.rack, items: moved.rack.items.map(i => (i.id === 'i2' ? {...i, ru: 25} : i))};
  const s = G.settleManagers(off, chassisOf);
  assert.equal(s.rack.items[1].ru, 20);
  assert.deepEqual(s.notices, ['CM was out of step with ODF B, so it moved to U20 with it.']);
  assert.deepEqual(G.settleManagers(moved.rack, chassisOf).notices, []);
  // a 1.5U host starting on a half reaches into three units: 12.5 to 14
  let h = put(rackOf(), 'tm-7124s', 12.5, {label: 'agg'});
  assert.equal(F.hostUnits(h.items[0], chassisOf), 2);
  h = put(rackOf(), 'tm-7124s', 12, {label: 'agg'});
  assert.equal(F.hostUnits(h.items[0], chassisOf), 2, 'units 12 and 13');
  assert.equal(F.fits(h, {ref: 'mgr', ru: 13, face: 'front', on: 'i1', unit: 2}, chassisOf).ok, true);
  assert.deepEqual(F.fits(h, {ref: 'mgr', ru: 14, face: 'front', on: 'i1', unit: 3}, chassisOf),
    {ok: false, reason: 'agg is 1.5U; there is no unit 3 on it.'});
  // the device that fills more of a unit is its host: 1.5U at U1 fills half of U2
  let two = put(put(rackOf(), 'tm-7124s', 1, {label: 'agg'}), 'xcu', 2.5, {label: 'ODF'});
  assert.equal(G.hostAt(two, 'front', 2, chassisOf).id, 'i1', 'equal halves: the lower');
  assert.equal(G.hostAt(two, 'front', 1, chassisOf).id, 'i1');
});

// ── what the fit of before allowed ───────────────────────────────────────

test('an overlap the old fit allowed is kept where it is, and named', () => {
  // as a version-3 rack could hold them: a 1U item over the top half of a 1.5U one
  const doc = M.parseDoc({format: 'portrayal-rack', version: 3, id: 'd', racks: [{id: 'r1', name: 'R',
    frame: {kind: 'four-post', heightRU: 42},
    items: [{id: 'i1', ref: 'tm-7124s', cfg: '', label: 'TM-7124S', ru: 1, face: 'front'},
            {id: 'i2', ref: 'qfx', cfg: '', label: 'QFX5120', ru: 2, face: 'front'},
            {id: 'i3', ref: 'mx104', cfg: '', label: 'MX104', ru: 10, face: 'front'},
            {id: 'i4', ref: 'xcu', cfg: '', label: 'ODF', ru: 13, face: 'rear'}],
    zeroU: [], cables: []}]});
  const r = doc.racks[0];
  assert.deepEqual(r.items.map(i => i.ru), [1, 2, 10, 13], 'nothing is moved on load');
  assert.deepEqual(F.overlapNotices(r, chassisOf), ['TM-7124S at U1 is 1.5U and reaches into U2, where QFX5120 is.']);
  // the panel on the rear of U13 fits behind the MX104, so it is no overlap
  assert.equal(F.fits(r, r.items[3], chassisOf, {ignoreId: 'i4'}).ok, true);
  assert.deepEqual(F.overlapNotices(put(put(rackOf(), 'qfx', 1), 'qfx', 2), chassisOf), []);
  // the editor says so when the document is loaded, and moves nothing
  const ed = createRackEditor({doc: M.newDoc(), chassisOf});
  const {findings} = ed.loadDoc(doc);
  assert.deepEqual(findings, [{kind: 'note', text: 'TM-7124S at U1 is 1.5U and reaches into U2, where QFX5120 is.'}]);
  assert.deepEqual(ed.rack().items.map(i => i.ru), [1, 2, 10, 13]);
});

// ── a version-3 rack reads as it did ─────────────────────────────────────
// Every rack fixture file, with the heights of the devices it names: each item
// has the height, the span, the position and the fit it had under the closed
// whole-unit rules of before, written out here as they were.
test('every fixture rack has the heights, positions and fit it had before', () => {
  const sizes = {'asr-9006': {ru: 10, w: 440, h: 444.5, d: 736}, 'as7726-32x': {ru: 1, w: 438, h: 43.2, d: 515},
                 'tm-280': {ru: 1, w: 440, h: 44, d: 200}};
  const of = ref => sizes[ref] || null;
  const dir = new URL('../fixtures/racks/', import.meta.url);
  const files = readdirSync(dir).filter(n => n.endsWith('.json'));
  let read = 0;
  for (const f of files) for (const rack of M.parseDoc(readFileSync(new URL(f, dir), 'utf8')).racks) {
    const withU = F.itemsWithU(rack, of);
    for (const it of rack.items) {
      assert.ok(sizes[it.ref], `${f}: ${it.ref} has a size here`);
      const before = Math.max(1, sizes[it.ref].ru);
      assert.ok(Number.isInteger(it.ru), `${f} ${it.id}`);
      assert.equal(F.unitsOf(of(it.ref)), before, `${f} ${it.id}`);
      assert.equal(withU.find(i => i.id === it.id).u, before);
      assert.deepEqual(F.spanOf(it, of), [it.ru, it.ru + before]);
      const closedTop = it.ru + before - 1;
      assert.equal(M.positionOf(rack.frame, it.ru, before), Math.min(M.uLabel(rack.frame, it.ru), M.uLabel(rack.frame, closedTop)));
      assert.equal(F.spanText(rack.frame, it, of), before === 1 ? `U${it.ru}` : `U${it.ru}-U${closedTop}`);
      assert.equal(F.unitsText(rack.frame, it.ru, before), F.spanText(rack.frame, it, of));
      // where it is, it fits, exactly when no other item shared a whole unit with it under the old rule
      const clash = rack.items.some(o => o.id !== it.id && o.face === it.face
        && it.ru <= o.ru + Math.max(1, sizes[o.ref].ru) - 1 && o.ru <= closedTop);
      assert.equal(F.fits(rack, it, of, {ignoreId: it.id}).ok || clash, true, `${f} ${it.id}`);
      read++;
    }
    assert.deepEqual(F.overlapNotices(rack, of), [], f);
    // shrinking to its own height changes nothing
    assert.deepEqual(F.shrinkRack(rack, rack.frame.heightRU, of).rack.items, rack.items, f);
  }
  assert.ok(files.length >= 5 && read >= 18, `${files.length} files and ${read} items were read`);
});

// ── routes ───────────────────────────────────────────────────────────────

test('pointOf gives the figure of before for every item of one unit or more on the routing fixtures', () => {
  const r = OWNER.rack(), rc = OWNER.ctxOf(r);
  let guides = 0, ports = 0;
  for (const it of r.items) {
    assert.ok(F.unitsOf(OWNER.chassisOf(it.ref)) >= 1);
    assert.equal(F.anchorY(r, it, OWNER.chassisOf), (it.ru - 0.5) * RU, it.id);
    for (const g of rc.guidesOf(it.id)) {
      assert.equal(R.pointOf(r, {item: it.id, via: g.via}, rc).y, (it.ru - 0.5) * RU, `${it.id} ${g.via}`);
      guides++;
    }
  }
  // a port the drawing gives no height for falls back to the same figure
  for (const c of r.cables) for (const e of [c.a, c.b]) {
    const it = r.items.find(i => i.id === e.item);
    assert.equal(R.portPoint(r, e, {...rc, portY: undefined}).y, (it.ru - 0.5) * RU, `${c.id} ${e.path}`);
    ports++;
  }
  assert.ok(guides >= 5 && ports >= 32, `${guides} guides and ${ports} ports were read`);
  // a lane point is the middle of a whole unit, as before
  assert.equal(R.pointOf(r, {lane: 'left-front', ru: 20}, rc).y, 19.5 * RU);
  // every fixture rack file: each item of a unit or more, by the catalogue the fixtures name
  const dir = new URL('../fixtures/racks/', import.meta.url);
  const sizes = {'asr-9006': {ru: 10, h: 444.5, d: 736}, 'as7726-32x': {ru: 1, h: 43.2, d: 515}, 'tm-280': {ru: 1, h: 44, d: 200}};
  let read = 0;
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json')))
    for (const rack of M.parseDoc(readFileSync(new URL(f, dir), 'utf8')).racks)
      for (const it of rack.items) {
        assert.ok(sizes[it.ref], `${f}: ${it.ref} has a size here`);
        assert.equal(F.anchorY(rack, it, ref => sizes[ref]), (it.ru - 0.5) * RU, `${f} ${it.id}`);
        read++;
      }
  assert.ok(read >= 18, `${read} fixture items were read`);
});

test('an item under one unit is met at the middle of its body', () => {
  const r = put(put(rackOf(), 'xcu', 12), 'xcu', 12.5);
  const [a, b] = r.items.map(i => F.anchorY(r, i, chassisOf));
  assert.ok(Math.abs(a - 11.25 * RU) < 1e-9 && Math.abs(b - 11.75 * RU) < 1e-9, `${a}, ${b}`);
  const rc = {chassisOf, guidesOf: () => [], portX: () => 10};
  assert.equal(R.portPoint(r, {item: 'i2', path: 'p1', view: 'front'}, rc).y, b);
});

test('the neighbours a route looks to for a manager: above first, and what touches', () => {
  const at = (rack, id) => F.neighbours(rack, rack.items.find(i => i.id === id), chassisOf).map(o => o.id);
  // whole units, as before: the 1U device on the top edge, then the one in the unit below
  let r = put(put(put(rackOf(), 'qfx', 11), 'qfx', 12), 'qfx', 13);
  assert.deepEqual(at(r, 'i2'), ['i3', 'i1']);
  r = put(put(put(rackOf(), 'qfx', 11), 'r2', 12), 'qfx', 14);
  assert.deepEqual(at(r, 'i2'), ['i3', 'i1']);
  assert.deepEqual(at(put(put(rackOf(), 'r2', 12), 'r2', 14), 'i1'), [], 'a device over a unit is no neighbour');
  // a half-unit panel in the lower half still finds the 1U device over its unit, as when it counted as a unit
  r = put(put(put(rackOf(), 'qfx', 11), 'xcu', 12), 'qfx', 13);
  assert.deepEqual(at(r, 'i2'), ['i3', 'i1']);
  // two panels in one unit: each sees the other first, then the device past it
  r = put(put(put(put(rackOf(), 'qfx', 11), 'xcu', 12), 'xcu', 12.5), 'qfx', 13);
  assert.deepEqual(at(r, 'i2'), ['i3', 'i4', 'i1']);
  assert.deepEqual(at(r, 'i3'), ['i4', 'i2', 'i1']);
  // a 1.5U item: a 1U device half a unit over its top edge was no neighbour before and is none now
  r = put(put(rackOf(), 'tm-7124s', 1), 'qfx', 3);
  assert.deepEqual(at(r, 'i1'), []);
  // but a half-unit panel directly on its top edge touches it, and is one
  r = put(put(rackOf(), 'tm-7124s', 1), 'xcu', 2.5);
  assert.deepEqual(at(r, 'i1'), ['i2']);
  assert.deepEqual(at(r, 'i2'), ['i1'].filter(() => false), 'a 1.5U item is no device of a unit or less');
  // and one directly under a device on a whole unit
  r = put(put(rackOf(), 'xcu', 11.5), 'qfx', 12);
  assert.deepEqual(at(r, 'i2'), ['i1']);
});

// ── the source scan ──────────────────────────────────────────────────────
// Nothing under kit/rack/ outside fit.js computes a height or a span from `ru`
// (section 2.4). The three shapes that did: a floor of one unit on a height,
// a millimetre height from `ru` and RU, and the closed top unit `ru + u - 1`.
// The parts beside the rack are not on the rails and keep `offsetMm`; the one
// line that turns a unit into an offset is named here, and anything else is a
// fault.
const SHAPES = [
  ['a floor of one unit on a height', /Math\.max\(\s*1\s*,[^;\n]*\b(ru|u)\b/],
  ['a height in mm from ru', /\bru\b[^;\n]*\*\s*RU\b/],
  ['a closed top unit', /\bru\s*\+[^;\n]*-\s*1\b/],
];
const ZERO_U = [
  ['model.js', 'export const zeroUOffset = ru => Math.round((ru - 1) * RU * 100) / 100;'],
];

test('nothing under kit/rack/ outside fit.js computes a height from ru', () => {
  const dir = new URL('../../../kit/rack/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'fit.js');
  assert.ok(files.length >= 20, `only ${files.length} files were scanned`);
  const allowed = new Set(ZERO_U.map(([f, line]) => `${f}|${line}`));
  const found = [], used = new Set();
  let lines = 0;
  for (const f of files)
    for (const raw of readFileSync(new URL(f, dir), 'utf8').split('\n')) {
      const line = raw.trim();
      lines++;
      if (line.startsWith('//')) continue;
      for (const [what, re] of SHAPES) {
        if (!re.test(line)) continue;
        if (allowed.has(`${f}|${line}`)) used.add(`${f}|${line}`);
        else found.push(`${f}: ${what}: ${line}`);
      }
    }
  assert.ok(lines > 5000, `${lines} lines were read`);
  assert.deepEqual(found, []);
  assert.equal(used.size, ZERO_U.length, 'each line named above is still there, or it is taken off the list');
  // the scan sees what it is for: each shape as the kit wrote it before
  const before = ['const u = Math.max(1, c.ru ?? 1), lo = cand.ru, hi = cand.ru + u - 1;',
                  'return placer({cx, w, y0: (it.ru - 1) * RU, h, zFront});',
                  'const topU = it => it.ru + it.u - 1;',
                  'const qty = 4 * railUs.reduce((s, u) => s + Math.max(1, u), 0);',
                  'return {x: g.x, y: (it.ru - 0.5) * RU, z};'];
  for (const line of before) assert.ok(SHAPES.some(([, re]) => re.test(line)), line);
});

// ── the exports (section 2.7) ────────────────────────────────────────────

const TYPE = {manufacturer: 'Fibrain', model: 'XCU10-21IC', isFullDepth: false, guess: false};
const panels = numbering => {
  const r = {...put(put(rackOf(42, numbering), 'xcu', 12, {label: 'ODF A'}), 'xcu', 12.5, {label: 'ODF B'}), name: 'R1'};
  return {rack: r, items: F.itemsWithU(r, chassisOf), types: new Map([['i1', TYPE], ['i2', TYPE]])};
};

test('NetBox takes a position in steps of 0.5', () => {
  const rows = n => X.deviceImportRows({...panels(n), target: 'netbox'}).rows.map(r => [r.name, r.position, r.face, r.comments]);
  assert.deepEqual(rows('bottom-up'), [['ODF B', 12.5, 'front', ''], ['ODF A', 12, 'front', '']]);
  assert.deepEqual(rows('top-down'), [['ODF B', 31, 'front', ''], ['ODF A', 31.5, 'front', '']]);
});

test('the cable schedule, draw.io and the hardware count read a half position', () => {
  const {rack, items} = panels('bottom-up');
  const r = {...rack, cables: [{id: 'c1', a: {item: 'i1', path: 'p1', view: 'front'}, b: {item: 'i2', path: 'p2', view: 'front'},
                                media: 'os2', purpose: '', label: '', route: []}]};
  const row = X.cableScheduleRows(r, new Map(), items).rows[0];
  assert.deepEqual([row.a_u, row.b_u], [12, 12.5]);
  assert.deepEqual([X.uOfItem(rack.frame, items[0]), X.uOfItem(rack.frame, rack.items[1], chassisOf)], [12, 12.5]);
  // draw.io counts from 1 at the top: the top of the box, in steps of 0.5
  assert.deepEqual([X.drawioU(42, 12, 0.5), X.drawioU(42, 12.5, 0.5)], [31.5, 31]);
  assert.deepEqual([X.drawioU(42, 12, 1), X.drawioU(42, 41, 2), X.drawioU(42, 1, 10)], [31, 1, 33], 'whole units as before');
  // 4 screws a unit with no floor of one: 2 for a half-unit panel
  const qty = us => X.hardwareRows(rack.frame, us).map(x => x.qty);
  assert.deepEqual(qty([0.5]), [2, 2]);
  assert.deepEqual([qty([1.5]), qty([3.5]), qty([1]), qty([2, 1, 10])], [[6, 6], [14, 14], [4, 4], [52, 52]]);
  assert.deepEqual(qty(items.map(i => i.u)), [4, 4], 'two panels in one unit: 2 each');
  // whatever a caller passes is read as a height in halves, so the count is whole
  assert.deepEqual([qty([0.3]), qty([1.2]), qty([undefined]), qty([0]), qty(['2'])], [[2, 2], [6, 6], [4, 4], [4, 4], [8, 8]]);
});
