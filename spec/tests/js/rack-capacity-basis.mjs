// spec/tests/js/rack-capacity-basis.mjs
// A manager's stated cable count is a count of ONE KIND of cable (#1032).
// The count is compared only with cables of that kind; how full a ring is
// stays the fill's to say; a warning says which manager it is about; the fill
// note cannot be read as a share of the opening; and a cross-face tag names a
// port in words. Every expected number below is worked by hand in its comment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as X from '../../../kit/rack/export-data.js';
import * as C from '../../../kit/rack/cable-rules.js';
import {inspect, freePorts} from '../../../kit/rack/queries.js';

// A lacer panel of five rings, as rack.json states one: thirty cables, and
// the cable its maker counted with. `plain` states a count and no kind.
const LACER = {ru: 1, d: 110, mount: 'rack-face', shell: 'sheet', manufacturer: 'Acme', model: 'LACER-5'};
const SIZES = {sw: {ru: 1, d: 515}, pp: {ru: 1, d: 100},
  lacer: {...LACER, capacity: {count: 30, basis: 'Cat6 24AWG cables, theoretical', media: 'cat6'}},
  plain: {...LACER, capacity: {count: 30, basis: 'an estimate, not stated by its maker'}}};
const chassisOf = ref => SIZES[ref] || null;
const add = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: 'x', ru, label: extra.label ?? ref, ...extra}).rack;
// The rings at their x in the rack, each 32 mm by 29.5 mm: 944 mm2, of which
// the fill limit (40%) is 377.6 mm2.
const RINGS = [-205, -110, 0, 110, 205].map((x, i) => ({via: `guide-${i + 1}`, kind: 'ring', x, aperture: {w: 32, h: 29.5}}));
const ctxOf = rack => ({chassisOf,
  guidesOf: id => {
    const it = rack.items.find(i => i.id === id);
    return it && (it.ref === 'lacer' || it.ref === 'plain') ? RINGS.map(r => ({...r, face: it.face})) : [];
  },
  // a port stands under the ring its cable is to leave by: `left` under ring 1, `right` under ring 5
  portX: end => (end.path.startsWith('left') ? -205 : 205)});
// A switch at U20 with a manager on it, and a panel at U30.
const rackOf = (manager = 'lacer') => {
  let r = add(M.newRack(), 'sw', 20, {label: 'switch'});
  r = add(r, manager, 20, {on: 'i1', unit: 1, label: 'LACER-5'});
  return add(r, 'pp', 30, {label: 'panel'});
};
const cables = (n, media, side, from = 0) => Array.from({length: n}, (_, k) => ({id: `${media || 'x'}-${side}-${from + k}`, media, route: [],
  purpose: '', label: '', a: {item: 'i1', path: `${side}-${from + k}`, view: 'front'}, b: {item: 'i3', path: `${side}-${from + k}`, view: 'front'}}));
const notes = (r, ctx = ctxOf(r)) => X.fillNotes(r, {fill: R.fill(r, ctx), over: R.capacityOver(r, ctx), routes: new Map(), ctx},
  id => r.items.find(i => i.id === id)?.label ?? id);

test('48 fibre cords through a manager that states 30 Cat6: no warning, and no ring is over its fill', () => {
  const r = {...rackOf(), cables: [...cables(24, 'os2', 'left'), ...cables(24, 'os2', 'right')]};
  const ctx = ctxOf(r);
  // 48 distinct cables pass the manager, 24 by ring 1 and 24 by ring 5
  const fill = R.fill(r, ctx);
  assert.deepEqual(fill.map(f => [f.via, f.count]), [['guide-1', 24], ['guide-5', 24]]);
  // a 3 mm cord is 7.069 mm2; 24 are 169.6 mm2, 45% of the 377.6 mm2 limit
  assert.deepEqual(fill.map(f => [f.percent, f.over]), [[45, false], [45, false]]);
  assert.deepEqual(R.capacityOver(r, ctx), []);
  assert.deepEqual(notes(r), []);
});

test('31 Cat6 through a manager that states 30 Cat6 warns, and says the kind', () => {
  const r = {...rackOf(), cables: [...cables(16, 'cat6', 'left'), ...cables(15, 'cat6', 'right')]};
  assert.deepEqual(R.capacityOver(r, ctxOf(r)), [{item: 'i2', count: 31, through: 31, capacity: 30, media: 'cat6'}]);
  // a 6 mm cable is 28.27 mm2: 16 are 452.4 mm2, 120% of the limit, and 15 are 424.1 mm2, 112%
  assert.deepEqual(notes(r), [
    'ring 1 on LACER-5 (U20 front): 16 cables, 120% of its fill limit; the limit is 40% of the opening.',
    'ring 5 on LACER-5 (U20 front): 15 cables, 112% of its fill limit; the limit is 40% of the opening.',
    'LACER-5 (U20 front): 31 Cat 6 copper cables through it, more than the 30 of that kind its maker states.']);
  // exactly the stated count is not over it
  const even = {...r, cables: r.cables.slice(0, 30)};
  assert.deepEqual(R.capacityOver(even, ctxOf(even)), []);
});

test('a mix of kinds: only the cables of the stated kind are counted against the count', () => {
  // 30 Cat6 and 20 fibre cords: fifty cables, thirty of the kind counted
  const under = {...rackOf(), cables: [...cables(30, 'cat6', 'left'), ...cables(20, 'os2', 'right')]};
  assert.deepEqual(R.capacityOver(under, ctxOf(under)), []);
  // 31 Cat6 and 5 fibre cords: the note says how many of how many
  const over = {...rackOf(), cables: [...cables(31, 'cat6', 'left'), ...cables(5, 'os2', 'right')]};
  assert.deepEqual(R.capacityOver(over, ctxOf(over)), [{item: 'i2', count: 31, through: 36, capacity: 30, media: 'cat6'}]);
  assert.equal(notes(over).at(-1),
    'LACER-5 (U20 front): 31 of the 36 cables through it are Cat 6 copper, more than the 30 of that kind its maker states.');
  // a thicker kind is not the stated kind either, nor is a cable of no stated kind
  const other = {...rackOf(), cables: [...cables(31, 'cat6a', 'left'), ...cables(31, '', 'right')]};
  assert.deepEqual(R.capacityOver(other, ctxOf(other)), []);
});

test('a count with no stated kind is never compared', () => {
  const r = {...rackOf('plain'), cables: [...cables(40, 'cat6', 'left'), ...cables(40, 'cat6', 'right')]};
  assert.deepEqual(R.capacityOver(r, ctxOf(r)), []);
  // the rings still say they are full: 40 Cat6 are 1131 mm2, 300% of the limit
  assert.deepEqual(notes(r), [
    'ring 1 on LACER-5 (U20 front): 40 cables, 300% of its fill limit; the limit is 40% of the opening.',
    'ring 5 on LACER-5 (U20 front): 40 cables, 300% of its fill limit; the limit is 40% of the opening.']);
});

test('a ring over its fill is named, with its share of the limit and what the limit is', () => {
  // 60 fibre cords by ring 1: 424.1 mm2, 112% of the 377.6 mm2 limit (45% of the opening)
  const r = {...rackOf(), cables: cables(60, 'os2', 'left')};
  const got = notes(r);
  assert.deepEqual(got, ['ring 1 on LACER-5 (U20 front): 60 cables, 112% of its fill limit; the limit is 40% of the opening.']);
  // the one percentage beside "of the opening" is the limit, never the fill
  assert.deepEqual(got[0].match(/\d+% of the opening/g), ['40% of the opening']);
});

test('two managers of one model give two lines: each says its U and its face', () => {
  let r = rackOf();
  r = add(r, 'lacer', 30, {face: 'rear', label: 'LACER-5'});          // i4, on the rear at U30
  const facts = {fill: [{item: 'i2', via: 'guide-1', count: 60, percent: 112, over: true},
                        {item: 'i4', via: 'guide-1', count: 60, percent: 112, over: true}],
                 over: [{item: 'i2', count: 31, through: 31, capacity: 30, media: 'cat6'},
                        {item: 'i4', count: 31, through: 31, capacity: 30, media: 'cat6'}], routes: new Map()};
  const nameOf = id => r.items.find(i => i.id === id)?.label ?? id;
  const got = X.fillNotes(r, facts, nameOf);
  assert.equal(new Set(got).size, 4, got.join('\n'));
  assert.deepEqual(got.map(t => /\((U\d+ \w+)\)/.exec(t)?.[1]), ['U20 front', 'U30 rear', 'U20 front', 'U30 rear']);
  // on a frame numbered from the top, the U is the one the device import gives it: 42 + 1 - 20
  const down = X.fillNotes({...r, frame: {...r.frame, numbering: 'top-down'}}, facts, nameOf);
  assert.match(down[0], /^ring 1 on LACER-5 \(U23 front\):/);
});

test('a cross-face tag names the port in words, not by its path', () => {
  const r = add(rackOf(), 'pp', 42, {label: 'FHD-1UFCE'});            // i4
  assert.equal(C.tagText(r, {item: 'i4', path: 'bay-1/module/b09', view: 'rear'}), '→ FHD-1UFCE bay 1 b09');
  assert.equal(C.tagText(r, {item: 'i1', path: 'port-63', view: 'front'}), '→ switch port 63');
  // a click on a seated optic or its plug is a click on the port
  assert.equal(C.tagText(r, {item: 'i1', path: 'port-63-occupant/tx', view: 'front'}), '→ switch port 63');
  assert.equal(C.portLabel('slot-2/module/bay-1/module/lc01'), 'slot 2 bay 1 lc01');
});

test('freePorts labels a port the way a tag names it', async () => {
  const r = add(M.newRack(), 'pp', 10, {label: 'panel'});
  const portsOf = async (item, view) => (view === 'rear' ? [{cls: 'port', path: 'bay-1/module/b09'}] : [{cls: 'port', path: 'port-2'}]);
  const got = await freePorts(r, 'i1', {portsOf});
  assert.deepEqual(got.map(p => [p.path, p.label]), [['port-2', 'port 2'], ['bay-1/module/b09', 'bay 1 b09']]);
  assert.equal(C.tagText(r, {item: 'i1', path: got[1].path, view: 'rear'}), `→ panel ${got[1].label}`);
});

test('inspect states the count as its maker does: the count, the basis and the kind', async () => {
  let r = rackOf();
  r = add(r, 'plain', 31, {label: 'LACER-5'});                         // i4
  assert.deepEqual((await inspect(r, 'i2', {chassisOf})).capacity,
    {count: 30, basis: 'Cat6 24AWG cables, theoretical', media: 'cat6'});
  assert.deepEqual((await inspect(r, 'i4', {chassisOf})).capacity,
    {count: 30, basis: 'an estimate, not stated by its maker', media: null});
  assert.ok(!('capacity' in await inspect(r, 'i1', {chassisOf})), 'a device that states no count has none');
});

test('the device schema takes the kinds of cable a rack file names, and no other', () => {
  // a device states the kind in the words a cable's `media` uses, so the two lists are one
  const schema = JSON.parse(readFileSync(new URL('../../schemas/device.schema.json', import.meta.url), 'utf8'));
  const performance = schema.properties.attrs.properties.performance;
  assert.deepEqual(performance.properties['cable-capacity-media'].enum, C.MEDIA);
  assert.deepEqual(performance.dependentRequired['cable-capacity-media'], ['cable-capacity']);
});
