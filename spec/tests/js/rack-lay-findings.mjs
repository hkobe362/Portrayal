// spec/tests/js/rack-lay-findings.mjs
// What the lay finds, where a reader of a rack looks for it (#1007): a tight
// bend (#973) and a span in front of other ports (#1013) in `inspect`, in
// `describe` and in the notes of the exports; and one finding a corner. On
// the rack of short hops (bundle-hops-fixture.mjs), its cords taken as 60 mm
// bend radius where a tight bend is wanted (as Cat 6 at 24 mm it has none).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as Q from '../../../kit/rack/queries.js';
import * as X from '../../../kit/rack/export-data.js';
import {cornersOf, mergeCorners} from '../../../kit/rack/route-path.js';
import * as HOPS from './bundle-hops-fixture.mjs';

const nameOf = r => id => r.items.find(i => i.id === id)?.label ?? id;
const stiff = r => HOPS.ctxFor(r, {bendOf: () => 60});

test('inspect carries a cable\'s tight bends and the ports it covers, in the sentences the findings give', async () => {
  const r = HOPS.bundled(), route = stiff(r), ctx = {chassisOf: HOPS.chassisOf, route};
  const info = await Q.inspect(r, 'c3', ctx);
  const bends = R.bendFindings(r, route, nameOf(r)).filter(f => f.cable === 'c3');
  assert.equal(bends.length, 2);
  assert.deepEqual(info.route.bends, bends.map(({kind, cable, ...f}) => f));
  assert.equal(info.route.bends[1].text, 'c3 turns 99 degrees between left-front U42 and its port on MGMT-SW1 with room for an 11.1 mm bend; '
    + 'the cable (cat6) needs 60 mm, 48.9 mm short.');
  const cover = R.coverFindings(r, route, nameOf(r)).find(f => f.cable === 'c3');
  assert.deepEqual(info.route.covers, {ports: cover.ports, between: cover.between, text: cover.text});
  assert.match(info.route.covers.text, /^c3 crosses in front of port-1 on MGMT-SW1 /);
  // a cable with neither has neither key; nor has any cable when the routes are not known
  const soft = await Q.inspect(r, 'c1', {chassisOf: HOPS.chassisOf, route: HOPS.ctxFor(r)});
  assert.deepEqual(['bends' in soft.route, 'covers' in soft.route], [false, false]);
  const blind = await Q.inspect(r, 'c3', {chassisOf: HOPS.chassisOf});
  assert.deepEqual(['bends' in blind.route, 'covers' in blind.route], [false, false]);
  // a reader that throws leaves it not measured, never an error
  const broken = await Q.inspect(r, 'c3', {chassisOf: HOPS.chassisOf, route: {...route, portX: () => { throw new Error('no face'); }}});
  assert.deepEqual([broken.routed, 'bends' in broken.route, 'covers' in broken.route], [null, false, false]);
});

test('describe counts each kind of finding and names the worst', () => {
  const r = HOPS.bundled();
  const line = ctx => Q.describe(r, {chassisOf: HOPS.chassisOf, route: ctx}).split('\n').find(l => l.startsWith('Findings:'));
  assert.equal(line(HOPS.ctxFor(r)), 'Findings: 9 cables cross in front of other ports (the most c7, 5 ports).');
  assert.equal(line(stiff(r)), 'Findings: 11 cables have a tight bend (the worst c1, 49.3 mm short); '
    + '9 cables cross in front of other ports (the most c10, 6 ports).');
  // a windowed reading carries the same line
  assert.ok(Q.describe(r, {chassisOf: HOPS.chassisOf, route: stiff(r)}, {section: 'cables', limit: 2}).split('\n').includes(line(stiff(r))));
  // one cable: no "worst" to name
  const one = {...r, cables: r.cables.slice(2, 3), bundles: []};
  assert.equal(Q.describe(one, {chassisOf: HOPS.chassisOf, route: stiff(one)}).split('\n').find(l => l.startsWith('Findings:')),
    'Findings: 1 cable has a tight bend (c3, 48.9 mm short).');
  // with a manager on every switch no span is in front of a port, and the line does not say one is
  const m = HOPS.managed();
  assert.ok(!Q.describe(m, {chassisOf: HOPS.chassisOf, route: HOPS.ctxFor(m)}).includes('in front of other ports'));
  // no routes, no line
  assert.ok(!Q.describe(r, {chassisOf: HOPS.chassisOf}).includes('Findings:'));
});

test('the cable schedule and a file\'s notes carry one sentence a cable for its bends and one for its ports', () => {
  const r = HOPS.bundled(), route = stiff(r);
  const bends = R.bendFindings(r, route, nameOf(r)), covers = R.coverFindings(r, route, nameOf(r));
  const {columns, rows} = X.cableScheduleRows(r, new Map(), r.items, null, {bends, covers});
  assert.deepEqual(columns, X.CABLE_COLUMNS);                    // the same columns: the sentences join `notes`
  assert.equal(rows[2].notes, 'c3 has 2 corners with less room than the cable needs; the tightest turns 99 degrees between left-front U42 '
    + 'and its port on MGMT-SW1 with room for an 11.1 mm bend; the cable (cat6) needs 60 mm, 48.9 mm short. '
    + covers.find(f => f.cable === 'c3').text);
  // a cable with one tight bend gets that finding's own sentence
  const single = bends.filter(f => f.cable === 'c3').slice(0, 1);
  assert.deepEqual(X.layNotesOf('c3', {bends: single}), [single[0].text]);
  // not asked for, not written
  assert.equal(X.cableScheduleRows(r, new Map(), r.items).rows[2].notes, '');
  assert.deepEqual(X.layNotesOf('c3'), []);
  // a file's notes: one line a cable, only for the cables with something found
  const lines = X.layNotes(r, {bends, covers});
  assert.equal(lines.length, 11);
  assert.equal(lines[2], rows[2].notes);
  assert.deepEqual(X.layNotes(r, {covers: R.coverFindings(r, HOPS.ctxFor(r), nameOf(r))}).map(l => l.split(' ')[0]),
    ['c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11']);
  assert.deepEqual(X.layNotes(r), []);
});

test('corners at one point are one corner', () => {
  // a right angle whose corner is two points 0.02 mm apart: cornersOf sees a turn at each
  const pts = [{x: 0, y: 0, z: 0}, {x: 100, y: 0, z: 0}, {x: 100.015, y: 0.015, z: 0}, {x: 100.015, y: 100, z: 0}];
  const raw = cornersOf(pts, {share: 'need'});
  assert.deepEqual(raw.map(c => [c.k, c.angle_deg]), [[1, 45], [2, 45]]);
  assert.deepEqual(raw.map(c => c.room_mm), [0, 0]);              // each has only the 0.02 mm between them
  const merged = mergeCorners(pts, raw);
  assert.deepEqual(merged, [{k: 1, angle_deg: 90, legs_mm: [100, 100], room_mm: 0}]);
  // corners apart are left as they are, and so is an empty list
  const apart = [{x: 0, y: 0, z: 0}, {x: 100, y: 0, z: 0}, {x: 100, y: 50, z: 0}, {x: 0, y: 50, z: 0}];
  assert.deepEqual(mergeCorners(apart, cornersOf(apart)), cornersOf(apart));
  assert.deepEqual(mergeCorners(pts, []), []);
  // a path's bends never name one place twice
  const r = HOPS.bundled(), route = stiff(r);
  for (const c of r.cables) {
    const at = R.routePath(r, c, route).bends.map(f => f.at.join(','));
    assert.equal(new Set(at).size, at.length, c.id);
  }
});
