// A lead enters the first ring along its way that it has room to turn into
// (#1026, docs/cable-lay-design.md section 3.5): the choice is by room, not
// by distance. The rack is of the shape the issue was measured on
// (ring-room-shape.mjs): 2U switches, each with an FHD-CMP5DR lacer hosted
// on it, a vertical manager at each front upright, 400G AOC fabric links
// with a 64.8 mm plug and a 30 mm bend radius. Every count was measured on
// these racks and is asserted exactly, and each check asserts it looked at
// something.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as S from '../../../kit/rack/solids.js';
import {cornersOf} from '../../../kit/rack/route-path.js';
import {shape, measure, portOf} from './ring-room-shape.mjs';

const r1 = v => Math.round(v * 10) / 10;
const ring = (item, n) => ({item, via: `guide-${n}`});
// the rings a route takes on one manager, in order
const ringsOn = (route, item) => route.filter(w => w.item === item).map(w => Number(w.via.slice(6)));
const cableOf = (rack, id) => rack.cables.find(c => c.id === id);

// ── the shape ────────────────────────────────────────────────────────────

test('the shape: a lacer on the top unit stands its rings 73.7 mm out, their sill 7 and 20 mm under the two rows of ports it serves', () => {
  const {rack, ctx} = shape({count: 43});
  assert.equal(rack.cables.length, 43);
  // EDGE-0 at U35 and U36, its lacer m3 on U36
  const [t] = S.traysOf(rack, ctx).filter(x => x.item === 'm3');
  const sill = t.rings[0].box.y0, rows = [ctx.portY({item: 'i3', path: 'fab-0'}), ctx.portY({item: 'i3', path: 'fab-1'})];
  assert.deepEqual(rows.map(y => r1(y - sill)), [19.8, 6.8]);
  // a cable on its own lies at the rail side of the opening, its radius in
  assert.equal(t.rings[0].box.z0 + 1.5, 73.7);
  assert.equal(R.PLUG_REACH.aoc, 64.8);
  // so an AOC's plug ends 8.9 mm short of the line it must turn onto
  assert.equal(r1(73.7 - R.PLUG_REACH.aoc), 8.9);
});

// ── the rule ─────────────────────────────────────────────────────────────

test('a ring too close to turn into is passed over, and the next ring with room is taken', () => {
  const {rack, ctx} = shape({count: 43});
  // c9 leaves EDGE-0's fab-8, 6.3 mm short of ring 2's near face: the lead
  // would turn twice on 20 mm. Ring 1 stands 92 mm further along
  const c9 = cableOf(rack, 'c9');
  assert.equal(r1(portOf('edge', 'fab-8')[0]), -104.7);
  const route = R.autoRoute(rack, c9, ctx);
  assert.deepEqual(ringsOn(route, 'm3'), [1]);
  assert.deepEqual(route[0], ring('m3', 1));
  // and it has its room there: no corner between that port and ring 1 is short
  const path = R.routePath(rack, c9, ctx);
  assert.deepEqual(path.bends.filter(f => f.between.some(w => w.end === 'a')), []);
  assert.deepEqual(path.crossings, []);
  // through ring 2 by hand, as the route was before: the two turns share
  // 20 mm and have room for an 11.2 mm bend
  const hand = {...c9, route: [ring('m3', 2), ...route], routeEdited: true};
  const was = R.routePath({...rack, cables: [hand]}, hand, ctx).bends.filter(f => f.between.some(w => w.end === 'a'));
  assert.deepEqual(was.map(f => [f.point, f.room_mm]), [['reach', 11.2], ['approach', 11.2]]);
});

test('a ring with room is taken though it is the nearest: the rule passes over nothing it need not', () => {
  const {rack, ctx} = shape({count: 43});
  let taken = 0, passed = 0;
  for (const c of rack.cables) {
    const route = R.autoRoute(rack, c, ctx);
    for (const [e, m] of [[c.a, 'm3']]) {
      if (e.item !== 'i3' || !/^fab-/.test(e.path)) continue;
      const x = ctx.portX(e), side = x <= 0 ? -1 : 1;
      // the rings on its way out, nearest first, as `through` lists them
      const out = [-205.8, -110.4, 0, 110.4, 205.8].map((cx, i) => [i + 1, cx]).filter(([, cx]) => (side < 0 ? cx <= x + 3.4 : cx >= x - 3.4))
        .sort((p, q) => Math.abs(p[1] - x) - Math.abs(q[1] - x));
      const got = ringsOn(route, m);
      if (!got.length || route.find(w => w.lane).lane.startsWith(side < 0 ? 'right' : 'left')) continue;
      // what it takes is the rings on its way from some ring outward, in order
      const from = out.findIndex(([n]) => n === got[0]);
      assert.ok(from >= 0, c.id);
      assert.deepEqual(got, out.slice(from).map(([n]) => n), c.id);
      if (from === 0) taken++; else passed++;
    }
  }
  // of EDGE-0's fabric leads that take a ring on the side their port is on,
  // most take the nearest
  assert.deepEqual([taken, passed], [22, 5]);
});

test('where no ring leaves room the nearest stands, and the finding says the manager is too close and what would help', () => {
  const {rack, ctx, nameOf} = shape({count: 43});
  // c1 leaves fab-0, 16.8 mm short of ring 1's near face, and ring 1 is the
  // last ring on its way
  const c1 = cableOf(rack, 'c1');
  assert.deepEqual(ringsOn(R.autoRoute(rack, c1, ctx), 'm3'), [1]);
  const found = R.bendFindingsOf(rack, c1, ctx, nameOf).filter(f => f.between.some(w => w.end === 'a'));
  assert.equal(found.length, 2);
  for (const f of found) {
    assert.deepEqual(f.tooClose, {manager: 'm3', device: 'i3'});
    assert.match(f.text, /^c1 turns [\d.]+ degrees between its port on EDGE-0 and Lacer EDGE-0 ring 1 with room for an? [\d.]+ mm bend; the cable \(aoc\) needs 30 mm, [\d.]+ mm short\. /);
    assert.ok(f.text.endsWith('Lacer EDGE-0 stands too close to this port for the cable to turn into any ring on its way: '
      + 'set EDGE-0 back from the rail, mount the manager on another unit of EDGE-0, or leave EDGE-0 without a manager.'), f.text);
  }
  // rack-wide the findings are the same ones
  assert.deepEqual(R.bendFindings(rack, ctx, nameOf).filter(f => f.cable === 'c1').map(f => f.text), R.bendFindingsOf(rack, c1, ctx, nameOf).map(f => f.text));
  // the path's own `bends` are as they were: the sentence is the finding's
  assert.ok(R.routePath(rack, c1, ctx).bends.every(f => !('tooClose' in f)));
  // a finding that is not a lead's says nothing of the manager, and a cable
  // with no finding has none to say it in
  const all = R.bendFindings(rack, ctx, nameOf);
  assert.ok(all.some(f => f.tooClose) && all.every(f => !f.tooClose || f.between.some(w => w.end)));
});

test('the advice fits the device: one of a single unit has no other unit to mount the manager on', () => {
  const {rack, ctx, nameOf} = shape({count: 43});
  const c1 = cableOf(rack, 'c1');
  // the same rack with EDGE-0 a device of one unit
  const one = {...ctx, chassisOf: ref => (ref === 'edge' ? {...ctx.chassisOf(ref), ru: 1, h: 43.6} : ctx.chassisOf(ref)),
    portY: e => (e.item === 'i3' ? 34 * 44.45 + 24 : ctx.portY(e))};
  const flat = {...rack, items: rack.items.map(i => (i.id === 'm3' ? {...i, ru: 35, unit: 1} : i))};
  const f1 = R.bendFindingsOf(flat, c1, one, nameOf).find(f => f.tooClose);
  assert.ok(f1, 'the lead is still too close');
  assert.ok(f1.text.endsWith('set EDGE-0 back from the rail or leave EDGE-0 without a manager.'), f1.text);
});

test('set back 50 mm, the same leads have room: the rule reads where the device and the manager stand', () => {
  const far = shape({count: 43, setback: 50});
  const c1 = cableOf(far.rack, 'c1'), c9 = cableOf(far.rack, 'c9');
  assert.deepEqual(R.bendFindingsOf(far.rack, c1, far.ctx, far.nameOf), []);
  // and c9's plug now ends 59 mm behind the rings' line: ring 2 has room, and is taken
  assert.deepEqual(ringsOn(R.autoRoute(far.rack, c9, far.ctx), 'm3'), [2, 1]);
  assert.deepEqual(R.bendFindingsOf(far.rack, c9, far.ctx, far.nameOf), []);
});

test('a hand route is never overridden: a ring it names is gone through, room or none, and the finding gives no advice', () => {
  const {rack, ctx, nameOf} = shape({count: 43});
  const c9 = cableOf(rack, 'c9'), auto = R.autoRoute(rack, c9, ctx);
  const hand = {...c9, route: [ring('m3', 2), ...auto], routeEdited: true}, r = {...rack, cables: [hand]};
  assert.deepEqual(R.resolveRoute(r, hand, ctx).waypoints, hand.route);
  const path = R.routePath(r, hand, ctx);
  assert.deepEqual(path.rings.slice(0, 2).map(g => [g.via, g.passed]), [['guide-2', true], ['guide-1', true]]);
  const found = R.bendFindingsOf(r, hand, ctx, nameOf);
  assert.ok(found.length >= 2);
  assert.ok(found.every(f => !f.tooClose && !/too close/.test(f.text)));
});

test('what cannot be measured is not passed over: a port not found, and a cable no lay is opened out for', () => {
  const {rack, ctx} = shape({count: 43});
  const c9 = cableOf(rack, 'c9');
  // a cable that needs more than any ring leaves: none has room, the nearest stands
  const stiff = {...ctx, bendOf: () => 1e6};
  assert.deepEqual(ringsOn(R.autoRoute(rack, c9, stiff), 'm3'), [2, 1]);
  // a port the drawing does not place: the side is the left, and every ring on it is taken
  const lost = {...ctx, portX: e => (e.item === 'i3' ? null : ctx.portX(e))};
  assert.deepEqual(ringsOn(R.autoRoute(rack, c9, lost), 'm3'), [3, 2, 1]);
});

test('the choice is the same however often it is asked for, and from either end of the cable', () => {
  const {rack, ctx} = shape({count: 43});
  let rings = 0;
  for (const c of rack.cables) {
    const a = R.autoRoute(rack, c, ctx);
    assert.deepEqual(R.autoRoute(rack, c, ctx), a, c.id);
    const back = R.autoRoute(rack, {...c, a: c.b, b: c.a}, ctx);
    assert.deepEqual(back, a.toReversed(), c.id);
    rings += a.filter(w => w.item).length;
  }
  assert.ok(rings > 60, `${rings} rings`);
});

test('the measure the rule uses is the path\'s own: a lead it gives a ring has no corner short on the way to it', () => {
  // every lead of the 43 that was given a ring with room is laid with room
  const {rack, ctx, nameOf} = shape({count: 43});
  let leads = 0;
  for (const c of rack.cables) {
    const found = R.bendFindingsOf(rack, c, ctx, nameOf);
    for (const f of found) if (f.between.some(w => w.end) && f.between.some(w => w.item)) { assert.ok(f.tooClose, f.text); leads++; }
    assert.ok(cornersOf(R.routePath(rack, c, ctx).points, {share: 'need'}).length > 0, c.id);
  }
  assert.ok(leads > 10, `${leads} findings at a lead`);
});

export {measure};
