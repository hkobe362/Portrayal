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
import * as Q from '../../../kit/rack/queries.js';
import {partName} from '../../../kit/rack/slots.js';
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
  // no p7
  assert.notEqual(P.seatedPort(pp, end('i1', 'bay-1/module/p7'), ctx)?.port, true);
});

test('the rear of each jack is a cable end on the rear view, the punch-down (IDC) back', () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const got = P.seatedPort(pp, end('i1', `bay-1/module/b${n}`, 'rear'), ctx);
    assert.equal(got?.port, true, `rear b${n}`);
    assert.equal(got.back, true);
    assert.equal(got.holder.part, 'FHD-FAPM6-RJ45');
    // bN is the back of pN: it is a rear end only, and pN a front end only
    assert.equal(P.seatedPort(pp, end('i1', `bay-1/module/b${n}`, 'front'), ctx)?.port, false);
    assert.equal(P.seatedPort(pp, end('i1', `bay-1/module/p${n}`, 'rear'), ctx)?.port, false);
  }
  assert.equal(compByRef(RJ45).faces.rear, 'fs/fhd-fapm6-rj45-rear@1');
  assert.deepEqual(compByRef('fs/fhd-fapm6-rj45-rear@1').parts.map(q => q.id), ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  // the blank has no rear
  assert.notEqual(P.seatedPort(pp, end('i1', 'bay-2/module/blank1', 'rear'), ctx)?.port, true);
});

test('the part is named by its contract, not by its library ref', () => {
  assert.equal(partName(compByRef, RJ45), 'FS FHD-FAPM6-RJ45');
  assert.notEqual(partName(compByRef, BLANK), BLANK);
});

test('a cable end on a missing side or port is refused when it is added, with the loose end\'s own sentence', () => {
  const sw = end('i2', 'mgmt');
  // a rear jack and a front jack are both there
  for (const [path, v] of [['p2', 'front'], ['b2', 'rear']])
    assert.equal(apply(RACK, [{op: 'cable.add', a: sw, b: end('i1', `bay-1/module/${path}`, v), media: 'cat6'}], ctx).error, undefined, path);
  // p1 on the rear is the front jack's address on the wrong panel: the sentence the loose end gave
  const wrong = apply(RACK, [{op: 'cable.add', a: sw, b: end('i1', 'bay-1/module/p1', 'rear'), media: 'cat6'}], ctx);
  assert.equal(wrong.error, 'bay-1 holds FHD-FAPM6-RJ45, whose port p1 is on the front panel; give view "front".');
  // a made-up p9
  const nine = apply(RACK, [{op: 'cable.add', a: sw, b: end('i1', 'bay-1/module/p9'), media: 'cat6'}], ctx);
  assert.match(nine.error, /^bay-1 holds FHD-FAPM6-RJ45, which has no port p9\.$/);
  // the rear of a part with no rear: the blank's openings hold no port at all, the 1UBE bay beside it holds the RJ45
  const none = apply(RACK, [{op: 'cable.add', a: sw, b: end('i1', 'bay-2/module/p1', 'rear'), media: 'cat6'}], ctx);
  assert.match(none.error, /^bay-2 holds .*, which has no port p1\.$/);
  // and a move to such an end is refused as an add is
  const added = apply(RACK, [{op: 'cable.add', a: sw, b: P1, media: 'cat6'}], ctx).rack;
  const moved = apply(added, [{op: 'cable.update', id: 'c1', b: end('i1', 'bay-1/module/p9')}], ctx);
  assert.equal(moved.error, nine.error);
});

test('the free ports of the panel list the rear jacks, with their view', async () => {
  // the reader of the rear panel hands in the projected parts of the back, as zones.js reads them
  const portsOf = async (item, view) => (view === 'rear' ? [1, 2, 3, 4, 5, 6].map(n => ({cls: 'port', path: `bay-1/module/b${n}`, media: 'idc'})) : []);
  const free = await Q.freePorts(RACK, 'i1', {...ctx, portsOf});
  const rear = free.filter(f => f.view === 'rear').map(f => f.path).sort();
  assert.deepEqual(rear, [1, 2, 3, 4, 5, 6].map(n => `bay-1/module/b${n}`));
  // a jack with a cable on its rear is no longer free on the rear
  const cabled = apply(RACK, [{op: 'cable.add', a: end('i2', 'mgmt'), b: end('i1', 'bay-1/module/b1', 'rear'), media: 'cat6'}], ctx).rack;
  const after = await Q.freePorts(cabled, 'i1', {...ctx, portsOf});
  assert.equal(after.some(f => f.view === 'rear' && f.path === 'bay-1/module/b1'), false);
  assert.equal(after.filter(f => f.view === 'rear').length, 5);
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

// ── the public test rack: the panel, a switch above it, two vertical PDUs at the
// rear. A PDU's management cable passes through the panel from its punch-down
// back (b1, rear) and leaves its front jack (p1) for the switch.
const PDU = 'evma8365x';
const pduCfg = read('evma8365x.configs.json');
const PDU_SLOTS = {default: pduCfg.default, 'pdu-class': pduCfg['pdu-class'], bays: pduCfg.bays, cages: pduCfg.cages, configs: pduCfg.configs};
const PDU_SIZE = {manufacturer: 'Eaton', model: 'EVMA8365X', mount: 'rack-side', kind: 'pdu', ru: 41, h: 1829, w: 52, d: 65, default: pduCfg.default, configs: pduCfg.configs.map(k => k.name)};
const ctx2 = {chassisOf: ref => (ref === PDU ? PDU_SIZE : chassisOf(ref)),
              slotsOf: ref => (ref === PDU ? PDU_SLOTS : ctx.slotsOf(ref)), compByRef};
const withPdus = apply(apply(RACK, [{op: 'zerou.place', ref: PDU, at: 'left-rear', ru: 1, label: 'PDU-A'}], ctx2).rack,
                       [{op: 'zerou.place', ref: PDU, at: 'right-rear', ru: 1, label: 'PDU-B'}], ctx2).rack;

test('a PDU\'s cable passes through the panel: to the rear of the jack, and from its front to the switch', () => {
  assert.equal(withPdus.zeroU.length, 2);
  const [za, zb] = withPdus.zeroU;
  const eth0 = z => ({item: z.id, path: 'network-module/module/eth0', view: 'front'});
  const BACK = end('i1', 'bay-1/module/b1', 'rear'), FRONT = end('i1', 'bay-1/module/p1');
  const one = apply(withPdus, [{op: 'cable.add', a: eth0(za), b: BACK, media: 'cat6a', purpose: 'management'}], ctx2);
  assert.equal(one.error, undefined);
  const two = apply(one.rack, [{op: 'cable.add', a: FRONT, b: SWITCH_END, media: 'cat6a', purpose: 'management'}], ctx2);
  assert.equal(two.error, undefined);
  const three = apply(two.rack, [{op: 'cable.add', a: eth0(zb), b: end('i1', 'bay-1/module/b2', 'rear'), media: 'cat6a'}], ctx2);
  assert.equal(three.error, undefined);
  // both ends of the pass settle as ports, the rear a back
  const back = P.seatedPort(three.rack.items.find(i => i.id === 'i1'), BACK, ctx2);
  assert.deepEqual([back.port, back.back, back.onView], [true, true, 'rear']);
  // the cables route: the PDU's through to the panel's rear, the other out of its front
  const rc2 = {chassisOf: ctx2.chassisOf, guidesOf: () => [], portX: () => -150, bendOf: () => 1e12};
  for (const c of two.rack.cables) assert.ok(R.autoRoute(two.rack, c, rc2).length >= 1, `route of ${c.id}`);
  // the panel's jack 1 has the one cable on each side, and b1 is the rear one
  assert.deepEqual(two.rack.cables.map(c => [c.a.path, c.a.view, c.b.path, c.b.view]),
    [['network-module/module/eth0', 'front', 'bay-1/module/b1', 'rear'], ['bay-1/module/p1', 'front', 'mgmt', 'front']]);
  // the rear of p1, a made-up p9 and the rear of a panel with no rear are refused as they are added
  const refuse = b => apply(withPdus, [{op: 'cable.add', a: eth0(za), b, media: 'cat6a'}], ctx2).error;
  assert.equal(refuse(end('i1', 'bay-1/module/p1', 'rear')), 'bay-1 holds FHD-FAPM6-RJ45, whose port p1 is on the front panel; give view "front".');
  assert.equal(refuse(end('i1', 'bay-1/module/p9')), 'bay-1 holds FHD-FAPM6-RJ45, which has no port p9.');
  assert.match(refuse(end('i1', 'bay-2/module/b1', 'rear')), /^bay-2 holds .*, which has no port b1\.$/);
});
