// spec/tests/js/rack-spare-ducts.mjs
// SPARE IN A FINGER DUCT, AND A ZERO-U PART IN A ROUTE: a cable's spare is
// stored in a duct its route uses (a horizontal manager's, a rack-face
// bracket's, a vertical manager's beside the rack), counted against what the
// maker states; a ring, a pass-through, a pathway off the route and a name
// that is not there are refused with where the spare can go. A route names a
// zero-U part's duct and windows, and a pathway by its spoken name.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../kit/rack/route.js';
import * as SL from '../../../kit/rack/slack.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply, COMMANDS} from '../../../kit/rack/commands.js';
import {CAT} from './cable-solids-fixture.mjs';

// rack.json entries of the FS managers, as a build of the library gives them
// (solids and trays left out where a test does not need them)
const SIZES = {
  sw: {ru: 1, w: 440, h: 44, d: 300},
  'cmh-bs-sfds1u': {ru: 1, w: 435.2, h: 43.8, d: 70, model: 'CMH-BS-SFDS1U', manufacturer: 'FS.com', shell: 'sheet', default: 'base',
    ears: {default: {at: 70, name: 'proud'}}, guides: {front: ['duct']}, passes: {rear: ['pass-through-1', 'pass-through-2']},
    capacity: {count: 48, basis: 'Cat6 24AWG', media: 'cat6'}},
  'cmh-6dr1u': {ru: 1, w: 430, h: 44, d: 100, model: 'CMH-6DR1U', manufacturer: 'FS.com', shell: 'sheet', default: 'base',
    guides: {front: ['end-ring-left', 'end-ring-right', 'guide-1', 'guide-2', 'guide-3', 'guide-4']},
    rings: {'guide-1': {depth: 12.7, z: 44}, 'guide-2': {depth: 12.7, z: 44}, 'guide-3': {depth: 12.7, z: 44}, 'guide-4': {depth: 12.7, z: 44}},
    capacity: {count: 87, basis: 'Cat6', media: 'cat6'}},
  'cmh-dfd1u': {ru: 1, w: 433, h: 42, d: 174, model: 'CMH-DFD1U', manufacturer: 'FS.com', shell: 'sheet', default: 'base',
    guides: {front: ['front-duct'], rear: ['rear-duct']}, capacity: {count: 96, basis: 'Cat6', media: 'cat6'}},
  'cmv-5u3w': {...CAT['cmv-5u3w'], default: 'base', capacity: {count: 188, basis: 'Cat6', media: 'cat6'}},
  // the 45U vertical as the solids test has it: no capacity is stated
  'cmv-sfd45u5w': {...CAT['cmv-sfd45u5w'], default: 'base'},
};
const chassisOf = ref => SIZES[ref] || null;
const it = (id, ref, ru, label, extra = {}) => ({id, ref, cfg: 'base', label, ru, face: 'front', turned: false, swaps: {}, fields: {}, ...extra});
const end = item => ({item, path: 'p1', view: 'front'});
const cable = (id, a, b, route, extra = {}) => ({id, a: end(a), b: end(b), media: 'cat6', purpose: '', label: '', route,
  routeEdited: route.length > 0, length: {value: 2, unit: 'm', source: 'entered'}, ...extra});
const DUCT = {item: 'i3', via: 'duct'};
const VDUCT = {item: 'z1', via: 'duct'};
const DOWN = [{lane: 'right-front', ru: 30}, {lane: 'right-front', ru: 26}];

function rack(cables) {
  return {id: 'r1', name: 'Rack 1',
    frame: {kind: 'four-post', heightRU: 45, numbering: 'bottom-up', holes: {style: 'square', thread: null}, railDepth: 740, usableDepth: 1000, ref: null},
    items: [it('i1', 'sw', 30, 'sw-up'), it('i2', 'sw', 26, 'sw-dn'), it('i3', 'cmh-bs-sfds1u', 28, 'hm-1'),
            it('i4', 'cmh-6dr1u', 24, 'rings-1'), it('i5', 'cmv-5u3w', 32, 'bracket-1'), it('i6', 'cmh-dfd1u', 22, 'dual-1'),
            it('i7', 'sw', 10, 'far')],
    zeroU: [{id: 'z1', ref: 'cmv-sfd45u5w', cfg: 'base', label: 'vcm-1', at: 'right-front', offsetMm: 0}],
    cables: cables ?? [cable('c1', 'i1', 'i2', [DUCT]), cable('c2', 'i1', 'i2', DOWN), cable('c3', 'i1', 'i2', [DUCT], {length: undefined}),
                       cable('c4', 'i1', 'i2', [{item: 'i5', via: 'duct'}]), cable('c5', 'i7', 'i2', [{item: 'i4', via: 'guide-1'}])]};
}
// the guides as the page reads them off the drawings (route-context.js)
const RINGS = ['end-ring-left', 'guide-1', 'guide-2', 'guide-3', 'guide-4', 'end-ring-right'].map((via, k) => ({via, kind: 'ring', face: 'front',
  x: -200 + k * 80, run: via.startsWith('end') ? 'y' : 'x', aperture: {w: 40, h: 30}}));
const GUIDES = {i3: [{via: 'duct', kind: 'duct', face: 'front', x: 0, run: 'x'}], i4: RINGS,
  i5: [{via: 'duct', kind: 'duct', face: 'front', x: 0, run: 'y'}],
  i6: [{via: 'front-duct', kind: 'duct', face: 'front', x: 0, run: 'x'}, {via: 'rear-duct', kind: 'duct', face: 'rear', x: 0, run: 'x'}]};
const routeCtx = (over = {}) => ({chassisOf, guidesOf: id => GUIDES[id] ?? [], portX: () => -100, portY: () => null, ...over});
const ctxFor = (over = {}) => ({chassisOf, route: routeCtx(over)});
const run = (r, cmd, cx = ctxFor()) => apply(r, cmd, cx);

// ── the rule ─────────────────────────────────────────────────────────────

test('which pathways hold spare is one table: a duct and a tray do, a ring and a pass-through do not', () => {
  assert.deepEqual(SL.SPARE_HOLDS, {tray: true, duct: true, ring: false, pass: false});
  assert.deepEqual(['duct', 'tray', 'ring', 'pass', null, undefined].map(SL.holdsSpare), [true, true, false, false, false, false]);
});

// ── item 1: a place for spare ────────────────────────────────────────────

test('spare is stored in the duct of a horizontal manager the route uses, and counted against its stated capacity', async () => {
  const r = rack();
  const ok = run(r, {op: 'cable.slack', id: 'c1', at: DUCT});
  assert.equal(ok.error, undefined, ok.error);
  assert.equal(ok.summary, 'Stored the spare of c1 in hm-1 duct.');
  assert.deepEqual(ok.rack.cables[0].slack, [DUCT]);
  assert.deepEqual(ok.findings, []);
  // inspect: where it is, as a loop, and how full the duct is
  const got = await Q.inspect(ok.rack, 'c1', ctxFor());
  const [stored] = got.slack.stored;
  assert.deepEqual([stored.item, stored.via, stored.form, stored.ok, stored.kind], ['i3', 'duct', 'loop', true, 'duct']);
  // c1 and c3 run through it (two Cat6), and c1's loop lies along its 435 mm: ceil(metres / 0.4352) more
  const s = SL.slackOf(ok.rack, ok.rack.cables[0], routeCtx());
  const loops = Math.ceil(s.entries[0].metres / 0.4352);
  assert.ok(s.entries[0].metres > 0.4);
  assert.deepEqual(stored.load, {stated: true, compared: true, count: 2 + loops, capacity: 48, media: 'cat6', over: false});
  assert.deepEqual(got.spare_places, [{item: 'i3', via: 'duct', kind: 'duct'}]);
  // the stored text and describe say where it is
  assert.match(SL.storedText(ok.rack, ok.rack.cables[0], s), /^hm-1 duct, loop, \d\.\d+ m; 0\.2 m at the ends$/);
  assert.match(Q.describe(ok.rack, ctxFor()), /\nc1: .*, cat6, \d\.\d+ m spare in hm-1 duct\n/);
});

test('spare is stored in a vertical manager beside the rack and a rack-face bracket the route uses', () => {
  const r = rack();
  // c2 runs down the right-front lane, inside z1's duct; z1 states no capacity
  const z = run(r, {op: 'cable.slack', id: 'c2', at: VDUCT});
  assert.equal(z.error, undefined, z.error);
  assert.equal(z.summary, 'Stored the spare of c2 in vcm-1 duct.');
  assert.deepEqual(z.findings, [{kind: 'note', text: 'vcm-1 states no cable capacity, so the spare stored in it is not counted.'}]);
  assert.deepEqual(SL.slackFindings(z.rack, routeCtx()).filter(f => f.cable === 'c2').map(f => f.kind), ['spare-capacity-unstated']);
  // the CMV-5U3W, a rack-face part, by its duct
  const b = run(r, {op: 'cable.slack', id: 'c4', at: {item: 'i5', via: 'duct'}, value: 0.5});
  assert.equal(b.error, undefined, b.error);
  assert.deepEqual(b.rack.cables[3].slack, [{item: 'i5', via: 'duct', value: 0.5, unit: 'm'}]);
  // a tray and an end still work as before (rack-slack.mjs); an end needs no route
  assert.equal(run(r, {op: 'cable.slack', id: 'c2', at: {end: 'a'}}).error, undefined);
});

test('a ring, a pass-through, a duct off the route and a name not there are refused, saying where the spare can go', () => {
  const r = rack();
  const where = 'The spare of c1 can go in hm-1 duct, or at an end ({end: a} or {end: b}).';
  const err = at => run(r, {op: 'cable.slack', id: 'c1', at}).error;
  assert.equal(err({item: 'i3', via: 'zzz'}), `hm-1 has no pathway called zzz. ${where}`);
  assert.equal(err({item: 'i99', via: 'duct'}), `i99 is not in the rack. ${where}`);
  assert.equal(err({item: 'i3', via: 'pass-through-1'}), `hm-1 pass-through-1 is a pass-through, which holds no spare. ${where}`);
  assert.equal(err({item: 'i6', via: 'front-duct'}), `dual-1 front-duct is not on the route of c1. ${where}`);
  assert.equal(err(VDUCT), `vcm-1 duct is not on the route of c1. ${where}`);
  assert.equal(err({item: 'z1', via: 'pass-through-2'}), `vcm-1 pass-through-2 is a pass-through, which holds no spare. ${where}`);
  assert.equal(run(r, {op: 'cable.slack', id: 'c1', at: DUCT, form: 'spool'}).error, 'hm-1 duct is a duct, which holds no spool.');
  // a ring on the route of c5 is still a ring; and a route with no duct or tray says only its ends
  assert.equal(run(r, {op: 'cable.slack', id: 'c5', at: {item: 'i4', via: 'guide-1'}}).error,
    'rings-1 guide-1 is a ring, which holds no spare. The route of c5 has no tray or duct that holds spare, so its spare can go only at an end ({end: a} or {end: b}).');
  // with no routes known a place is recorded as given, but a name the catalogue does not list is refused
  assert.equal(run(r, {op: 'cable.slack', id: 'c1', at: {item: 'i6', via: 'front-duct'}}, {chassisOf}).error, undefined);
  assert.equal(run(r, {op: 'cable.slack', id: 'c1', at: {item: 'i3', via: 'zzz'}}, {chassisOf}).error, 'hm-1 has no pathway called zzz.');
  // an entry kept where it cannot be stored is a finding, and listed so
  const kept = {...r, cables: r.cables.map(c => (c.id === 'c1' ? {...c, slack: [{item: 'i4', via: 'guide-1'}]} : c))};
  assert.deepEqual(SL.slackFindings(kept, routeCtx()).filter(f => f.cable === 'c1'),
    [{kind: 'spare-off-route', cable: 'c1', text: 'rings-1 guide-1 is a ring, which holds no spare.'}]);
  assert.match(SL.storedText(kept, kept.cables[0], SL.slackOf(kept, kept.cables[0], routeCtx())), /^rings-1 guide-1, coil, \d\.\d+ m, where no spare is held;/);
});

test('a duct past the capacity its maker states is refused; one whose count names no cable is accepted with a finding', () => {
  const small = {...SIZES['cmh-bs-sfds1u'], capacity: {count: 3, basis: 'Cat6', media: 'cat6'}};
  const cx = (c = small) => ({chassisOf: ref => (ref === 'cmh-bs-sfds1u' ? c : chassisOf(ref)), route: routeCtx({chassisOf: ref => (ref === 'cmh-bs-sfds1u' ? c : chassisOf(ref))})});
  const r = rack();
  const no = run(r, {op: 'cable.slack', id: 'c1', at: DUCT}, cx());
  assert.match(no.error, /^hm-1 holds \d+ cat6 cables' worth with the spare stored in it, past the 3 its maker states\. Store less there, or in another duct or tray\. The spare of c1 can go in hm-1 duct, or at an end/);
  // a small loop fits: two cables through and one length of the duct
  assert.equal(run(r, {op: 'cable.slack', id: 'c1', at: DUCT, value: 0.3}, cx()).error, undefined);
  // a fibre cord is not counted against a count of Cat6
  const fibre = {...r, cables: r.cables.map(c => ({...c, media: 'om4'}))};
  assert.equal(run(fibre, {op: 'cable.slack', id: 'c1', at: DUCT}, cx()).error, undefined);
  // a count of no named cable is never compared
  const loose = run(r, {op: 'cable.slack', id: 'c1', at: DUCT}, cx({...small, capacity: {count: 3, basis: '', media: null}}));
  assert.equal(loose.error, undefined);
  assert.deepEqual(loose.findings.map(f => f.text), ['hm-1 states no cable capacity for a named kind of cable, so the spare stored in it is not counted.']);
});

test('spareMarks: the point a drawing puts each stored loop at, on its pathway', () => {
  let r = run(rack(), {op: 'cable.slack', id: 'c1', at: DUCT}).rack;
  r = run(r, {op: 'cable.slack', id: 'c2', at: VDUCT}).rack;
  const cx = routeCtx();
  const [h] = SL.spareMarks(r, r.cables[0], cx);
  assert.deepEqual([h.item, h.via, h.kind, h.form, h.run], ['i3', 'duct', 'duct', 'loop', 'x']);
  assert.deepEqual(h.at, R.pointOf(r, DUCT, cx));
  // in the vertical duct: at the middle of its run down the lane, U28 of U30-U26
  const [v] = SL.spareMarks(r, r.cables[1], cx);
  assert.deepEqual([v.item, v.run], ['z1', 'y']);
  assert.deepEqual(v.at, R.pointOf(r, {lane: 'right-front', ru: 28}, cx));
  // nothing for a cable that stores nowhere, or an end
  assert.deepEqual(SL.spareMarks(r, r.cables[3], cx), []);
});

// ── item 2: a zero-U part in a route ─────────────────────────────────────

test('a route names a zero-U duct: stored as written, resolved as the lane run through it', () => {
  const r = rack();
  const got = run(r, {op: 'cable.route', id: 'c2', route: [VDUCT]});
  assert.equal(got.error, undefined, got.error);
  assert.deepEqual(got.rack.cables[1].route, [VDUCT]);
  const cx = routeCtx();
  // from the unit of its a end to the unit of its b end, inside the part's span
  const ws = R.resolveRoute(got.rack, got.rack.cables[1], cx).waypoints;
  assert.deepEqual(ws, DOWN);
  // the same path as the lane form
  const lane = R.routePath(r, r.cables[1], cx).points, named = R.routePath(got.rack, got.rack.cables[1], cx).points;
  assert.deepEqual(named, lane);
  // a waypoint before it sets where it is entered
  const two = R.resolveRoute(r, {...r.cables[1], route: [{lane: 'right-front', ru: 35}, VDUCT]}, cx).waypoints;
  assert.deepEqual(two, [{lane: 'right-front', ru: 35}, {lane: 'right-front', ru: 26}]);
  // a window: the lane at the unit whose middle is nearest the window's
  // (pass-through-2 of the 45U part: 1673.4-1755.2 mm, middle 1714.3; U39's is 1711.3)
  const w = R.resolveRoute(r, {...r.cables[1], route: [{item: 'z1', via: 'pass-through-2'}, {lane: 'right-rear', ru: 39}]}, cx).waypoints;
  assert.deepEqual(w, [{lane: 'right-front', ru: 39}, {lane: 'right-rear', ru: 39}]);
  // a name it does not have is refused with what it has; an id beside the rack that is no pathway too
  assert.equal(run(r, {op: 'cable.route', id: 'c2', route: [{item: 'z1', via: 'tray'}]}).error,
    'Waypoint 1: vcm-1 has no ring, duct, pass-through or tray called tray. It has: duct, pass-through-1, pass-through-2, pass-through-3, pass-through-4, pass-through-5, pass-through-6, pass-through-7, pass-through-8.');
  assert.equal(run(r, {op: 'cable.route', id: 'c2', route: [{item: 'z9', via: 'duct'}]}).error, 'Waypoint 1 names z9, which is not in the rack.');
});

test('the {lane, ru} form is unchanged, and the route text says a lane run goes through a duct', async () => {
  const r = rack();
  const cx = routeCtx();
  assert.deepEqual(R.resolveRoute(r, r.cables[1], cx).waypoints, DOWN);
  const label = id => r.items.find(i => i.id === id)?.label ?? r.zeroU.find(z => z.id === id)?.label ?? id;
  assert.equal(R.routeText(DOWN, label, r.frame), 'right-front U30-U26');
  assert.equal(R.routeText(DOWN, label, r.frame, R.ductsThrough(r, chassisOf, label)), 'right-front U30-U26, through vcm-1 duct');
  assert.equal(R.routeText([{lane: 'left-front', ru: 30}], label, r.frame, R.ductsThrough(r, chassisOf, label)), 'left-front U30');
  assert.equal((await Q.inspect(r, 'c2', ctxFor())).route.text, 'right-front U30-U26, through vcm-1 duct');
});

// ── items 3 and 4: what a cable and a manager offer, and their names ────

test('inspect offers the pathways of standalone and zero-U managers near the route, and which hold spare', async () => {
  const r = rack();
  const c1 = await Q.inspect(r, 'c1', ctxFor());
  // its two switches have none; the managers within two units of U26-U30, and the duct beside the rack, do
  // (i6 at U22 is three units off)
  assert.deepEqual(Object.keys(c1.passes).sort(), ['i3', 'i4', 'i5', 'z1']);
  assert.deepEqual(c1.passes.i3, ['duct', 'pass-through-1', 'pass-through-2']);
  assert.equal(c1.passes.z1[0], 'duct');
  // a manager lists its pathways and which hold spare: as the routes know them, else the catalogue
  const rings = await Q.inspect(r, 'i4', ctxFor());
  assert.deepEqual(rings.pathways.map(p => [p.via, p.kind, p.holds_spare]),
    RINGS.map(g => [g.via, 'ring', false]));
  const hm = await Q.inspect(r, 'i3', {chassisOf});
  assert.deepEqual(hm.pathways, [{via: 'duct', kind: 'duct', holds_spare: true},
    {via: 'pass-through-1', kind: 'pass', holds_spare: false}, {via: 'pass-through-2', kind: 'pass', holds_spare: false}]);
  assert.deepEqual((await Q.inspect(r, 'i6', {chassisOf})).pathways.map(p => [p.via, p.holds_spare]), [['front-duct', true], ['rear-duct', true]]);
  assert.deepEqual((await Q.inspect(r, 'i4', {chassisOf})).pathways.find(p => p.via === 'end-ring-left'), {via: 'end-ring-left', kind: 'ring', holds_spare: false});
});

test('a route names a ring by its number, an end ring in words, and a duct by its common name; the id is stored', () => {
  const r = rack();
  const routed = route => run(r, {op: 'cable.route', id: 'c5', route});
  assert.deepEqual(routed([{item: 'i4', via: 'ring 1'}, {item: 'i4', via: 'left end ring'}, {item: 'i4', via: 'end ring right'}]).rack.cables[4].route,
    [{item: 'i4', via: 'guide-1'}, {item: 'i4', via: 'end-ring-left'}, {item: 'i4', via: 'end-ring-right'}]);
  assert.deepEqual(routed([{item: 'i6', via: 'duct'}, {item: 'i6', via: 'duct-rear'}]).rack.cables[4].route,
    [{item: 'i6', via: 'front-duct'}, {item: 'i6', via: 'rear-duct'}]);
  assert.deepEqual(routed([{item: 'i3', via: 'front-duct'}, {item: 'z1', via: 'pass-through 2'}]).rack.cables[4].route,
    [{item: 'i3', via: 'duct'}, {item: 'z1', via: 'pass-through-2'}]);
  assert.match(routed([{item: 'i4', via: 'ring 9'}]).error, /^Waypoint 1: rings-1 has no ring, duct, pass-through or tray called ring 9\. It has: /);
  // the summary says them the same way
  const label = id => r.items.find(i => i.id === id)?.label ?? id;
  assert.equal(R.routeText([{item: 'i4', via: 'guide-1'}, {item: 'i4', via: 'end-ring-left'}, {item: 'i6', via: 'rear-duct'}], label),
    'rings-1 ring 1 > rings-1 left end ring > dual-1 rear-duct');
  // and cable.slack takes the same names
  const s = run({...r, cables: r.cables.map(c => (c.id === 'c1' ? {...c, route: [{item: 'i6', via: 'front-duct'}]} : c))},
    {op: 'cable.slack', id: 'c1', at: {item: 'i6', via: 'duct'}});
  assert.equal(s.error, undefined, s.error);
  assert.deepEqual(s.rack.cables[0].slack, [{item: 'i6', via: 'front-duct'}]);
  assert.deepEqual(R.pathwayId(['duct', 'duct-rear'], 'rear-duct'), 'duct-rear');
  assert.deepEqual(R.pathwayId(['guide-1'], 'ring-1'), 'guide-1');
  assert.equal(R.pathwayId(['duct'], 'rear duct'), null);
});

test('the tool descriptions say where spare can go, and that a route can name a part beside the rack', () => {
  const d = COMMANDS['cable.slack'].description;
  for (const w of ['finger duct', 'tray', 'end', 'ring', 'pass-through', 'capacity']) assert.ok(d.includes(w), w);
  assert.match(COMMANDS['cable.route'].description, /beside the rack: its duct/);
  assert.match(COMMANDS['cable.route'].args.properties.route.description, /beside the rack/);
});

// ── what a tester found through the Rack Builder preview (P-0026) ────────

const withLength = (r, id, value) => ({...r, cables: r.cables.map(c => (c.id === id ? {...c, length: {value, unit: 'm', source: 'entered'}} : c))});
const spareOf = (r, id) => SL.slackOf(r, r.cables.find(c => c.id === id), routeCtx()).spare.spare_m;

test('an amount larger than the cable\'s spare is refused, and any stored spare on a short cable', () => {
  const r = rack();
  const spare = spareOf(r, 'c1');
  assert.ok(spare > 0.5 && spare < 3);
  const big = run(r, {op: 'cable.slack', id: 'c1', at: DUCT, value: 5});
  assert.equal(big.error, `c1 has only ${SL.mText(spare)} of spare, so storing 5 m is more than it has.`);
  // in feet, and at an end
  assert.match(run(r, {op: 'cable.slack', id: 'c1', at: DUCT, value: 20, unit: 'ft'}).error, /^c1 has only \d\.\d+ m of spare, so storing 6\.1 m is more than it has\.$/);
  assert.match(run(r, {op: 'cable.slack', id: 'c1', at: {end: 'a'}, value: 5}).error, /^c1 has only /);
  // what it has fits; and with another amount stored already, the two together are counted
  const fits = run(r, {op: 'cable.slack', id: 'c1', at: DUCT, value: 0.3});
  assert.equal(fits.error, undefined, fits.error);
  const two = run(fits.rack, {op: 'cable.slack', id: 'c1', at: {end: 'a'}, value: spare});
  assert.equal(two.error, `c1 has only ${SL.mText(spare)} of spare and 0.3 m of it is stored already, so storing ${SL.mText(spare)} more is too much.`);
  // by default the place takes what is left to store: never more than the spare
  const dflt = run(r, {op: 'cable.slack', id: 'c1', at: DUCT});
  assert.equal(dflt.error, undefined, dflt.error);
  const s = SL.slackOf(dflt.rack, dflt.rack.cables[0], routeCtx());
  assert.ok(s.entries[0].metres <= spare + 1e-9 && s.over_m === 0);
  // a short cable stores nothing, whether or not it says how much
  const short = withLength(r, 'c1', 0.3);
  const lack = -spareOf(short, 'c1');
  assert.ok(lack > 0);
  const msg = `c1 is ${SL.mText(lack)} short of what its route needs, so it has no spare to store.`;
  for (const cmd of [{at: DUCT}, {at: DUCT, value: 0.1}, {at: {end: 'b'}}, {at: {end: 'a'}, value: 0.1}])
    assert.equal(run(short, {op: 'cable.slack', id: 'c1', ...cmd}).error, msg);
  // a routed length is no limit: it grows by what is stored
  const routed = {...r, cables: r.cables.map(c => (c.id === 'c1' ? {...c, length: {value: 1, unit: 'm', source: 'routed'}} : c))};
  assert.equal(run(routed, {op: 'cable.slack', id: 'c1', at: DUCT, value: 5}).error, undefined);
  // without routes nothing can be judged, and it is recorded as given
  assert.equal(run(r, {op: 'cable.slack', id: 'c1', at: DUCT, value: 5}, {chassisOf}).error, undefined);
});

test('spare can go in a duct the route passes through by a lane run, in the list and in a refusal', async () => {
  // a vertical part of 8 units on the right-front lane, and routes that pass it
  const short = {...SIZES['cmv-sfd45u5w'], ru: 8, h: 8 * 44.45};
  const cs = ref => (ref === 'cmv-sfd45u5w' ? short : chassisOf(ref));
  const cx = {chassisOf: cs, route: routeCtx({chassisOf: cs})};
  const r = rack([
    cable('c1', 'i1', 'i2', [{lane: 'right-front', ru: 44}, {lane: 'right-front', ru: 5}]),
    cable('c2', 'i1', 'i2', [{lane: 'right-front', ru: 44}, {item: 'i3', via: 'duct'}, {lane: 'right-front', ru: 5}]),
    cable('c3', 'i1', 'i2', [{lane: 'right-front', ru: 44}, {lane: 'right-rear', ru: 20}, {lane: 'right-front', ru: 2}]),
  ]);
  const z = {...r.zeroU[0], offsetMm: 20 * 44.45};
  const rr = {...r, zeroU: [z]};
  const places = async id => (await Q.inspect(rr, id, cx)).spare_places;  const [lo, hi] = [z.offsetMm, z.offsetMm + short.h];
  assert.ok(lo > 0 && hi < 45 * 44.45);
  // c1 runs from above the part to below it: through the duct with no waypoint in it
  assert.deepEqual(await places('c1'), [{item: 'z1', via: 'duct', kind: 'duct'}]);
  assert.match(run(rr, {op: 'cable.slack', id: 'c1', at: {item: 'i3', via: 'duct'}}, cx).error, /The spare of c1 can go in vcm-1 duct, or at an end/);
  // a route that names the duct is the same run
  const named = run(rr, {op: 'cable.route', id: 'c2', route: [{item: 'z1', via: 'duct'}]}, cx);
  assert.deepEqual(await places('c1'), (await Q.inspect(named.rack, 'c2', cx)).spare_places);
  // crossing to the rear lane first, the front lane is not run along
  assert.deepEqual(await places('c3'), []);
});

test('the route text names a window of a part beside the rack, as it names a duct', async () => {
  const r = rack();
  const w = run(r, {op: 'cable.route', id: 'c2', route: [{lane: 'right-front', ru: 39}, {item: 'z1', via: 'pass-through 5'}, {lane: 'right-rear', ru: 38}]});
  assert.equal(w.error, undefined, w.error);
  const text = (await Q.inspect(w.rack, 'c2', ctxFor())).route.text;
  assert.match(text, /^right-front U39-U\d+, through vcm-1 duct and vcm-1 pass-through-5 > right-rear U38$/);
  // a window is named only where the route names it
  assert.equal((await Q.inspect(r, 'c2', ctxFor())).route.text, 'right-front U30-U26, through vcm-1 duct');
  assert.deepEqual(R.windowsOf(w.rack, w.rack.cables[1], routeCtx()).map(m => [m.item, m.via, m.lane]), [['z1', 'pass-through-5', 'right-front']]);
  assert.deepEqual(R.windowsOf(r, r.cables[1], routeCtx()), []);
  assert.equal(R.routeText(DOWN, id => id, r.frame, R.ductsThrough(r, chassisOf, id => id, [{item: 'z1', via: 'pass-through-5', lane: 'right-front', ru: 28}])),
    'right-front U30-U26, through z1 duct and z1 pass-through-5');
});

test('a summary names a vertical beside the rack by its label, and by its id where two share one', async () => {
  const one = rack();
  assert.equal((await Q.inspect(one, 'c2', ctxFor())).route.text, 'right-front U30-U26, through vcm-1 duct');
  // two verticals of one model: the label alone does not say which
  const two = {...one, zeroU: [...one.zeroU, {id: 'z2', ref: 'cmv-sfd45u5w', cfg: 'base', label: 'vcm-1', at: 'left-front', offsetMm: 0}],
    cables: [...one.cables, cable('c6', 'i1', 'i2', [{lane: 'left-front', ru: 30}, {lane: 'left-front', ru: 26}])]};
  assert.equal((await Q.inspect(two, 'c2', ctxFor())).route.text, 'right-front U30-U26, through vcm-1 (z1) duct');
  assert.equal((await Q.inspect(two, 'c6', ctxFor())).route.text, 'left-front U30-U26, through vcm-1 (z2) duct');
  const w = run(two, {op: 'cable.route', id: 'c6', route: [{lane: 'left-front', ru: 30}, {item: 'z2', via: 'pass-through-5'}, {lane: 'left-rear', ru: 20}]});
  assert.match((await Q.inspect(w.rack, 'c6', ctxFor())).route.text, /through vcm-1 \(z2\) duct and vcm-1 \(z2\) pass-through-5/);
  // and the capacity sentences say the same
  assert.equal(SL.loadText(two, 'z1', {stated: false}), 'vcm-1 (z1) states no cable capacity, so the spare stored in it is not counted.');
});

test('a fibre cable is not counted against a Cat6 figure, and the count is worded in the singular', () => {
  const small = n => ({...SIZES['cmh-bs-sfds1u'], capacity: {count: n, basis: 'Cat6 24AWG', media: 'cat6'}});
  const cxn = n => { const c = small(n), ch = ref => (ref === 'cmh-bs-sfds1u' ? c : chassisOf(ref)); return {chassisOf: ch, route: routeCtx({chassisOf: ch})}; };
  // c1 is Cat6 and c3 is fibre; both run through the duct, and the figure is a count of Cat6
  const r = rack();
  const fibre = {...r, cables: r.cables.map(c => (c.id === 'c3' ? {...c, media: 'om4', length: {value: 2, unit: 'm', source: 'entered'}} : c))};
  const ok = run(fibre, {op: 'cable.slack', id: 'c3', at: DUCT}, cxn(1));
  assert.equal(ok.error, undefined, ok.error);
  assert.deepEqual(ok.findings.map(f => f.text),
    ['hm-1 states its cable capacity for cat6 cables, and fibre (om4) is not counted against a cat6 figure, so the spare stored in it is not counted.']);
  const load = SL.spareLoad(ok.rack, 'i3', cxn(1).route, ok.rack.cables[2]);
  assert.deepEqual([load.stated, load.compared, load.notCounted], [true, false, true]);
  // a Cat6 cable is counted, and a duct past its count by the other cables is not blamed on the fibre one
  const full = run(fibre, {op: 'cable.slack', id: 'c1', at: DUCT}, cxn(1));
  assert.match(full.error, /^hm-1 holds \d cat6 cables' worth with the spare stored in it, past the 1 its maker states\./);
  const full2 = run(ok.rack, {op: 'cable.slack', id: 'c1', at: DUCT, value: 0.2}, cxn(1));
  assert.match(full2.error, /^hm-1 holds \d cat6 cables' worth/);
  assert.equal(run(fibre, {op: 'cable.slack', id: 'c3', at: DUCT}, cxn(0)).error, undefined);
  const over = SL.slackFindings(ok.rack, cxn(1).route).filter(f => f.cable === 'c3');
  assert.deepEqual(over.map(f => f.kind), ['spare-capacity-unstated']);
  assert.match(over[0].text, /fibre \(om4\) is not counted against a cat6 figure/);
  // the plural
  assert.equal(SL.loadText(r, 'i3', {compared: true, count: 1, capacity: 0, media: 'cat6'}), "hm-1 holds 1 cat6 cable's worth with the spare stored in it, past the 0 its maker states.");
  assert.equal(SL.loadText(r, 'i3', {compared: true, count: 2, capacity: 1, media: 'cat6'}), "hm-1 holds 2 cat6 cables' worth with the spare stored in it, past the 1 its maker states.");
  assert.equal(SL.loadText(r, 'i3', {compared: true, count: 1, capacity: 0, media: null}), "hm-1 holds 1 cable's worth with the spare stored in it, past the 0 its maker states.");
  // a maker that states none stays as it was
  assert.equal(SL.loadText(r, 'z1', {stated: false}), 'vcm-1 states no cable capacity, so the spare stored in it is not counted.');
});
