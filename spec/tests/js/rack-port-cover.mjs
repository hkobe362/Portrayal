// spec/tests/js/rack-port-cover.mjs
// A span that crosses in front of other ports (#1013, docs/cable-lay-design.md
// section 1.7): routePath's `covers` and coverFindings, on the rack of short
// hops (bundle-hops-fixture.mjs), which has no cable manager, and on the same
// rack with a manager on every switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as HOPS from './bundle-hops-fixture.mjs';

const nameOf = r => id => r.items.find(i => i.id === id)?.label ?? id;
const allPorts = r => ({portBoxesOf: id => HOPS.portsOf(r, id)});

test('with no manager, a span from the lane to a port is reported with the ports it covers', () => {
  const r = HOPS.bundled(), ctx = HOPS.ctxFor(r);
  // nothing else reports it: no body is crossed, no ring, no bend is short
  assert.deepEqual([R.bodyFindings(r, ctx).length, R.ringFindings(r, ctx).length, R.bendFindings(r, ctx).length], [0, 0, 0]);
  // without ctx.portBoxesOf only the ports that hold a cable are known: the
  // top switch's ports 1 to 11 and each management port
  const found = R.coverFindings(r, ctx, nameOf(r));
  assert.deepEqual(found.map(f => f.cable), ['c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11']);
  const c11 = found.at(-1);
  assert.equal(c11.kind, 'covers-ports');
  assert.deepEqual(c11.ports, [8, 9, 10].map(n => ({item: 'i1', path: `port-${n}`, view: 'front'})));
  assert.deepEqual(c11.between, [[{lane: 'left-front', ru: 42}, {end: 'b'}]]);
  assert.equal(c11.text, 'c11 crosses in front of port-8, port-9 and port-10 on MGMT-SW1 between left-front U42 and its port on MGMT-SW1: '
    + 'add a horizontal cable manager above or below MGMT-SW1 to carry it.');
  // never its own two ports
  for (const f of found) {
    const c = r.cables.find(x => x.id === f.cable);
    assert.ok(!f.ports.some(p => [c.a, c.b].some(e => e.item === p.item && e.path === p.path)), f.cable);
  }
  // the path carries each port once, with where the span comes over it
  const covers = R.routePath(r, r.cables[10], ctx).covers;
  assert.deepEqual(covers.map(c => [c.kind, c.cable, c.item, c.path, c.view]),
    [8, 9, 10].map(n => ['covers-port', 'c11', 'i1', `port-${n}`, 'front']));
  for (const c of covers) {
    assert.equal(c.at.length, 3);
    // in front of the top switch's panel (z 0), no further out than COVER_DEPTH
    assert.ok(c.at[2] >= 0 && c.at[2] <= R.COVER_DEPTH, c.at);
  }
});

test('a page that lists every port has the uncabled ones judged too, a neighbour\'s included', () => {
  const r = HOPS.bundled(), ctx = HOPS.ctxFor(r, allPorts(r));
  const found = R.coverFindings(r, ctx, nameOf(r));
  assert.deepEqual(found.map(f => f.cable), r.cables.map(c => c.id));
  // c1 leaves SW2's management port for the lane and sags in front of SW3, the switch below
  const c1 = found[0];
  assert.ok(c1.ports.length > 6 && c1.ports.every(p => p.item === 'i3'), JSON.stringify(c1.ports));
  assert.match(c1.text, /^c1 crosses in front of (port-\d+, ){4}port-\d+ and \d+ more on SW3 between its port on SW2 and left-front U41: add a horizontal cable manager above or below SW2 to carry it\.$/);
  // c11 now also covers port-12, which holds no cable
  assert.deepEqual(found.at(-1).ports.map(p => p.path), ['port-8', 'port-9', 'port-10', 'port-12']);
  // a reader that throws, or an entry with no place, is left out: the cabled ports still stand
  const broken = HOPS.ctxFor(r, {portBoxesOf: id => { if (id === 'i1') throw new Error('no face'); return [{path: 'x'}, null, 'junk']; }});
  assert.deepEqual(R.coverFindings(r, broken, nameOf(r)).map(f => f.cable), ['c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11']);
});

test('a jumper that hangs from port to port is judged over both faces', () => {
  const r = HOPS.rack(), ctx = HOPS.ctxFor(r, allPorts(r));
  const c1 = R.coverFindings(r, ctx, nameOf(r))[0];
  assert.deepEqual(c1.between, [[{end: 'a'}, {end: 'b'}]]);
  assert.deepEqual([...new Set(c1.ports.map(p => p.item))].sort(), ['i1', 'i2']);
  assert.match(c1.text, /between its port on SW2 and its port on MGMT-SW1: add a horizontal cable manager above or below SW2 or MGMT-SW1 to carry it\.$/);
});

test('with a manager on every switch no span is reported', () => {
  const r = HOPS.managed(), ctx = HOPS.ctxFor(r, allPorts(r));
  // every cord leaves through a ring: no leg runs from a port to a lane or a port
  for (const c of r.cables) {
    const route = R.resolveRoute(r, c, ctx).waypoints;
    assert.ok(route.length && route[0].item && route.at(-1).item, `${c.id}: ${JSON.stringify(route)}`);
    assert.deepEqual(R.routePath(r, c, ctx).covers, [], c.id);
  }
  assert.deepEqual(R.coverFindings(r, ctx, nameOf(r)), []);
});

test('a port on the other panel is not covered, and the ports are read once per rack and context', () => {
  const r = HOPS.bundled();
  // the same ports listed on the rear panel: the spans are in front of the rack
  const rear = HOPS.ctxFor(r, {portBoxesOf: id => HOPS.portsOf(r, id).filter(p => p.path !== 'mgmt' && !/^port-(\d|1[01])$/.test(p.path))
    .map(p => ({...p, view: 'rear'}))});
  const cabled = R.coverFindings(r, HOPS.ctxFor(r), nameOf(r)), got = R.coverFindings(r, rear, nameOf(r));
  assert.deepEqual(got.map(f => f.ports), cabled.map(f => f.ports));
  // the list is read once per rack and context
  let calls = 0;
  const counted = HOPS.ctxFor(r, {portBoxesOf: id => { calls++; return HOPS.portsOf(r, id); }});
  R.coverFindings(r, counted, nameOf(r));
  R.coverFindings(r, counted, nameOf(r));
  assert.equal(calls, r.items.length);
});
