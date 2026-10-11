// spec/tests/js/rack-rear-ports.mjs
// A PORT ON THE BACK OF WHAT A BAY HOLDS (#1019): the rear adapters of a panel
// and the trunk connector of a cassette, seated in a patch enclosure. Its
// address is `<bay>/module/<part>` on the host's other panel; the element id a
// drawing gives the projection (`bay-1-rear--b01`) is never one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {install, build} from './fake-dom.mjs';
import * as M from '../../../kit/rack/model.js';
import * as Q from '../../../kit/rack/queries.js';
import * as R from '../../../kit/rack/route.js';
import * as CR from '../../../kit/rack/cable-rules.js';
import * as X from '../../../kit/rack/export-data.js';
import * as D from '../../../kit/rack/dcim-rules.js';
import {COMMANDS, apply} from '../../../kit/rack/commands.js';
import {ctx, chassisOf, REAR_FACE, PANEL, PANEL_OM4, CASSETTE, BLANK} from './rear-ports-fixture.mjs';

// readSvg wants a document: the fake DOM's, with the two things it asks of a
// real one that the fake leaves out (an element's `id`, and a root that can be
// asked for a parser error).
install();
globalThis.DOMParser = class {
  parseFromString(text) {
    const give = n => { Object.defineProperty(n, 'id', {get() { return this.getAttribute('id') || ''; }}); n.children.forEach(give); return n; };
    const root = give(build(JSON.parse(text)));
    root.querySelector = () => null;
    return {documentElement: root};
  }
};
const Z = await import('../../../kit/zones.js');
const drawio = await import('../../../kit/drawio.js');

const add = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: ref === 'pp' ? 'panels' : 'base', ru, label: extra.label ?? ref, ...extra}).rack;
const end = (item, path, view = 'front') => ({item, path, view});
const B01 = end('i1', 'bay-1/module/b01', 'rear'), LC01 = end('i1', 'bay-1/module/lc01'), MTP = end('i1', 'bay-2/module/mtp1', 'rear');
// pp-1 at U30 with the panel in bay-1 and the cassette in bay-2, sw-1 at U20 with an optic in port-1
const RACK = add(add(M.newRack(), 'pp', 30, {label: 'pp-1'}), 'sw', 20, {label: 'sw-1', swaps: {'port-1': 'generic/sfp-lc@1', 'port-2': 'generic/sfp-lc@1'}});
const run = (rack, cmds, c = ctx) => apply(rack, cmds, c);
const cabled = (rack, ...pairs) => run(rack, pairs.map(([a, b]) => ({op: 'cable.add', a, b, media: 'os2'}))).rack;

// ── zones ────────────────────────────────────────────────────────────────
const zones = Z.readSvg(JSON.stringify(REAR_FACE)).zones;

test('zones: a projected part is read at the path of the part it shows, and says it is a projection', () => {
  assert.deepEqual(zones.map(z => [z.id, z.path, z.projected ?? false]), [
    ['bay-1-rear--b01', 'bay-1/module/b01', true], ['bay-1-rear--b02', 'bay-1/module/b02', true],
    ['bay-2-rear--mtp1', 'bay-2/module/mtp1', true],
    // a part's own drawing is its data-path, and a port with neither is its id, as before
    ['ground', 'ground', false], ['label-1', 'label-1', false]]);
  assert.equal(zones.some(z => /--/.test(z.path)), false, 'no element id is a path');
  // the inner bores of an adapter are part of its port, as they were
  assert.equal(zones.length, 5);
  assert.equal(zones[0].media, 'fiber');
});

test('diagram exports: a projected port keeps the name it was written with, and a cable finds it by its address', () => {
  const ports = Z.portsOf(zones);
  assert.equal(Z.exportName(ports.find(p => p.path === 'bay-1/module/b01')), 'bay-1-rear--b01');
  assert.equal(Z.exportName({id: 'port-1', path: 'port-1'}), 'port-1');
  assert.equal(Z.exportName({id: 'slot-1--module--p0', path: 'slot-1/module/p0'}), 'slot-1/module/p0');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 482.6 44"/>';
  const cells = drawio.deviceCells('d', svg, [0, 0, 482.6, 44], ports, 0, 0, 482.6, 44, {covers: false}).join('');
  assert.match(cells, /portrayal-path="bay-1-rear--b01" id="d-bay-1-rear--b01"/);
  assert.doesNotMatch(cells, /portrayal-path="bay-1\/module\/b01"/);
  const cable = (id, path) => ({id, a: {path, view: 'rear'}, b: {path: 'ground', view: 'rear'}, media: 'os2'});
  const dia = drawio.diagram('pp', svg, [0, 0, 482.6, 44], ports,
    {view: 'rear', covers: false, cables: [cable('c1', 'bay-1/module/b01'), cable('c2', 'bay-1-rear--b02'), cable('c3', 'bay-1/module/b09')]});
  assert.match(dia, /source="pp-bay-1-rear--b01"/, 'the address lands on the projected port');
  assert.match(dia, /source="pp-bay-1-rear--b02"/, 'a file that names the element id draws as it did');
  assert.equal((dia.match(/is not a port in this drawing/g) || []).length, 1, 'and a port that is not there is still a note');
});

// ── the free ports ───────────────────────────────────────────────────────
// what a page hands in: the zones of each panel
const FRONT = [{id: 'bay-1--module--lc01', path: 'bay-1/module/lc01', cls: 'port', media: 'fiber'},
               {id: 'bay-1--module--lc02', path: 'bay-1/module/lc02', cls: 'port', media: 'fiber'}, {id: 'bay-1', path: 'bay-1', cls: 'bay'}];
const portsOf = async (item, view) => (item.ref !== 'pp' ? [] : view === 'front' ? FRONT : Z.portsOf(zones).filter(z => z.path !== 'label-1'));

test('free ports: a port on the face and a port on the back are both offered by path, on the panel that shows them', async () => {
  const free = await Q.freePorts(RACK, 'i1', {...ctx, portsOf});
  assert.deepEqual(free.map(p => [p.path, p.view]), [['bay-1/module/lc01', 'front'], ['bay-1/module/lc02', 'front'],
    ['ground', 'rear'], ['bay-1/module/b01', 'rear'], ['bay-1/module/b02', 'rear'], ['bay-2/module/mtp1', 'rear']]);
  assert.deepEqual(free[3], {path: 'bay-1/module/b01', view: 'rear', label: 'bay 1/module/b01', media: 'fiber', speed: null});
  // every offered port is one cable.add takes
  for (const p of free) assert.equal(run(RACK, [{op: 'cable.add', a: {item: 'i1', path: p.path, view: p.view}, b: end('i2', 'port-1')}]).error, undefined, p.path);
  // a cabled rear port is no longer free; the front port of the same adapter still is
  const r = cabled(RACK, [B01, end('i2', 'port-1')]);
  assert.deepEqual((await Q.freePorts(r, 'i1', {...ctx, portsOf})).map(p => p.path),
    ['bay-1/module/lc01', 'bay-1/module/lc02', 'ground', 'bay-1/module/b02', 'bay-2/module/mtp1']);
});

test('free ports: an element id is never offered, whatever reader hands it in', async () => {
  // a reader that takes an element's id for its path, as zones.js did
  const stale = async (item, view) => (item.ref !== 'pp' ? [] : view === 'front' ? FRONT
    : [{path: 'bay-1-rear--b01', cls: 'port', media: 'fiber'}, {path: 'bay-2-rear--mtp1', cls: 'port'}, {path: 'bay-3-rear--b01', cls: 'port'}, {path: 'ground', cls: 'port'}]);
  // with the catalogue, an id of a back is turned into its address where a port is known there
  const known = await Q.freePorts(RACK, 'i1', {...ctx, portsOf: stale});
  assert.deepEqual(known.filter(p => p.view === 'rear').map(p => p.path), ['bay-1/module/b01', 'bay-2/module/mtp1', 'ground']);
  // without it, the id is dropped
  const bare = await Q.freePorts(RACK, 'i1', {portsOf: stale});
  assert.deepEqual(bare.filter(p => p.view === 'rear').map(p => p.path), ['ground']);
  for (const list of [known, bare]) assert.equal(list.some(p => CR.isElementId(p.path)), false);
});

// ── a cable end ──────────────────────────────────────────────────────────
test('an element id is refused as an end, with the address to give', () => {
  const add1 = run(RACK, [{op: 'cable.add', a: end('i1', 'bay-1-rear--b01', 'rear'), b: end('i2', 'port-1')}]);
  assert.match(add1.error, /bay-1-rear--b01 is an element id of the drawing, not the address of a port; give \{path: "bay-1\/module\/b01", view: "rear"\}\./);
  assert.match(run(RACK, [{op: 'cable.add', a: end('i2', 'port-1'), b: end('i1', 'bay-1--module--lc01')}]).error, /give the path bay-1\/module\/lc01\./);
  // re-pointing an end is checked the same; an end that is not moved is left alone
  const r = cabled(RACK, [B01, end('i2', 'port-1')]);
  assert.match(run(r, [{op: 'cable.update', id: 'c1', a: end('i1', 'bay-1-rear--b02', 'rear')}]).error, /give \{path: "bay-1\/module\/b02", view: "rear"\}\./);
  const old = {...r, cables: [{...r.cables[0], a: end('i1', 'bay-1-rear--b01', 'rear')}]};
  assert.equal(run(old, [{op: 'cable.update', id: 'c1', label: 'kept'}]).rack.cables[0].label, 'kept');
  assert.deepEqual(run(old, [{op: 'cable.update', id: 'c1', a: B01}]).rack.cables[0].a, B01);
  assert.deepEqual(CR.addressFor('bay-1-rear--b01'), {path: 'bay-1/module/b01', view: 'rear'});
  assert.deepEqual(CR.addressFor('slot-2--module--p0'), {path: 'slot-2/module/p0'});
  assert.equal(CR.isElementId('bay-1/module/b01'), false);
});

// ── attach, route, measure ───────────────────────────────────────────────
const X0 = {'i1|rear|bay-1/module/b01': 180, 'i1|front|bay-1/module/lc01': -180, 'i2|front|port-1': -150, 'i2|front|port-2': -140};
const rc = {chassisOf, guidesOf: () => [], portX: e => X0[`${e.item}|${e.view}|${e.path}`] ?? 0};

test('a cable from a seated panel\'s rear port to a switch port attaches, routes through a rear lane and is measured', () => {
  const res = run(RACK, [{op: 'cable.add', a: B01, b: end('i2', 'port-1'), media: 'os2'}]);
  assert.equal(res.summary, 'Added cable c1.');
  const rack = res.rack, c = rack.cables[0];
  assert.deepEqual(c.a, B01);
  // out of the back of the enclosure, round the rail at its own U, and down the front
  assert.deepEqual(R.autoRoute(rack, c, rc), [{lane: 'left-rear', ru: 30}, {lane: 'left-front', ru: 30}, {lane: 'left-front', ru: 20}]);
  const path = R.routePath(rack, c, rc);
  assert.equal(path.points[0].x, 180);
  assert.ok(path.points[0].z < 0 && path.points.at(-1).z === 0, 'from behind the rear rail to the front one');
  const len = R.pathLength(path);
  assert.ok(len.measured > 2 && len.measured < 3, `${len.measured} m`);
  const routed = R.withRoutedLengths(rack, rc).cables[0].length;
  assert.equal(routed.source, 'routed');
  assert.equal(routed.value, 3);
  // and the cable lists by its end, on the panel it is on
  assert.match(Q.describe(rack, ctx), /c1: i1\/bay-1\/module\/b01 \(rear\) <-> i2\/port-1, os2/);
});

// ── does the end land ────────────────────────────────────────────────────
// a page that looked the end up by data-path alone found nothing on the rear
// panel: no port, and no card in the bay
const lost = e => ({facts: {item: true, drawing: true, port: false, cage: false, occupied: false, holder: {path: CR.holderPath(e.path), part: null}},
  info: CR.connectorOf(), reason: `${CR.holderPath(e.path)} is empty`});
const landed = {facts: {item: true, drawing: true, port: true, cage: true, occupied: true, holder: null}, info: {family: 'fiber', mode: 'single-mode'}, reason: null};
const factsFor = answers => async (rack, extra = []) => ({seats: {}, ends: new Map([...(rack.cables || []).flatMap(c => [c.a, c.b]), ...extra]
  .map(e => [CR.endKey(e), answers(e)]).filter(([, v]) => v))});

test('a rear end lands by what the bay holds: the item\'s swaps, the part, and the parts of its back', async () => {
  const rack = cabled(RACK, [B01, end('i2', 'port-1')], [MTP, end('i2', 'port-2')]);
  const cableFacts = factsFor(e => (e.item === 'i1' ? lost(e) : landed));
  assert.deepEqual(await Q.looseEnds(rack, {...ctx, cableFacts}), {unchecked: false, ends: []});
  const seen = await Q.inspect(rack, 'c1', {...ctx, cableFacts});
  assert.deepEqual([seen.loose, seen.mismatch], [[], []]);
  assert.deepEqual((await Q.selectCables(rack, {loose: true}, {...ctx, cableFacts})).ids, []);
  // the port is the part's own: its connector is known for the media proposal
  assert.deepEqual(await Q.suggestMedia(rack, B01, end('i2', 'port-1'), {...ctx, cableFacts}), {media: 'os2', warnings: []});
});

test('a rear end: the wrong panel, an empty bay, a part with no such port and an element id each say why', async () => {
  const P = await import('../../../kit/rack/ports.js');
  const why = (rack, e, got = lost(e)) => P.settleEnd(rack, e, got, ctx)?.reason ?? null;
  assert.equal(why(RACK, B01), null);
  assert.equal(why(RACK, MTP), null);
  assert.equal(why(RACK, LC01, lost(LC01)), null);
  assert.equal(why(RACK, end('i1', 'bay-1/module/b01', 'front')),
    'bay-1 holds FHD-FAP12LCDXSMF, whose port b01 is on the rear panel; give view "rear"');
  assert.equal(why(RACK, end('i1', 'bay-1/module/lc01', 'rear')),
    'bay-1 holds FHD-FAP12LCDXSMF, whose port lc01 is on the front panel; give view "front"');
  assert.equal(why(RACK, end('i1', 'bay-3/module/b01', 'rear')), 'bay-3 is empty');
  // a port the catalogue does not compose is the drawing's to answer
  const blank = run(RACK, [{op: 'fit', id: 'i1', path: 'bay-3', ref: BLANK}]).rack;
  const page = {facts: {item: true, drawing: true, port: false, holder: {path: 'bay-3', part: 'FHD-FAPB'}}, reason: 'bay-3 holds FHD-FAPB, which has no port b01'};
  assert.equal(why(blank, end('i1', 'bay-3/module/b01', 'rear'), page), 'bay-3 holds FHD-FAPB, which has no port b01');
  assert.equal(why(RACK, end('i1', 'bay-1/module/test-point', 'front'), landed), null);
  // an element id in a file that already has one is a loose end that says what to give
  assert.equal(why(RACK, end('i1', 'bay-1-rear--b01', 'rear'), landed),
    'bay-1-rear--b01 is an element id of the drawing, not the address of a port; give {path: "bay-1/module/b01", view: "rear"}');
  // a panel the page found no drawing for stays so; a removed device too
  assert.equal(why(RACK, B01, {facts: {item: true, drawing: false}, reason: 'this panel has no drawing'}), 'this panel has no drawing');
  assert.equal(why(RACK, end('i9', 'bay-1/module/b01', 'rear'), {facts: {item: false}, reason: 'the device was removed'}), 'the device was removed');
  // the catalogue's own answer, as looseReason reads it
  const got = P.seatedPort(RACK.items[0], B01, ctx);
  assert.deepEqual([got.port, got.back, got.onView, got.cage, got.holder], [true, true, 'rear', false, {path: 'bay-1', part: 'FHD-FAP12LCDXSMF', ref: PANEL}]);
  assert.deepEqual(got.info, {family: 'fiber', mode: null});
  assert.equal(P.seatedPort(RACK.items[0], B01, {}), null, 'no parts list loaded: it cannot say');
  assert.equal(P.seatedPort(RACK.items[1], end('i2', 'port-1'), ctx), null, 'a port of the device itself is the drawing\'s');
  assert.deepEqual(P.seatedPorts(RACK.items[0], ctx).map(p => `${p.view} ${p.path}`), ['front bay-1/module/lc01', 'front bay-1/module/lc02',
    'rear bay-1/module/b01', 'rear bay-1/module/b02', 'front bay-2/module/lc1', 'front bay-2/module/lc2', 'rear bay-2/module/mtp1']);
});

// ── re-fitting and removing the module ───────────────────────────────────
test('re-fitting a panel keeps a rear cable where the new part has the port, and reports it where it has not', () => {
  const rack = cabled(RACK, [B01, end('i2', 'port-1')], [LC01, end('i2', 'port-2')]);
  const fit = ref => COMMANDS.fit.run(rack, {id: 'i1', path: 'bay-1', ref}, ctx);
  // another panel of the same adapters: both cables stay, and nothing is said
  const same = fit(PANEL_OM4);
  assert.deepEqual(same.findings, []);
  assert.deepEqual(same.rack.cables, rack.cables);
  // a cassette has neither lc01 nor b01
  const other = fit(CASSETTE);
  assert.deepEqual(other.findings.map(f => f.text), [
    'Kept the cables on bay-1/module/b01, bay-1/module/lc01 as loose ends (c1, c2): these ports are not on FS FHD-1MTP6LCDOS2A.']);
  assert.deepEqual(other.rack.cables, rack.cables);
  // taking the panel out
  const out = fit(null);
  assert.deepEqual(out.findings.map(f => f.text), ['Kept the cables on bay-1/module/b01, bay-1/module/lc01 as loose ends (c1, c2): bay-1 is empty.']);
  assert.equal(out.rack.items[0].swaps['bay-1'], null);
});

test('a cassette\'s rear MTP is cabled, kept and reported as a panel\'s rear adapter is', async () => {
  const rack = cabled(RACK, [MTP, end('i2', 'port-1')]);
  assert.deepEqual(rack.cables[0].a, MTP);
  assert.deepEqual(R.autoRoute(rack, rack.cables[0], rc).map(w => w.lane), ['left-rear', 'left-front', 'left-front']);
  const fit = ref => COMMANDS.fit.run(rack, {id: 'i1', path: 'bay-2', ref}, ctx);
  // the cassette put back as the configuration builds it changes nothing
  assert.equal(fit(CASSETTE).rack, rack);
  assert.deepEqual(fit(PANEL).findings.map(f => f.text),
    ['Kept the cables on bay-2/module/mtp1 as loose ends (c1): this port is not on FS FHD-FAP12LCDXSMF.']);
  assert.deepEqual(fit(null).findings.map(f => f.text), ['Kept the cables on bay-2/module/mtp1 as loose ends (c1): bay-2 is empty.']);
  const cableFacts = factsFor(e => (e.item === 'i1' ? lost(e) : landed));
  assert.deepEqual((await Q.looseEnds(rack, {...ctx, cableFacts})).ends, []);
  const emptied = fit(null).rack;
  assert.deepEqual((await Q.looseEnds(emptied, {...ctx, cableFacts})).ends.map(x => [x.cable, x.side, x.reason]), [['c1', 'a', 'bay-2 is empty']]);
  // removing the enclosure leaves the cable a loose end, as any other
  assert.equal(run(rack, [{op: 'remove', id: 'i1'}]).summary, 'Removed pp-1. Its 1 cable is a loose end.');
});

// ── the two sides of one adapter ─────────────────────────────────────────
test('a cable on the front port and a cable on the rear port of one adapter are two cables on two ports', () => {
  const res = run(RACK, [{op: 'cable.add', a: LC01, b: end('i2', 'port-1'), media: 'os2'}, {op: 'cable.add', a: B01, b: end('i2', 'port-2'), media: 'os2'}]);
  assert.equal(res.error, undefined);
  assert.equal(res.summary, 'Added cable c1. Added cable c2.');
  const rack = res.rack;
  assert.equal(CR.sameEnd(LC01, B01), false);
  assert.equal(CR.portFree(rack, end('i1', 'bay-1/module/lc02')).ok, true);
  assert.equal(CR.portFree(rack, B01).ok, false, 'the rear port now has its cable');
  const ends = new Map(rack.cables.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: {family: 'fiber', mode: 'single-mode'}, reason: null}]));
  assert.deepEqual(X.cableFindings(rack, ends).map(f => [f.name, f.loose, f.warnings, f.checked]), [['c1', [], [], true], ['c2', [], [], true]]);
  // the schedule: one row each, the port by its path
  const rows = X.cableScheduleRows(rack, ends, rack.items).rows;
  assert.deepEqual(rows.map(r => [r.id, r.a_device, r.a_u, r.a_port, r.b_port, r.status]),
    [['c1', 'pp-1', 30, 'bay-1/module/lc01', 'port-1', 'connected'], ['c2', 'pp-1', 30, 'bay-1/module/b01', 'port-2', 'connected']]);
  // the DCIM cables file names neither as a duplicate of the other
  const dev = D.typeLists('model: Panel\nmodule-bays:\n  - name: bay-1\n    position: bay-1\n');
  const sw = D.typeLists('model: SW\ninterfaces:\n  - name: port-1\n  - name: port-2\n');
  const mod = D.typeLists("model: P\nrear-ports:\n  - name: '{module}/b01'\nfront-ports:\n  - name: '{module}/lc01'\n");
  const out = D.cableImportRows({rack, names: X.uniqueNames(rack.items), kept: new Set(['i1', 'i2']), ends, uOf: () => 1,
    resolve: e => D.resolveEnd({path: e.path, device: e.item === 'i1' ? dev : sw, moduleAt: () => mod})});
  assert.deepEqual(out.left, []);
  assert.deepEqual(out.rows.map(r => [r.side_a_type, r.side_a_name, r.side_b_name]),
    [['dcim.frontport', 'bay-1/lc01', 'port-1'], ['dcim.rearport', 'bay-1/b01', 'port-2']]);
});

test('selecting the cables of one port: the rear port and the front port of an adapter each find their own', async () => {
  const rack = cabled(RACK, [LC01, end('i2', 'port-1')], [B01, end('i2', 'port-2')]);
  assert.deepEqual((await Q.selectCables(rack, {item: 'i1', path: 'bay-1/module/b01', view: 'rear'}, ctx)).ids, ['c2']);
  assert.deepEqual((await Q.selectCables(rack, {item: 'i1', path: 'bay-1/module/lc01', view: 'front'}, ctx)).ids, ['c1']);
  assert.deepEqual((await Q.selectCables(rack, {item: 'i1'}, ctx)).ids, ['c1', 'c2']);
});

// ── a rack with only front cables is what it was ─────────────────────────
test('a front port on a seated card is settled as the page read it, and a device port is left to the page', async () => {
  const rack = cabled(RACK, [LC01, end('i2', 'port-1')]);
  const answers = e => (e.item === 'i2' ? {facts: {item: true, drawing: true, port: true, cage: true, occupied: false, holder: null}, info: CR.connectorOf(), reason: 'port-1 holds no optic'} : landed);
  const cableFacts = factsFor(answers);
  assert.deepEqual((await Q.looseEnds(rack, {...ctx, cableFacts})).ends.map(x => [x.cable, x.side, x.reason]), [['c1', 'b', 'port-1 holds no optic']]);
  // without the catalogue, the page's answer is the answer, as before
  assert.deepEqual((await Q.looseEnds(rack, {cableFacts})).ends.map(x => x.reason), ['port-1 holds no optic']);
  assert.deepEqual(await Q.looseEnds(rack, {cableFacts: async () => ({seats: {}, ends: new Map(), unchecked: true})}), {unchecked: true, ends: []});
});
