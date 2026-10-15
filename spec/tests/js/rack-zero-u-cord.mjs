// spec/tests/js/rack-zero-u-cord.mjs
// A POWER CORD TO AN OUTLET OF A VERTICAL PDU (P-0037). The cord arrives at the
// outlet's own height from beside the PDU, from the space between the rail and
// it, and not over the top; the crossing finding does not count the body of the
// part the cord ends on, at that end; and the rack offers a lane there
// (`left-rear-inner`) for a route written by hand.
//
// THE RACK is the reproduction of the report (a four-post 42U frame, railDepth
// 900, usableDepth 1100, a UfiSpace S9601-102XC (cfg ac) at U41 set back 25 and
// two Eaton EVMA8365X PDUs at left-rear and right-rear), with one cord from the
// switch's psu-0 inlet to PDU-A's outlet F42 and no route. The parts are the
// library's, to the numbers their drawings give: the switch 436 x 87.7 x 609.6,
// its psu-0 inlet in the rear view at x 392.5 + 14 of 436 (seen from behind, so
// the rack's left) and y 15.5 + 10 of 87.7 from the top; the PDU 52 x 1829 x 65,
// its outlets F42, F40 and F38 at y 26.77, 77.57 and 128.37 from its top.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import {apply} from '../../../kit/rack/commands.js';
import {RU, OPENING, RAIL_W} from '../../../kit/rack/rails.js';
import {compByRef, SLOTS, SIZES, C14, C20} from './power-ends-fixture.mjs';

const REPRO = {
  id: 'r1',
  frame: {kind: 'four-post', heightRU: 42, numbering: 'bottom-up', holes: {style: 'square', thread: null}, railDepth: 900, usableDepth: 1100, ref: null},
  items: [{id: 'i2', ref: 's9601-102xc', cfg: 'ac', ru: 41, face: 'front', turned: false, setback: 25, label: 'Device at U41'}],
  zeroU: [
    {id: 'z3', ref: 'evma8365x', cfg: 'base', label: 'PDU-A (feed A)', at: 'left-rear', offsetMm: 0},
    {id: 'z4', ref: 'evma8365x', cfg: 'base', label: 'PDU-B (feed B)', at: 'right-rear', offsetMm: 0}],
  cables: [{id: 'c1', a: {item: 'i2', path: 'psu-0/module/inlet', view: 'rear'}, b: {item: 'z3', path: 'outlet-f42', view: 'front'},
            media: 'power', purpose: '', label: '', route: [], routeEdited: false, length: {value: 1, unit: 'm', source: 'entered'}}],
  bundles: [],
};

const outlet = (id, y) => ({id, kind: 'connector', interface: 'iec-c13', media: null, bores: [], accepts: [C14, C20], default: null, at: [9.1, y - 11], mate: [24.3, y]});
const OUTLETS = {'outlet-f42': 26.77, 'outlet-f40': 77.57, 'outlet-f38': 128.37};
const PDU = {default: 'base', 'pdu-class': 'managed', bays: {front: [], rear: []},
  cages: {front: Object.entries(OUTLETS).map(([id, y]) => outlet(id, y)), rear: []},
  configs: [{name: 'base', description: '', airflow: 'passive', bays: {}, occupants: {}, names: {}}]};
const SIZES2 = {...SIZES,
  's9601-102xc': {manufacturer: 'UfiSpace', model: 'S9601-102XC', kind: 'router', ru: 2, w: 436, h: 87.7, d: 609.6, default: 'dc', configs: ['ac', 'dc']},
  'evma8365x': {manufacturer: 'Eaton', model: 'EVMA8365X', mount: 'rack-side', kind: 'pdu', ru: 41, h: 1829, w: 52, d: 65, default: 'base', configs: ['base']}};
const SLOTS2 = {...SLOTS, 'evma8365x': PDU};
const PSU_X = 218 - (392.5 + 14);                  // from the rack's centre line, right as seen from the front
const PSU_Y = 40 * RU + 87.7 - (15.5 + 10);        // up from the floor of U1
const ctx = {chassisOf: ref => SIZES2[ref] ?? null, slotsOf: ref => SLOTS2[ref] ?? null, compByRef,
  guidesOf: () => [], portX: e => (e.item === 'i2' ? PSU_X : null), portY: e => (e.item === 'i2' ? PSU_Y : undefined)};

const cordTo = (part, path, extra = {}) => {
  const c = {...REPRO.cables[0], b: {item: part, path, view: 'front'}, ...extra};
  return {rack: {...REPRO, cables: [c]}, c};
};
const at = (p, k = 1) => [p.x, p.y, p.z].map(v => Math.round(v * k) / k);
const bodies = (rack, c) => R.routePath(rack, c, ctx).crossings.map(x => x.item);

for (const [name, y] of Object.entries(OUTLETS)) {
  test(`the cord to ${name} with no route comes in from beside the PDU, at the outlet's height, and stays in the rack`, () => {
    const {rack, c} = cordTo('z3', name);
    assert.deepEqual(R.ownRoute(rack, c, ctx).waypoints, []);
    const path = R.routePath(rack, c, ctx), pts = path.points;
    const top = rack.frame.heightRU * RU, out = pts.at(-1), reach = pts.at(-2), before = pts.at(-3);
    // the outlet is where the PDU's drawing puts it, 1829 up from the floor less its distance from the top
    assert.ok(Math.abs(out.y - (1829 - y)) < 1e-6, `${out.y}`);
    // never over the top, and inside the depth of the rack
    assert.ok(pts.every(p => p.y < top - 1), pts.map(p => at(p)).join(' '));
    assert.ok(pts.every(p => p.z > -rack.frame.usableDepth), pts.map(p => at(p)).join(' '));
    // the last turn is made level with the outlet, on the rails' side of the PDU: the leg into the plug's reach
    // point runs along x, outward
    assert.ok(Math.abs(before.y - out.y) < 1e-6 && Math.abs(before.z - reach.z) < 1e-6, `${at(before)} ${at(reach)}`);
    assert.ok(before.x > reach.x + 40, `${at(before)} ${at(reach)}`);
    // no body crossed, the PDU's own included, and no corner short of room
    assert.deepEqual(path.crossings, []);
    assert.deepEqual(R.bodyFindings(rack, ctx), []);
    assert.deepEqual(path.bends, []);
    // and the length follows: the straight run and its bends, not a climb to the top and down again
    const m = R.routedLength(rack, c, ctx);
    assert.ok(m.need > 0.55 && m.need < 0.66, `${m.need}`);
  });
}

test('the cord to PDU-B comes in the same way from the other side', () => {
  const {rack, c} = cordTo('z4', 'outlet-f42');
  const flipped = {...ctx, portX: e => (e.item === 'i2' ? -PSU_X : null)};
  const path = R.routePath(rack, c, flipped), pts = path.points;
  assert.deepEqual(path.crossings, []);
  assert.deepEqual(path.bends, []);
  assert.ok(pts.every(p => p.y < rack.frame.heightRU * RU - 1));
  assert.ok(pts.at(-3).x < pts.at(-2).x - 40, `${at(pts.at(-3))} ${at(pts.at(-2))}`);
});

test('the cord no longer crosses a body at its own outlet, and still crosses the body of any other part', () => {
  const {rack, c} = cordTo('z3', 'outlet-f42');
  assert.deepEqual(bodies(rack, c), []);
  // a second PDU standing where the first does (two parts fixed to one upright): the plug leg runs into it
  const doubled = {...rack, zeroU: [...rack.zeroU, {id: 'z5', ref: 'evma8365x', cfg: 'base', label: 'PDU-C', at: 'left-rear', offsetMm: 0}]};
  const hit = R.routePath(doubled, c, ctx).crossings;
  assert.deepEqual([...new Set(hit.map(x => x.item))], ['z5']);
  assert.match(R.bodyFindings(doubled, ctx)[0].text, /passes through z5/);
  // and a cord on a part that is not its own is not spared that part: the same cord, ending on PDU-C, crosses PDU-A
  const other = {...c, b: {item: 'z5', path: 'outlet-f42', view: 'front'}};
  assert.deepEqual([...new Set(R.routePath({...doubled, cables: [other]}, other, ctx).crossings.map(x => x.item))], ['z3']);
});

test('the rack offers the lane between a rail and a part beside it, and a route by hand through it does not overshoot the outlet', () => {
  const {rack, c} = cordTo('z3', 'outlet-f42');
  // the four-post offers one for each of its lanes; a two-post, none
  assert.deepEqual(R.lanesOf(rack.frame), ['left-front', 'right-front', 'left-rear', 'right-rear']);
  assert.deepEqual(R.innerLanesOf(rack.frame), ['left-front-inner', 'right-front-inner', 'left-rear-inner', 'right-rear-inner']);
  assert.deepEqual(R.waypointLanesOf(rack.frame).slice(4), R.innerLanesOf(rack.frame));
  assert.deepEqual(R.innerLanesOf({kind: 'two-post'}), []);
  // it is named as a lane is: the command takes it, and refuses a name it does not have, listing it
  const done = apply(rack, {op: 'cable.route', id: 'c1', route: [{lane: 'left-rear-inner', ru: 41}]}, ctx);
  assert.equal(done.error, undefined);
  assert.deepEqual(done.rack.cables[0].route, [{lane: 'left-rear-inner', ru: 41}]);
  assert.match(apply(rack, {op: 'cable.route', id: 'c1', route: [{lane: 'left-rear-in', ru: 41}]}, ctx).error, /no gutter called left-rear-in\. This rack has: .*left-rear-inner/);
  // it stands on the upright's centre line, in the rail plane, between the rail's outer face and the opening
  const p = R.pointOf(rack, {lane: 'left-rear-inner', ru: 41}, ctx);
  const x = -(OPENING / 2 + RAIL_W / 2);
  assert.ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - (40 * RU + RU / 2)) < 1e-6 && p.z === -900, JSON.stringify(p));
  // the cord by hand through it, and through the gutter lane beyond the PDU, to the same outlet
  const byHand = lane => {
    const hc = {...c, route: [{lane, ru: 41}], routeEdited: true}, hr = {...rack, cables: [hc]};
    return {path: R.routePath(hr, hc, ctx), need: R.routedLength(hr, hc, ctx).need};
  };
  const inner = byHand('left-rear-inner'), beyond = byHand('left-rear');
  assert.deepEqual(inner.path.crossings, []);
  // the lane beyond the PDU takes the cord out past it and back; this one does not: the cord stays inboard of
  // the PDU's outer face until its last two points, the reach and the outlet, and is the shorter by the trip out
  assert.ok(inner.path.points.slice(0, -2).every(q => q.x > -276 - 26), inner.path.points.map(q => at(q)).join(' '));
  assert.ok(beyond.path.points.some(q => q.x < -276 - 26));
  assert.ok(inner.need < beyond.need - 0.03, `${inner.need} ${beyond.need}`);
  // a lane has no depth (docs/cable-lay-design.md), so the turn into the plug is judged as it is for any lane: no more
  // corners short of room than by the gutter beyond the PDU
  assert.ok(inner.path.bends.length <= beyond.path.bends.length);
  // the detours (solids.js) take no inner lane for a side lane: the world's lanes are the gutters
  assert.ok(R.laneXAt(rack, 'left-rear', 41, ctx.chassisOf) < -300);
  assert.equal(R.laneXAt(rack, 'left-rear-inner', 41, ctx.chassisOf), x);
});
