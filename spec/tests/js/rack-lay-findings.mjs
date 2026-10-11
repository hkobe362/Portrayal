// spec/tests/js/rack-lay-findings.mjs
// What the lay finds, where a reader of a rack looks for it (#1007): a tight
// bend (#973) and a span in front of other ports (#1013) in `inspect`, in
// `describe` and in the notes of the exports; and one finding a corner. On
// the rack of short hops (bundle-hops-fixture.mjs), its cords taken as 60 mm
// bend radius where a tight bend is wanted (as Cat 6 at 24 mm it has none).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as RP from '../../../kit/rack/route-path.js';
import * as Q from '../../../kit/rack/queries.js';
import * as X from '../../../kit/rack/export-data.js';
import * as HOPS from './bundle-hops-fixture.mjs';

const nameOf = r => id => r.items.find(i => i.id === id)?.label ?? id;
const stiff = (r, extra = {}) => HOPS.ctxFor(r, {bendOf: () => 60, ...extra});
const allPorts = r => ({portBoxesOf: id => HOPS.portsOf(r, id)});

test('inspect carries a cable\'s tight bends and the ports it covers, in the sentences the findings give', async () => {
  const r = HOPS.bundled(), route = stiff(r), ctx = {chassisOf: HOPS.chassisOf, route};
  const info = await Q.inspect(r, 'c7', ctx);
  const bends = R.bendFindings(r, route, nameOf(r)).filter(f => f.cable === 'c7');
  assert.equal(bends.length, 2);
  assert.deepEqual(info.route.bends, bends.map(({kind, cable, ...f}) => f));
  assert.equal(info.route.bends[1].text, 'c7 turns 96.6 degrees between left-front U42 and its port on MGMT-SW1 with room for an 11.6 mm bend; '
    + 'the cable (cat6) needs 60 mm, 48.4 mm short.');
  // the ports it covers, as Cat 6 at its own radius; the route context lists
  // no ports, and the finding says which were there to judge
  const soft = HOPS.ctxFor(r);
  const cover = R.coverFindings(r, soft, nameOf(r)).find(f => f.cable === 'c7');
  const seen = (await Q.inspect(r, 'c7', {chassisOf: HOPS.chassisOf, route: soft})).route;
  assert.deepEqual(seen.covers, {count: 2, ports: cover.ports, between: cover.between, judged: 'cabled', estimated: true, text: cover.text});
  assert.match(seen.covers.text, /^c7 crosses in front of port-\d+ and port-\d+ on MGMT-SW1 .* Only ports that hold a cable were judged\.$/);
  assert.equal('bends' in seen, false);
  // a page that lists every port: all were judged, at their stated sizes
  const listed = (await Q.inspect(r, 'c7', {chassisOf: HOPS.chassisOf, route: HOPS.ctxFor(r, allPorts(r))})).route.covers;
  assert.deepEqual([listed.judged, 'estimated' in listed, listed.text.includes('Only ports'), listed.count], ['all', false, false, 15]);
  // a cable with neither has neither key; nor has any cable when the routes are not known
  const none = await Q.inspect(r, 'c1', {chassisOf: HOPS.chassisOf, route: soft});
  assert.deepEqual(['bends' in none.route, 'covers' in none.route], [false, false]);
  const blind = await Q.inspect(r, 'c7', {chassisOf: HOPS.chassisOf});
  assert.deepEqual(['bends' in blind.route, 'covers' in blind.route], [false, false]);
  // a reader that throws leaves it not measured, never an error
  const broken = await Q.inspect(r, 'c7', {chassisOf: HOPS.chassisOf, route: {...route, portX: () => { throw new Error('no face'); }}});
  assert.deepEqual([broken.routed, 'bends' in broken.route, 'covers' in broken.route], [null, false, false]);
});

test('describe counts each kind of finding, names the worst, and says when only cabled ports were judged', () => {
  const r = HOPS.bundled();
  const line = (rack, ctx) => Q.describe(rack, {chassisOf: HOPS.chassisOf, route: ctx}).split('\n').find(l => l.startsWith('Findings:'));
  assert.equal(line(r, HOPS.ctxFor(r)), 'Findings: 6 cables cross in front of other ports (the most c7, 2 ports; only ports that hold a cable were judged).');
  assert.equal(line(r, stiff(r)), 'Findings: 11 cables have a tight bend (the worst c1, 49.3 mm short); '
    + '1 cable crosses in front of other ports (c11, 2 ports; only ports that hold a cable were judged).');
  assert.equal(line(r, stiff(r, allPorts(r))), 'Findings: 11 cables have a tight bend (the worst c1, 49.3 mm short); '
    + '11 cables cross in front of other ports (the most c1, 11 ports).');
  // a windowed reading carries the same line
  assert.ok(Q.describe(r, {chassisOf: HOPS.chassisOf, route: stiff(r)}, {section: 'cables', limit: 2}).split('\n').includes(line(r, stiff(r))));
  // one cable: no "worst" to name
  const one = {...r, cables: r.cables.slice(6, 7), bundles: []};
  assert.equal(line(one, stiff(one)), 'Findings: 1 cable has a tight bend (c7, 48.4 mm short).');
  // with a manager on every switch no span is in front of a port, and the line does not say one is
  const m = HOPS.managed();
  assert.ok(!Q.describe(m, {chassisOf: HOPS.chassisOf, route: HOPS.ctxFor(m)}).includes('in front of other ports'));
  // no routes, no line
  assert.ok(!Q.describe(r, {chassisOf: HOPS.chassisOf}).includes('Findings:'));
});

test('the cable schedule and a file\'s notes carry one sentence a cable for its bends and one for its ports', () => {
  const r = HOPS.bundled(), route = stiff(r);
  const bends = R.bendFindings(r, route, nameOf(r)), covers = R.coverFindings(r, HOPS.ctxFor(r), nameOf(r));
  const {columns, rows} = X.cableScheduleRows(r, new Map(), r.items, null, {bends, covers});
  assert.deepEqual(columns, X.CABLE_COLUMNS);                    // the same columns: the sentences join `notes`
  assert.equal(rows[6].notes, 'c7 has 2 corners with less room than the cable needs; the tightest turns 96.6 degrees between left-front U42 '
    + 'and its port on MGMT-SW1 with room for an 11.6 mm bend; the cable (cat6) needs 60 mm, 48.4 mm short. '
    + covers.find(f => f.cable === 'c7').text);
  assert.ok(rows[6].notes.endsWith('Only ports that hold a cable were judged.'));
  // a cable with one tight bend gets that finding's own sentence
  const single = bends.filter(f => f.cable === 'c7').slice(0, 1);
  assert.deepEqual(X.layNotesOf('c7', {bends: single}), [single[0].text]);
  // not asked for, not written
  assert.equal(X.cableScheduleRows(r, new Map(), r.items).rows[6].notes, '');
  assert.deepEqual(X.layNotesOf('c7'), []);
  // a file's notes: one line a cable, only for the cables with something found
  const lines = X.layNotes(r, {bends, covers});
  assert.equal(lines.length, 11);
  assert.equal(lines[6], rows[6].notes);
  assert.deepEqual(X.layNotes(r, {covers}).map(l => l.split(' ')[0]), ['c5', 'c7', 'c8', 'c9', 'c10', 'c11']);
  assert.deepEqual(X.layNotes(r), []);
});

test('corners at one point are one finding: a cord through a ring of almost no depth', () => {
  // A manager whose one ring is 0.02 mm deep along its run. The cord turns as
  // it enters and again as it leaves, 0.02 mm on: two corners of the path,
  // each with only that 0.02 mm between them for room.
  const m = HOPS.managed();
  const ctx = HOPS.ctxFor(m, {bendOf: () => 60, guidesOf: id => (m.items.find(i => i.id === id)?.ref === 'mgr'
    ? [{via: 'guide-3', kind: 'ring', face: 'front', x: -100, depth: 0.02}] : [])});
  const hand = {...m.cables[0], route: [{item: 'm1', via: 'guide-3'}], routeEdited: true};
  const r = {...m, cables: [hand]};
  const path = R.routePath(r, hand, ctx);
  assert.deepEqual(path.findings, []);
  const tenth = p => [p.x, p.y, p.z].map(v => Math.round(v * 10) / 10).join(',');
  const raw = RP.cornersOf(path.points, {share: 'need'}).filter(c => c.room_mm < 60);
  // the measure sees both, at one place to the tenth of a millimetre a finding gives
  assert.deepEqual(raw.map(c => [path.points[c.k].at, c.room_mm]), [['entry', 0.1], ['exit', 0.1]]);
  assert.equal(tenth(path.points[raw[0].k]), tenth(path.points[raw[1].k]));
  // the path reports one: the turn from the leg in to the leg out, the two
  // outer legs, the least room
  assert.deepEqual(path.bends.map(f => [f.point, f.at, f.angle_deg, f.legs_mm, f.room_mm, f.short_mm]),
    [['entry', [-100, 1844.7, 55], 21.3, [135.3, 105.1], 0.1, 59.9]]);
  assert.equal(R.bendFindings(r, ctx, nameOf(r)).length, 1);
  // no path's bends name one place twice
  const b = HOPS.bundled(), route = stiff(b);
  for (const c of b.cables) {
    const at = R.routePath(b, c, route).bends.map(f => f.at.join(','));
    assert.equal(new Set(at).size, at.length, c.id);
  }
  // the merge is the path's own business, not a name of the kit
  assert.deepEqual([RP.mergeCorners, R.mergeCorners], [undefined, undefined]);
});
