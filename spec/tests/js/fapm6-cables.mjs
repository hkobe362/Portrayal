// spec/tests/js/fapm6-cables.mjs
// THE TWO LOADED FAPM6 PANELS AGAINST THE RACK KIT: an FS FHD-1UBE with the
// RJ45 panel (fs/fhd-fapm6-rj45@1) in bay-1 and the blank panel
// (fs/fhd-fapm6-blank@1) in bay-2, built from the real components.json and
// fhd-1ube.configs.json under PORTRAYAL_DIST (library/dist).
//
// Held here: the panels seat in a 1UBE bay; the kit lists the RJ45 panel's six
// ports as cable ends and the blank's none; a cable from a switch's RJ45 port
// to p1 of the panel in bay-1 is added, its end lands as a copper port taking
// an RJ45 plug, and it routes; and a port the blank does not have is refused.
//
// Run by test_fhd_fapm6_cables.py, which names the build in PORTRAYAL_DIST.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as P from '../../../kit/rack/ports.js';
import {apply} from '../../../kit/rack/commands.js';

const DIST = process.env.PORTRAYAL_DIST;
assert.ok(DIST, 'PORTRAYAL_DIST names the build directory (library/dist)');
const read = name => JSON.parse(fs.readFileSync(`${DIST}/${name}`, 'utf8'));
const comps = new Map(read('components.json').components.map(c => [`${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`, c]));
const compByRef = ref => (ref == null ? null : comps.get(String(ref).split(':')[0]) ?? null);

const RJ45 = 'fs/fhd-fapm6-rj45@1', BLANK = 'fs/fhd-fapm6-blank@1';
const cfg = read('fhd-1ube.configs.json');
const slots = {default: cfg.default, 'pdu-class': cfg['pdu-class'], bays: cfg.bays, cages: cfg.cages, configs: cfg.configs};
// a switch with one fixed RJ45 port, which a page reads off its drawing and the catalogue does not list
const SW = {default: 'base', 'pdu-class': null, bays: {front: [], rear: []}, cages: {front: [], rear: []},
            configs: [{name: 'base', description: '', airflow: 'front-to-back', bays: {}, occupants: {}}]};
const chassisOf = ref => ({'fhd-1ube': {ru: 1, w: 448, h: 44, d: 227, model: 'FHD-1UBE', manufacturer: 'FS', kind: 'patch panel', configs: ['base', 'panels'], default: 'base'},
                           sw: {ru: 1, w: 438, h: 43.6, d: 400, model: 'SW', manufacturer: 'Acme', kind: 'switch', configs: ['base'], default: 'base'}})[ref] ?? null;
const ctx = {chassisOf, slotsOf: ref => ({'fhd-1ube': slots, sw: SW})[ref] ?? null, compByRef};

const SWAPS = {'bay-1': RJ45, 'bay-2': BLANK};
const add = (rack, ref, ru, extra) => M.withItem(rack, {ref, cfg: 'base', ru, label: ref, ...extra}).rack;
const RACK = add(add(M.newRack(), 'fhd-1ube', 30, {label: 'pp-1', swaps: SWAPS}), 'sw', 20, {label: 'sw-1'});
const pp = RACK.items.find(i => i.ref === 'fhd-1ube');
const end = (item, path, view = 'front') => ({item, path, view});

test('both panels seat in every bay of the 1UBE', () => {
  const bays = cfg.bays.front;
  assert.equal(bays.length, 4);
  for (const b of bays) for (const ref of [RJ45, BLANK]) assert.ok(b.accepts.includes(ref), `${b.id} accepts ${ref}`);
  for (const ref of [RJ45, BLANK]) assert.equal(compByRef(ref)?.class, 'adapter-panel', ref);
});

test('the kit lists the RJ45 panel\'s six ports as cable ends and the blank\'s none', () => {
  const paths = P.cableEndPaths(pp, 'front', ctx).sort();
  assert.deepEqual(paths.filter(p => p.startsWith('bay-1/')), [1, 2, 3, 4, 5, 6].map(n => `bay-1/module/p${n}`));
  assert.deepEqual(paths.filter(p => p.startsWith('bay-2/')), [], 'the blank offers no cable end');
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const got = P.seatedPort(pp, end('i1', `bay-1/module/p${n}`), ctx);
    assert.equal(got?.port, true, `p${n} is a port of the panel in bay-1`);
    assert.deepEqual(got.info, {family: 'copper', mode: null, ...(got.info.plug ? {plug: got.info.plug} : {})}, `p${n}`);
  }
  // no p7, and nothing on the rear: the back is punched down
  assert.notEqual(P.seatedPort(pp, end('i1', 'bay-1/module/p7'), ctx)?.port, true);
  assert.notEqual(P.seatedPort(pp, end('i1', 'bay-1/module/p1', 'rear'), ctx)?.port, true);
});

test('the blank panel offers no port, and what is in its openings is not one', () => {
  for (const id of ['blank1', 'p1']) assert.notEqual(P.seatedPort(pp, end('i1', `bay-2/module/${id}`), ctx)?.port, true, id);
  const blank = compByRef(BLANK);
  assert.deepEqual((blank.parts || []).filter(q => compByRef(q.ref)?.class === 'port'), []);
  assert.equal(blank.parts.length, 6);
});

// ── a cable from a switch's RJ45 port to p1 of the panel in bay-1 ────────
const SWITCH_END = end('i2', 'mgmt');
const P1 = end('i1', 'bay-1/module/p1');
const X = {'i1|front|bay-1/module/p1': -160, 'i2|front|mgmt': -150};
const rc = {chassisOf, guidesOf: () => [], portX: e => X[`${e.item}|${e.view}|${e.path}`] ?? 0};

test('a cable from a switch RJ45 port to p1 in bay-1 is added, lands as copper and routes', () => {
  const res = apply(RACK, [{op: 'cable.add', a: SWITCH_END, b: P1, media: 'cat6'}], ctx);
  assert.equal(res.error, undefined);
  assert.equal(res.summary, 'Added cable c1.');
  const rack = res.rack, c = rack.cables[0];
  assert.deepEqual([c.a, c.b], [SWITCH_END, P1]);
  // the catalogue says it lands, and what plug: the same code that lands a cable on a FAP18's lc01
  const page = {facts: {item: true, drawing: true, port: false, cage: false, occupied: false, holder: null}, info: null, reason: 'no port'};
  const settled = P.settleEnd(rack, P1, page, ctx);
  assert.equal(settled.facts.port, true);
  assert.equal(settled.info.family, 'copper');
  // and it routes: out of the switch's front and across to the panel's
  const route = R.autoRoute(rack, c, rc);
  assert.ok(route.length >= 1, 'a route was found');
  const path = R.routePath(rack, c, rc);
  const len = R.pathLength(path);
  assert.ok(len.measured > 0 && len.measured < 5, `${len.measured} m`);
});

test('a cable to the blank panel is not a cable to a port', () => {
  const page = {facts: {item: true, drawing: true, port: false, cage: false, occupied: false, holder: null}, info: null, reason: 'no port'};
  const settled = P.settleEnd(RACK, end('i1', 'bay-2/module/blank1'), page, ctx);
  assert.notEqual(settled?.facts?.port, true);
});
