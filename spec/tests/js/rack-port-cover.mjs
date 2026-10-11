// spec/tests/js/rack-port-cover.mjs
// A span that crosses in front of other ports (#1013, docs/cable-lay-design.md
// section 1.7): routePath's `covers` and coverFindings, on the rack of short
// hops (bundle-hops-fixture.mjs), which has no cable manager, on the same
// rack with a manager on every switch, and on two 48-port switches patched
// port for port.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as HOPS from './bundle-hops-fixture.mjs';

const nameOf = r => id => r.items.find(i => i.id === id)?.label ?? id;
const allPorts = r => ({portBoxesOf: id => HOPS.portsOf(r, id)});
const found = (r, extra) => R.coverFindings(r, HOPS.ctxFor(r, extra), nameOf(r));

test('with no manager, a span that runs across a face to its port is reported with the ports it covers', () => {
  const r = HOPS.bundled(), ctx = HOPS.ctxFor(r);
  // nothing else reports it: no body is crossed, no ring, no bend is short
  assert.deepEqual([R.bodyFindings(r, ctx).length, R.ringFindings(r, ctx).length, R.bendFindings(r, ctx).length], [0, 0, 0]);
  // without ctx.portBoxesOf only the ports that hold a cable are known (the
  // top switch's ports 1 to 11 and each management port), and the finding
  // says so, in its `judged` and in its sentence
  const got = R.coverFindings(r, ctx, nameOf(r));
  assert.deepEqual(got.map(f => [f.cable, f.count]), [['c5', 1], ['c7', 2], ['c8', 1], ['c9', 1], ['c10', 2], ['c11', 1]]);
  const c10 = got[4];
  assert.deepEqual([c10.kind, c10.judged, c10.estimated], ['span-over-ports', 'cabled', true]);
  assert.deepEqual(c10.ports, [2, 4].map(n => ({item: 'i1', path: `port-${n}`, view: 'front'})));
  assert.deepEqual(c10.between, [[{lane: 'left-front', ru: 42}, {end: 'b'}]]);
  assert.equal(c10.text, 'c10 crosses in front of port-2 and port-4 on MGMT-SW1 between left-front U42 and its port on MGMT-SW1: '
    + 'add a horizontal cable manager above or below MGMT-SW1 to carry it to the gutter. Only ports that hold a cable were judged.');
  // the path carries each port once, with where the span comes over it
  const covers = R.routePath(r, r.cables[9], ctx).covers;
  assert.deepEqual(covers.map(c => [c.kind, c.cable, c.item, c.path, c.view, c.judged, c.estimated]).sort(),
    [2, 4].map(n => ['port-behind-span', 'c10', 'i1', `port-${n}`, 'front', 'cabled', true]));
  // in front of the top switch's panel (z 0), no further out than 100 mm
  for (const c of covers) assert.ok(c.at.length === 3 && c.at[2] >= 0 && c.at[2] <= 100, c.at);
  // the two names are not part of the kit's API
  assert.deepEqual([R.PORT_BOX, R.COVER_DEPTH], [undefined, undefined]);
});

test('a port beside the cable\'s own port is not in front of another: its stacked partner, and those within a bend radius', () => {
  const r = HOPS.bundled(), ctx = HOPS.ctxFor(r, allPorts(r));
  const port = n => HOPS.portAt(r, {item: 'i1', path: `port-${n}`});
  // c11 ends at port-11 of the top switch: port-12 is under it, 11.5 mm away;
  // port-9 and port-10 are one column along, 14.6 mm. Its span from the lane
  // passes in front of all three and of port-8, and only port-8, whose box is
  // 24.1 mm from port-11 (a Cat 6 cord's bend radius is 24), is listed
  assert.deepEqual([port(12), port(9), port(8)].map(p => Math.round(Math.hypot(p.x - port(11).x, p.y - port(11).y) * 10) / 10), [11.5, 14.6, 31.4]);
  const c11 = R.coverFindings(r, ctx, nameOf(r)).at(-1);
  assert.deepEqual([c11.cable, c11.count, c11.ports.map(p => p.path), c11.judged, c11.estimated], ['c11', 1, ['port-8'], 'all', undefined]);
  assert.ok(!c11.text.includes('Only ports'));
  // a stiffer cord turns wider and is beside more: at 40 mm port-8 is too
  const stiff = HOPS.ctxFor(r, {...allPorts(r), bendOf: () => 40});
  assert.ok(!R.routePath(r, r.cables[10], stiff).covers.some(c => c.item === 'i1' && c.path === 'port-8'));
  // never its own two ports, and never one on its own device nearer than that
  for (const f of R.coverFindings(r, ctx, nameOf(r))) {
    const c = r.cables.find(x => x.id === f.cable);
    for (const p of f.ports) for (const e of [c.a, c.b]) {
      if (e.item !== p.item) continue;
      const o = HOPS.portAt(r, e), q = HOPS.portAt(r, p);
      assert.ok(Math.hypot(Math.max(Math.abs(q.x - o.x) - 6, 0), Math.max(Math.abs(q.y - o.y) - 5, 0)) > 24, `${f.cable} ${p.path}`);
    }
  }
});

test('a page that lists every port has the uncabled ones judged too, a neighbour\'s included', () => {
  const r = HOPS.bundled();
  const got = found(r, allPorts(r));
  // every long diagonal across a face is still flagged: thirteen to fifteen ports each
  assert.deepEqual(got.map(f => [f.cable, f.count]), [['c1', 13], ['c2', 13], ['c3', 13], ['c4', 13], ['c5', 14], ['c6', 13], ['c7', 15],
    ['c8', 14], ['c9', 14], ['c10', 15], ['c11', 1]]);
  assert.ok(got.every(f => f.judged === 'all' && !f.estimated));
  // c1 leaves SW2's management port for the lane and sags in front of SW3, the switch below
  const c1 = got[0];
  assert.ok(c1.ports.every(p => p.item === 'i3'), JSON.stringify(c1.ports));
  assert.equal(c1.text, 'c1 crosses in front of port-1, port-3, port-5, port-7, port-9 and 8 more on SW3 between its port on SW2 and left-front U41: '
    + 'add a horizontal cable manager above or below SW2 to carry it to the gutter.');
  // a reader that throws for a device, or an entry with no place, is left
  // out: the cabled ports still stand, and the finding says only they were judged
  const broken = found(r, {portBoxesOf: id => { if (id === 'i1') throw new Error('no face'); return [{path: 'x'}, null, 'junk']; }});
  assert.deepEqual(broken.map(f => [f.cable, f.judged]), [['c5', 'cabled'], ['c7', 'cabled'], ['c8', 'cabled'], ['c9', 'cabled'], ['c10', 'cabled'], ['c11', 'cabled']]);
});

test('a jumper that hangs from port to port is judged over both faces, and told a manager beside either device', () => {
  const r = HOPS.rack();
  const c1 = found(r, allPorts(r))[0];
  assert.deepEqual(c1.between, [[{end: 'a'}, {end: 'b'}]]);
  assert.deepEqual([...new Set(c1.ports.map(p => p.item))].sort(), ['i1', 'i2']);
  assert.match(c1.text, /between its port on SW2 and its port on MGMT-SW1: route its hop from SW2 to MGMT-SW1 through a horizontal cable manager beside either\.$/);
});

test('two 48-port switches patched port for port: a jumper that only passes its own column is not reported', () => {
  // one above the other, or two units apart: every cord hangs straight down
  // its own column, in front of the other-row port of its own port and
  // nothing else. No manager would move it, and none is advised.
  for (const gap of [1, 2]) {
    const r = HOPS.patched({gap});
    assert.equal(r.cables.length, 48);
    assert.deepEqual(r.cables.map(c => R.autoRoute(r, c, HOPS.ctxFor(r)).length), Array(48).fill(0), `gap ${gap}`);
    assert.deepEqual([found(r).length, found(r, allPorts(r)).length], [0, 0], `gap ${gap}`);
  }
  // one column along: still beside its own ports
  const one = HOPS.patched({shift: 1});
  assert.deepEqual([found(one).length, found(one, allPorts(one)).length], [0, 0]);
  // four columns along (58 mm): the hop crosses the columns between, and is reported
  const four = HOPS.patched({shift: 4}), got = found(four, allPorts(four));
  assert.equal(got.length, 20);
  assert.ok(got.every(f => f.ports.every(p => ['i1', 'i2'].includes(p.item))));
  assert.match(got[0].text, /: route its hop from SW-A to SW-B through a horizontal cable manager beside either\.$/);
  // three units apart every cord goes to the gutter across its face: twenty
  // of the forty-eight pass over a port past the ones beside their own
  const far = HOPS.patched({gap: 3});
  assert.deepEqual([found(far).length, found(far, allPorts(far)).length], [20, 20]);
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
  // the uncabled ports listed on the rear panel: the spans are in front of the rack
  const rear = found(r, {portBoxesOf: id => HOPS.portsOf(r, id).filter(p => p.path !== 'mgmt' && !/^port-(\d|1[01])$/.test(p.path))
    .map(p => ({...p, view: 'rear'}))});
  assert.deepEqual(rear.map(f => f.ports), found(r).map(f => f.ports));
  assert.ok(rear.every(f => f.judged === 'all'));
  let calls = 0;
  const counted = HOPS.ctxFor(r, {portBoxesOf: id => { calls++; return HOPS.portsOf(r, id); }});
  R.coverFindings(r, counted, nameOf(r));
  R.coverFindings(r, counted, nameOf(r));
  assert.equal(calls, r.items.length);
});
