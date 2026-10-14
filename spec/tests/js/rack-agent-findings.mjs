// spec/tests/js/rack-agent-findings.mjs
// WHAT A PERSON SEES, TOLD TO AN AGENT (P-0018). The Warnings panel of the
// Rack Builder lists a ring a route would enter and leave by one face, a tight
// bend and a cord shorter than its route needs. `describe` carried the bends
// and the covered ports but not the other two; `inspect` carried no ring
// finding; `cable.lay` took a position past the cables that share a pathway;
// and a bend was named only by the two stops either side of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply} from '../../../kit/rack/commands.js';

const SIZES = {sw: {ru: 1, d: 515}, pp: {ru: 1, d: 100}, lacer: {ru: 1, d: 110, mount: 'rack-face', shell: 'sheet'}};
const chassisOf = ref => SIZES[ref] || null;
const add = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: 'x', ru, label: ref, ...extra}).rack;
// sw at U20 (i1), a lacer on it (i2), a patch panel at U30 (i3); the lacer has
// three rings, 100 mm apart, and the ports of i1 and i3 stand at x 0 and 100
const RINGS = [{via: 'guide-1', x: -150}, {via: 'guide-2', x: -50}, {via: 'guide-3', x: 50}];
const route = {chassisOf, bendOf: () => 25,
  guidesOf: id => (id === 'i2' ? RINGS.map(g => ({kind: 'ring', face: 'front', aperture: {w: 32, h: 29.5}, ...g})) : []),
  portX: end => ({i1: 0, i3: 100}[end.item] ?? null), portY: () => null};
const ctx = {chassisOf, route};
const ends = {a: {item: 'i1', path: 'p', view: 'front'}, b: {item: 'i3', path: 'q', view: 'front'}};
const cable = (id, via, extra = {}) => ({id, media: 'cat6', ...ends, route: via, routeEdited: true, ...extra});
const RING1 = {item: 'i2', via: 'guide-1'}, RING2 = {item: 'i2', via: 'guide-2'};
// the cable that enters and leaves ring 1 by one face: the port is right of it, and so is its lane
const DOUBLES = [RING1, {lane: 'right-front', ru: 20}, {lane: 'right-front', ru: 30}];
const rackOf = cables => ({...add(add(add(M.newRack(), 'sw', 20), 'lacer', 20, {on: 'i1', unit: 1}), 'pp', 30), cables});
const short = m => ({length: {value: m, unit: 'm', source: 'entered'}});
const findings = (r, rt = route) => Q.describe(r, {chassisOf, route: rt}).split('\n').find(l => l.startsWith('Findings:'));

// ── issue 4: the ring findings and the short cords, in describe and inspect ─

test('describe counts the rings entered and left by one face and the cords shorter than their route needs', () => {
  const r = rackOf([cable('c1', DOUBLES, short(0.3)), cable('c2', DOUBLES, short(0.2)), cable('c3', [RING2], short(5))]);
  // what the Warnings panel counts: a finding a ring, and a cord a cable
  const rings = R.ringFindings(r, route), cords = r.cables.filter(c => R.spareOf(r, c, route)?.spare_m < -1e-9);
  assert.deepEqual([rings.length, cords.length], [2, 2], 'the fixture has what the line must count');
  const line = findings(r);
  assert.match(line, /2 rings are entered and left by one face \(c1, c2\)/);
  // the worst is the one that falls shortest of what its route needs: c2, 0.2 m
  assert.match(line, /2 cords are shorter than their route needs \(the worst c2, \d+(\.\d+)? m short\)\.$/);
  assert.ok(line.indexOf('entered and left') < line.indexOf('tight bend') && line.indexOf('tight bend') < line.indexOf('shorter'), line);
  // a windowed reading carries the same line
  assert.ok(Q.describe(r, {chassisOf, route}, {section: 'cables', limit: 1}).split('\n').includes(line));
});

test('describe says one ring and one cord in the singular, and nothing when there is none', () => {
  const one = rackOf([cable('c1', DOUBLES, short(0.3))]);
  assert.match(findings(one), /^Findings: 1 ring is entered and left by one face \(c1\); .*; 1 cord is shorter than its route needs \(c1, \d+(\.\d+)? m short\)\.$/);
  const clean = rackOf([cable('c1', [RING2], short(5))]);
  assert.match(findings(clean) ?? '', /^(Findings: [^;]*tight bend[^;]*\.)?$/);
  assert.doesNotMatch(findings(clean) ?? '', /entered and left|shorter/);
  // the routes not known: no line at all
  assert.equal(Q.describe(one, {chassisOf}).includes('Findings:'), false);
  // a cable with no length has nothing bought: it is not short
  assert.doesNotMatch(findings(rackOf([cable('c1', DOUBLES)])), /shorter/);
});

test('inspect carries a cable\'s ring finding in the sentence ringFindings gives, and its short cord', async () => {
  const r = rackOf([cable('c1', DOUBLES, short(0.3)), cable('c2', [RING2])]);
  const label = id => r.items.find(i => i.id === id)?.label ?? id;
  const seen = await Q.inspect(r, 'c1', {chassisOf, route});
  const [f] = R.ringFindings(r, route, label);
  assert.deepEqual(seen.route.ring_findings, [{item: 'i2', via: 'guide-1', text: f.text}]);
  assert.match(f.text, /^c1 would enter and leave lacer ring 1 by the same face/);
  assert.deepEqual(seen.spare_findings.map(x => x.kind), ['spare-short']);
  assert.match(seen.spare_findings[0].text, /^c1 is 0\.3 m and needs /);
  // a cable with none has no key; nor has any when the routes are not known
  const clean = await Q.inspect(r, 'c2', {chassisOf, route});
  assert.deepEqual(['ring_findings' in clean.route, 'spare_findings' in clean], [false, false]);
  assert.equal('ring_findings' in (await Q.inspect(r, 'c1', {chassisOf})).route, false);
  // ringFindings and ringFindingsOf say the same sentence
  assert.deepEqual(R.ringFindingsOf(r, r.cables[0], route, label).map(x => x.text), [f.text]);
});

// ── issue 9: a bend is named at the stop where the cable turns ──────────────

test('a bend at a stop says where it turns, then the two stops either side', () => {
  const r = rackOf([cable('c1', DOUBLES)]);
  const label = id => r.items.find(i => i.id === id)?.label ?? id;
  const bends = R.bendFindingsOf(r, r.cables[0], route, label);
  const corner = bends.find(f => f.angle_deg === 90);
  assert.ok(corner, 'a 90 degree corner at the lane');
  assert.equal(corner.text, 'c1 turns 90 degrees at right-front U20, between lacer ring 1 and right-front U30, with room for a 5 mm bend; '
    + 'the cable (cat6) needs 25 mm, 20 mm short.');
  assert.deepEqual(corner.stop, {lane: 'right-front', ru: 20});
  // a corner that is no stop's, between a port and its first stop, names the two stops as before
  const lead = bends.find(f => f.turns);
  assert.ok(lead && !('stop' in lead));
  assert.match(lead.text, /^c1 turns twice within [\d.]+ mm between its port on sw and right-front U20 /);
  assert.doesNotMatch(lead.text, / at /);
});

test('a path read from the other end names the same stop', () => {
  const rev = {...cable('c1', [...DOUBLES].reverse()), a: ends.b, b: ends.a};
  const r = rackOf([rev]);
  const texts = R.bendFindingsOf(r, r.cables[0], route).map(f => f.text);
  assert.ok(texts.some(t => / at right-front U20, between right-front U30 and /.test(t)), texts.join('\n'));
});

// ── issue 7, kit side: cable.lay judges position and face against the pathway ─

const lay = (r, args) => apply(r, {op: 'cable.lay', id: 'c1', at: RING1, ...args}, {route});

test('cable.lay refuses a position past the cables that share the pathway', () => {
  // c1 and c2 pass through ring 1 (c1 goes through it and c2 the same way), c3 does not
  const two = (via) => rackOf([cable('c1', via), cable('c2', via), cable('c3', [RING2])]);
  const r = two([RING1, {lane: 'left-front', ru: 20}, {lane: 'left-front', ru: 30}]);
  assert.equal(R.fill(r, route).find(x => x.via === 'guide-1')?.count, 2, 'two cables share ring 1');
  assert.equal(lay(r, {position: 2}).error, undefined);
  assert.deepEqual(lay(r, {position: 2}).rack.cables[0].lay, [{item: 'i2', via: 'guide-1', position: 2}]);
  assert.equal(lay(r, {position: 1}).error, undefined);
  assert.match(lay(r, {position: 3}).error, /lacer guide-1 carries 2 cables, so a position there runs from 1 to 2; 3 is past it\./);
  // one cable alone: position 1 only
  const alone = rackOf([cable('c1', [RING1, {lane: 'left-front', ru: 20}, {lane: 'left-front', ru: 30}])]);
  assert.match(lay(alone, {position: 2}).error, /carries 1 cable, so a position there runs from 1 to 1; 2 is past it\./);
  assert.equal(lay(alone, {position: 1}).error, undefined);
  // a cable that does not use the pathway has no position in it
  assert.match(apply(r, {op: 'cable.lay', id: 'c3', at: RING1, position: 1}, {route}).error, /^c3 does not pass through lacer guide-1/);
  // unpinning is not judged
  const pinned = lay(r, {position: 2}).rack;
  assert.equal(apply(pinned, {op: 'cable.lay', id: 'c3', at: RING1, position: null}, {route}).noop, true);
  assert.equal(lay(pinned, {position: null}).error, undefined);
  // with no routes known it is recorded as given, as before
  assert.equal(apply(r, {op: 'cable.lay', id: 'c1', at: RING1, position: 9}, {}).error, undefined);
});

test('cable.lay refuses a face on a ring or a duct, as its description says, and says what it is', () => {
  const r = rackOf([cable('c1', [RING1, {lane: 'left-front', ru: 20}, {lane: 'left-front', ru: 30}])]);
  for (const face of ['top', 'underside']) assert.match(lay(r, {face}).error, /lacer guide-1 is a ring or a duct, not a tray: a cable has no face to lie on there\./, face);
  // a face to unpin is not refused
  assert.equal(lay(r, {face: null, position: 1}).error, undefined);
});
