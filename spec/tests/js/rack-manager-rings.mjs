// spec/tests/js/rack-manager-rings.mjs
// RACK-MOUNTED HORIZONTAL MANAGERS (#1027): the rings of a manager that is a
// rack device (no `mount: rack-face`) stand at the depth the part's own plan
// gives them (rack.json `rings`, rack_index.py), not on the rail plane with
// an estimated band; and a manager of more than one unit beside a device is
// a manager a route uses, as a one-unit one is.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as F from '../../../kit/rack/fit.js';

// As rack.json carries them for the FS CMH-5DR1U (one ring is enough) and a
// two-unit duct manager that lists guides.
const RING_AT = {z: 42.75, depth: 9.9};
const SIZES = {
  sw: {ru: 1, w: 440, h: 44, d: 300},
  mgr1: {ru: 1, w: 430, h: 44, d: 97.7, guides: {front: ['guide-1', 'guide-2']}, rings: {'guide-1': RING_AT, 'guide-2': RING_AT}},
  // the same part as an older catalogue wrote it: no `rings`
  old1: {ru: 1, w: 430, h: 44, d: 97.7, guides: {front: ['guide-1', 'guide-2']}},
  mgr2: {ru: 2, w: 482, h: 88, d: 100, guides: {front: ['duct']}},
  blank2: {ru: 2, w: 440, h: 88, d: 300},
};
const chassisOf = ref => SIZES[ref] || null;
const add = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: 'x', ru, label: extra.label ?? ref, ...extra}).rack;
const ctxFor = (extra = {}) => ({chassisOf, portX: end => extra.ports?.[`${end.item}|${end.path}`] ?? 0,
  guidesOf: id => ({
    mgr1: [{via: 'guide-1', kind: 'ring', face: 'front', x: -100}, {via: 'guide-2', kind: 'ring', face: 'front', x: 100}],
    old1: [{via: 'guide-1', kind: 'ring', face: 'front', x: -100}, {via: 'guide-2', kind: 'ring', face: 'front', x: 100}],
    mgr2: [{via: 'duct', kind: 'duct', face: 'front', x: 0}],
  })[extra.refs?.[id]] ?? []});
const cable = (a, b) => ({id: 'c1', a: {view: 'front', ...a}, b: {view: 'front', ...b}, route: []});

test('a ring of a rack-mounted manager stands at its depth behind the rail, and not on the rail plane', () => {
  let r = add(M.newRack(), 'mgr1', 10);
  const ctx = ctxFor({refs: {i1: 'mgr1'}});
  const p = R.pointOf(r, {item: 'i1', via: 'guide-1'}, ctx);
  assert.equal(p.z, -42.75);
  // an older catalogue says nothing of it, and the ring stays on the plane
  r = add(M.newRack(), 'old1', 10);
  assert.equal(R.pointOf(r, {item: 'i1', via: 'guide-1'}, ctxFor({refs: {i1: 'old1'}})).z, 0);
});

test('on the rear face the ring stands that far in front of the rear rail', () => {
  const frame = {...M.newRack().frame, kind: 'four-post', railDepth: 740};
  let r = {...M.newRack(), frame: M.normalizeFrame(frame)};
  r = add(r, 'mgr1', 10, {face: 'rear'});
  const ctx = ctxFor({refs: {i1: 'mgr1'}});
  const rear = {...ctx, guidesOf: id => ctx.guidesOf(id).map(g => ({...g, face: 'rear'}))};
  assert.equal(R.pointOf(r, {item: 'i1', via: 'guide-1'}, rear).z, -740 + 42.75);
  // a ring the page puts on the other face of the device is not moved
  assert.equal(R.pointOf(r, {item: 'i1', via: 'guide-1'}, ctx).z, -740 + 97.7);
});

test('the band of a ring is the part\'s, not the 10 mm estimate', () => {
  const r = add(M.newRack(), 'mgr1', 10);
  const ctx = ctxFor({refs: {i1: 'mgr1'}});
  const marks = R.ringMarks(r, {id: 'c', a: {}, b: {}, route: [{item: 'i1', via: 'guide-1'}], routeEdited: true}, ctx);
  assert.equal(marks[0].depth, 9.9);
  const old = add(M.newRack(), 'old1', 10);
  const m2 = R.ringMarks(old, {id: 'c', a: {}, b: {}, route: [{item: 'i1', via: 'guide-1'}], routeEdited: true}, ctxFor({refs: {i1: 'old1'}}));
  assert.equal(m2[0].depth, R.RING_DEPTH);
});

test('a one-unit and a two-unit manager above a switch are each the manager of a lead out of it', () => {
  for (const [ref, via] of [['mgr1', 'guide-1'], ['mgr2', 'duct']]) {
    let r = add(M.newRack(), 'sw', 10);
    r = add(r, ref, 11);
    r = add(r, 'sw', 20);
    const ctx = ctxFor({refs: {i2: ref}, ports: {'i1|p': -100, 'i3|q': -100}});
    const route = R.autoRoute(r, cable({item: 'i1', path: 'p'}, {item: 'i3', path: 'q'}), ctx);
    assert.equal(route[0]?.item, 'i2', `${ref}: the lead leaves through the manager`);
    assert.equal(route[0]?.via, via);
  }
});

test('a two-unit manager below a switch is the manager too, and a two-unit device with no guides is not', () => {
  let r = add(M.newRack(), 'mgr2', 8);
  r = add(r, 'sw', 10);
  r = add(r, 'sw', 20);
  const ctx = ctxFor({refs: {i1: 'mgr2'}, ports: {'i2|p': -100, 'i3|q': -100}});
  const route = R.autoRoute(r, cable({item: 'i2', path: 'p'}, {item: 'i3', path: 'q'}), ctx);
  assert.equal(route[0]?.item, 'i1');
  let b = add(M.newRack(), 'blank2', 8);
  b = add(b, 'sw', 10);
  assert.deepEqual(F.neighbours(b, b.items[1], chassisOf).map(o => o.ref), [],
    'a two-unit device that is not a manager is not a neighbour');
});

test('a manager taller than a unit is a neighbour above and below, nearest first', () => {
  let r = add(M.newRack(), 'mgr2', 8);
  r = add(r, 'sw', 10);
  r = add(r, 'mgr2', 11);
  assert.deepEqual(F.neighbours(r, r.items[1], chassisOf).map(o => o.id), ['i3', 'i1']);
});
