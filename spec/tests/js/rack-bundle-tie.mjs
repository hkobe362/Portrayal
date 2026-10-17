// spec/tests/js/rack-bundle-tie.mjs
// A BUNDLE WHOSE TRUNK IS ONE WAYPOINT IS A TIE (#1017, decided 2026-10-16):
// one strap round the pack at that point, the members packed through it and
// the envelope there, and nothing for a trunk of two or more nodes changed. The
// panes and the 3D scene are the site's; they read what is asserted here
// (straps(), resolveRoute and routePath, bundleCheck's size at the ring).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as B from '../../../kit/rack/bundles.js';
import * as X from '../../../kit/rack/export-data.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply} from '../../../kit/rack/commands.js';
import {withCable} from '../../../kit/rack/cable-rules.js';

const VIAS = ['guide-1', 'guide-2', 'guide-3', 'guide-4', 'guide-5'];
const SIZES = {sw: {ru: 1, d: 515, model: 'SW'}, pp: {ru: 1, d: 100, model: 'PP'},
  mgr: {ru: 1, d: 110, mount: 'rack-face', model: 'MGR', guides: {front: VIAS}, default: 'x'}};
const chassisOf = ref => SIZES[ref] || null;
const XS = [-450, -150, 0, 200, 450];
const routeCtx = rack => ({chassisOf, portX: () => -150,
  guidesOf: id => (rack.items.find(i => i.id === id)?.ref === 'mgr' ? VIAS.map((via, k) => ({via, kind: 'duct', face: 'front', x: XS[k], box: {w: 40, h: 30}})) : [])});
const end = (item, path) => ({item, path, view: 'front'});
const RT = (...ws) => ws.map(w => (Array.isArray(w) ? {lane: w[0], ru: w[1]} : {item: w.split(':')[0], via: w.split(':')[1]}));
function rackWith(routes) {
  let r = M.newRack({name: 'Rack 1'});
  r = M.withItem(r, {ref: 'sw', cfg: 'x', ru: 10, label: 'sw-1'}).rack;
  r = M.withItem(r, {ref: 'mgr', cfg: 'x', ru: 10, label: 'mgr-1', on: 'i1', unit: 1}).rack;
  r = M.withItem(r, {ref: 'pp', cfg: 'x', ru: 30, label: 'pp-1'}).rack;
  r = M.withItem(r, {ref: 'mgr', cfg: 'x', ru: 30, label: 'mgr-2', on: 'i3', unit: 1}).rack;
  routes.forEach((route, k) => {
    r = withCable(r, {a: end('i1', `p${k + 1}`), b: end('i3', `q${k + 1}`), media: 'cat6'}).rack;
    r = {...r, cables: r.cables.map(c => (c.id === `c${k + 1}` ? {...c, route, routeEdited: true} : c))};
  });
  return r;
}
const run = (rack, cmds, ctx = {}) => apply(rack, cmds, {chassisOf, ...ctx});
const ONE = RT('i2:guide-3'), ALONG = RT(...VIAS.map(v => `i2:${v}`));
// n cables, each through the route given, bundled on it
function bundled(n, route, straps) {
  const r = rackWith(Array.from({length: n}, () => route));
  return {...r, bundles: [{id: 'b1', number: 1, label: '', members: r.cables.map(c => ({cable: c.id})), route, ...(straps ? {straps} : {})}]};
}
// the device at one end of the cables named is gone and the cable kept: it rides nothing (#1021)
const looseFrom = (r, ids) => ({...r, cables: r.cables.map(c => (ids.includes(c.id) ? {...c, a: {...c.a, item: 'i99'}} : c))});
const everything = r => { const ctx = {route: routeCtx(r)};
  return {straps: B.straps(r, r.bundles[0], ctx), totals: B.strapTotals(r, ctx), ex: X.bundleExports(r, ctx)[0], length: B.trunkLength(r, r.bundles[0], ctx)}; };

test('a one-waypoint bundle of four riding has exactly one strap, at its ring, and the list, the exports and the count agree (#1017)', async () => {
  const r = bundled(4, ONE), ctx = {route: routeCtx(r)};
  const {straps: s, totals, ex, length} = everything(r);
  assert.equal(s.count, 1);
  assert.deepEqual(s.kinds, {spacing: 0, breakout: 0, anchor: 0, tie: 1});
  assert.deepEqual(s.runs, []);
  const [t] = s.straps;
  assert.deepEqual([t.kind, t.item, t.via, t.along_mm, t.segment, t.t, t.width_mm], ['tie', 'i2', 'guide-3', 0, 0, 0, 19]);
  // on the ring (guide-3 stands at x = 0), on the path of a member
  assert.equal(t.point.x, 0);
  assert.ok(['c1', 'c2', 'c3', 'c4'].includes(t.on) && t.dir && Math.abs(Math.hypot(t.dir.x, t.dir.y, t.dir.z) - 1) < 1e-3);
  assert.deepEqual(s.widths, {19: 1});
  // no length: the tie, not "0 m"
  assert.deepEqual(length, {metres: 0, tie: true});
  assert.equal(ex.length_m, null);
  assert.deepEqual([ex.tie, ex.tie_at, ex.straps, ex.strap_kinds.tie, ex.strap_widths], [true, 'mgr-1 ring 3', 1, 1, {19: 1}]);
  assert.equal(X.bundleNote(ex), 'Bundle 1 (b1): 4 cables (c1-c4), tied at mgr-1 ring 3, 1 strap; 13 mm across, limit 63.5 mm; bend not checked.');
  // the query, the list line and the total say the same
  const facts = await Q.inspect(r, 'b1', ctx);
  assert.deepEqual([facts.straps.count, facts.straps.kinds.tie, facts.length], [1, 1, {metres: 0, tie: true}]);
  assert.match(await Q.describe(r, {chassisOf, ...ctx}), /b1 Bundle 1: 4 cables \(c1-c4\), about 13 mm, a tie at mgr-1 ring 3, no warnings\./);
  assert.equal(totals.total, 1);
  assert.equal(totals.tie, 1);
  // the strap of a pack 25 mm across or more is the wide one
  const wide = bundled(20, ONE), wideS = B.straps(wide, wide.bundles[0], {route: routeCtx(wide)});
  assert.deepEqual([wideS.count, wideS.straps[0].width_mm], [1, B.STRAP_WIDE_MM]);
});

test('a tie with fewer than two cables riding has no strap, and the list says why (#1021, #1017)', async () => {
  const r = bundled(4, ONE);
  for (const [ids, said] of [[['c2', 'c3', 'c4'], 'only one cable rides'], [['c1', 'c2', 'c3', 'c4'], 'no cable rides']]) {
    const bad = looseFrom(r, ids), ctx = {route: routeCtx(bad)};
    const {straps: s, totals, ex} = everything(bad);
    assert.deepEqual([s.count, s.kinds, s.straps], [0, {spacing: 0, breakout: 0, anchor: 0}, []], ids.join());
    assert.equal(totals.total, 0);
    assert.equal(ex.straps, 0);
    assert.deepEqual(X.strapBomRows([ex]), []);
    const why = `Bundle 1 is a tie at mgr-1 ring 3, and ${said} there, so it has no strap.`;
    assert.ok(ex.notes.includes(why), ex.notes.join('\n'));
    assert.ok((await Q.inspect(bad, 'b1', ctx)).notes.includes(why));
    assert.match(await Q.describe(bad, {chassisOf, ...ctx}), /a tie at mgr-1 ring 3 with no strap, since fewer than two cables ride it/);
    assert.match(X.bundleNote(ex), /tied at mgr-1 ring 3, no straps/);
  }
  // three of four still ride: strapped
  assert.equal(everything(looseFrom(r, ['c4'])).straps.count, 1);
  // a bundle set to no straps has none, as a longer trunk has none of any kind
  assert.equal(everything(bundled(4, ONE, {every: null})).straps.count, 0);
});

test('the envelope is at the ring and the members are packed through it (#1017)', () => {
  const r = bundled(4, ONE), rc = routeCtx(r);
  // the envelope on hover: the bundle's size at the ring, and the strap is as wide as its pack
  const check = B.bundleCheck(r, r.bundles[0], {route: rc});
  assert.deepEqual([check.size.at, check.size.max_mm], ['mgr-1 ring 3', 13.4]);
  assert.equal(check.size.max_mm, Math.round(B.bundleDiameter([6, 6, 6, 6]) * 10) / 10);
  // each member follows the bundle through the ring and passes it
  for (const c of r.cables) {
    const route = R.resolveRoute(r, c, rc);
    assert.equal(route.bundle, 'b1');
    assert.ok(route.waypoints.some(w => w.item === 'i2' && w.via === 'guide-3'), c.id);
    const path = R.routePath(r, c, rc);
    assert.ok(path.points.some(p => p.item === 'i2' && p.via === 'guide-3'), `${c.id} passes the ring`);
  }
  // the strap stands among them: within the pack's reach of every member's path at the ring
  const [t] = B.straps(r, r.bundles[0], {route: rc}).straps;
  for (const c of r.cables) {
    const near = Math.min(...R.routePath(r, c, rc).points.filter(p => p.via === 'guide-3').map(p => Math.hypot(p.x - t.point.x, p.y - t.point.y, p.z - t.point.z)));
    assert.ok(near < 25, `${c.id} is ${near} mm from the strap`);
  }
});

test('the BOM and every export count the tie\'s strap once (#1017)', () => {
  const r = bundled(4, ONE), ctx = {route: routeCtx(r)};
  const ex = X.bundleExports(r, ctx);
  const rows = X.strapBomRows(ex, {anchors: B.anchorsOf(r, ctx)});
  assert.deepEqual(rows.map(x => x.qty), [1]);
  assert.equal(rows[0].description, '1 round a bundle tied at one point; 1 of 19 mm wide; length to suit');
  assert.equal(B.strapTotals(r, ctx).total, 1);
  // beside a bundle with a run, each is counted: five and one
  const both = bundled(4, ALONG), tied = bundled(4, ONE);
  const mixed = {...both, items: tied.items, cables: [...both.cables, ...both.cables.map(c => ({...c, id: `${c.id}x`, route: ONE}))],
    bundles: [both.bundles[0], {id: 'b2', number: 2, label: '', route: ONE, members: ['c1x', 'c2x', 'c3x', 'c4x'].map(cable => ({cable}))}]};
  const t = B.strapTotals(mixed, {route: routeCtx(mixed)});
  assert.deepEqual([t.spacing, t.breakout, t.tie, t.total], [3, 2, 1, 6]);
  // the notes of a sheet carry the tie once
  assert.equal(X.bundleNotes(ex).filter(n => n.includes('tied at')).length, 1);
});

test('bundle.create accepts a one-waypoint route as it did, and a saved rack holding one loads unchanged (#1017)', () => {
  const r = rackWith([ONE, ONE, ONE, ONE]), rc = routeCtx(r);
  for (const ctx of [{}, {route: rc}]) {
    const made = run(r, {op: 'bundle.create', cables: ['c1', 'c2', 'c3', 'c4'], route: ONE}, ctx);
    assert.equal(made.error, undefined);
    assert.equal(made.summary, 'Bundled 4 cables as Bundle 1.');
    assert.deepEqual(made.rack.bundles[0].route, ONE);
    assert.ok(!made.findings.some(f => f.kind === 'warning'), JSON.stringify(made.findings));
  }
  const doc = {...M.newDoc(), racks: [bundled(4, ONE)]};
  const text = M.serialize(doc);
  const notes = [];
  assert.deepEqual(M.parseDoc(text, {notes}).racks[0], doc.racks[0]);
  assert.deepEqual(notes, []);
  assert.equal(M.serialize(M.parseDoc(text)), text);
});

// A TRUNK OF TWO OR MORE NODES IS DRAWN AS BEFORE: the straps, the length, the exports, the note and the BOM
// of four cables through five rings, read before the tie was added, byte for byte.
const GOLDEN = '{"straps":{"every":{"value":12,"unit":"in"},"count":5,"kinds":{"spacing":3,"breakout":2,"anchor":0},"widths":{"19":5},"straps":[{"kind":"breakout","segment":0,"t":0.0833,"along_mm":25,"point":{"x":-425,"y":422.28,"z":55},"dir":{"x":1,"y":0,"z":0},"on":"c2","width_mm":19},{"kind":"spacing","segment":0,"t":0.5,"along_mm":150,"point":{"x":-300,"y":422.28,"z":55},"dir":{"x":1,"y":0,"z":0},"on":"c2","width_mm":19},{"kind":"spacing","segment":1,"t":1,"along_mm":450,"point":{"x":0,"y":422.28,"z":55},"dir":{"x":1,"y":0,"z":0},"on":"c2","width_mm":19},{"kind":"spacing","segment":3,"t":0.4,"along_mm":750,"point":{"x":300,"y":422.28,"z":55},"dir":{"x":1,"y":0,"z":0},"on":"c2","width_mm":19},{"kind":"breakout","segment":3,"t":0.9,"along_mm":875,"point":{"x":425,"y":422.28,"z":55},"dir":{"x":1,"y":0,"z":0},"on":"c2","width_mm":19}],"runs":[[0,900]],"straight":false,"few":false,"notes":[]},"length":{"metres":0.9},"ex":[{"id":"b1","number":1,"label":"","name":"Bundle 1","members":["c1","c2","c3","c4"],"drawn":true,"checked":true,"length_m":0.9,"straight":false,"few":false,"every":{"value":12,"unit":"in"},"straps":5,"strap_kinds":{"spacing":3,"breakout":2,"anchor":0},"strap_widths":{"19":5},"anchor_widths":{},"size_mm":13.4,"limit_mm":63.5,"limit_at":null,"limit_estimated":false,"bend_mm":null,"bend_by":null,"bend_checked":false,"warnings":[],"notes":["Bundle 1\'s bend is not checked: the cable types are not loaded."]}],"totals":{"spacing":3,"breakout":2,"anchor":0,"total":5,"widths":{"19":5}},"note":"Bundle 1 (b1): 4 cables (c1-c4), 0.9 m, 5 straps (3 every 12 in, 2 where a cable leaves); 13 mm across, limit 63.5 mm; bend not checked.","bom":[{"section":"Cables","qty":5,"manufacturer":"","model":"Hook-and-loop cable strap","description":"3 along 1 bundle, one every 12 in; 2 where a cable joins or leaves a bundle; 5 of 19 mm wide; length to suit","ref":""}]}';
test('a trunk of two or more nodes draws exactly as before the tie was added (#1017)', () => {
  const r = bundled(4, ALONG), ctx = {route: routeCtx(r)};
  const ex = X.bundleExports(r, ctx);
  const now = {straps: B.straps(r, r.bundles[0], ctx), length: B.trunkLength(r, r.bundles[0], ctx), ex, totals: B.strapTotals(r, ctx),
    note: X.bundleNote(ex[0]), bom: X.strapBomRows(ex)};
  assert.equal(JSON.stringify(now), GOLDEN);
});
