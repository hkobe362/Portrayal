// spec/tests/js/rack-v4-exports.mjs
// THE EXPORTS OF RACK FILE VERSION 4 (docs/rack-file-v4-design.md build part
// 9): the two device imports as golden files, with two half-unit panels in
// one unit on a bottom-up and on a top-down frame; the comment of a rolled
// item, of a PDU hung on brackets and of what is set off; the readings, which
// are in no DCIM file; the spare line of the BOM and the spare of a draw.io
// edge.
//
// The golden files are spec/tests/fixtures/rack-exports/*.csv. Each column of
// them is a field of the import that takes the file, read at the commits the
// note cites: NetBox `DeviceImportForm` and `RackImportForm`
// (netbox/dcim/forms/bulk_import.py), Nautobot `DeviceSerializer`
// (nautobot/dcim/api/serializers.py). Set REGEN=1 to write them again after a
// change that is meant, and read the difference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as F from '../../../kit/rack/fit.js';
import * as X from '../../../kit/rack/export-data.js';
import * as ST from '../../../kit/rack/states.js';
import * as SL from '../../../kit/rack/slack.js';
import * as R from '../../../kit/rack/route.js';
import {configFacts} from '../../../kit/rack/catalog.js';
import {apply} from '../../../kit/rack/commands.js';
import * as FX from './route-direct-fixture.mjs';

const SIZES = {
  xcu: {ru: 0.5, w: 482.6, h: 22.2, d: 284, model: 'XCU10', manufacturer: 'Fibrain'},
  sw: {ru: 1, w: 440, h: 43.6, d: 500, model: 'SW-1', manufacturer: 'Acme'},
  box: {ru: 1, w: 200, h: 43.6, d: 200, model: 'BOX-1', manufacturer: 'Acme'},
  pdu: {ru: 40, w: 55, h: 1778, d: 60, mount: 'rack-side', model: 'EVMA8365X', manufacturer: 'Eaton'},
  bracket: {ru: 1, w: 40, h: 44, d: 20, mount: 'rack-side', model: 'FS-PDUBK', manufacturer: 'FS'},
};
const chassisOf = ref => SIZES[ref] || null;
const POINTS = [{mates: 'pdu-button', at: 72}, {mates: 'pdu-button', at: 1627.8}];
const OUTLETS = Object.fromEntries(['a1', 'a2', 'a7'].map(n => [`outlet-${n}`, ['on', 'off']]));
// the names the catalogue carries for them, as the device-type export names its outlets (configs[].names)
const NAMES = {'outlet-a1': 'A1', 'outlet-a2': 'A2', 'outlet-a7': 'A7'};
const SLOTS = {
  pdu: {default: 'base', 'pdu-class': 'managed', configs: [{name: 'base', 'mount-points': POINTS, slots: [], states: OUTLETS, names: NAMES}]},
  bracket: {default: 'front', 'pdu-class': null, configs: [{name: 'front', 'mount-points': [], slots: [{interface: 'pdu-button', at: 26}], states: {}}]},
  sw: {default: 'base', 'pdu-class': null, configs: [{name: 'base', 'mount-points': [], slots: [], states: {'psu-1': ['on', 'off']}}]},
};
const slotsOf = ref => SLOTS[ref] ?? null;
const ctx = {chassisOf, slotsOf};
const statesOf = entry => ST.statesFor(entry, configFacts(slotsOf(entry.ref), entry.cfg));
const namesOf = entry => configFacts(slotsOf(entry.ref), entry.cfg)?.names;
const TYPE = ref => ({manufacturer: SIZES[ref].manufacturer, model: SIZES[ref].model, isFullDepth: false, guess: false});

// Two half-unit panels in U12, a switch mounted upside down with one supply
// off, and a PDU on two brackets with two outlets off and a reading.
function rackOf(numbering, extra = {}) {
  let r = {...M.newRack({name: 'R1'}), frame: M.normalizeFrame({kind: 'four-post', heightRU: 45, numbering, ...extra})};
  const put = (ref, ru, more) => { r = M.withItem(r, {ref, cfg: '', ru, ...more}).rack; };
  put('xcu', 12, {label: 'ODF A'});
  put('xcu', 12.5, {label: 'ODF B'});
  put('sw', 20, {label: 'leaf-1'});
  r = M.updateItem(r, 'i3', {roll: 180, states: {'psu-1': 'off', 'fan-9': 'off'}});
  const res = apply(r, [
    {op: 'zerou.place', ref: 'bracket', at: 'left-rear', ru: 4, label: 'Bracket low'},
    {op: 'zerou.place', ref: 'bracket', at: 'left-rear', ru: 39, label: 'Bracket high'},
    {op: 'zerou.place', ref: 'pdu', at: 'right-rear', ru: 1, label: 'PDU A'},
    {op: 'zerou.hang', id: 'z3', on: ['z1', 'z2']},
    {op: 'state.set', id: 'z3', path: 'outlet-a2', state: 'off'},
    {op: 'state.set', id: 'z3', path: 'outlet-a7', state: 'off'},
    {op: 'state.set', id: 'z3', path: 'outlet-a1', state: 'on'},
    {op: 'readings.set', id: 'z3', readings: {source: 'snmp poll', at: '2026-10-08T14:00:00Z', values: {'outlet-a1': {'current-a': 1.2}}}},
  ], ctx);
  assert.equal(res.error, undefined, res.error);
  return res.rack;
}
function files(numbering, extra) {
  const rack = rackOf(numbering, extra);
  const items = [...F.itemsWithU(rack, chassisOf), ...X.zeroUImportItems(rack, chassisOf)];
  const types = new Map(items.map(i => [i.id, TYPE(i.ref)]));
  const dcim = {site: 'DC1', role: 'Access'};
  const devices = target => { const d = X.deviceImportRows({rack, items, types, target, dcim, chassisOf, statesOf, namesOf}); assert.deepEqual(d.left, []); return X.toCsv(d.columns, d.rows); };
  const rk = X.rackImportRows({rack, dcim});
  return {'netbox.devices': devices('netbox'), 'nautobot.devices': devices('nautobot'), 'netbox.rack': X.toCsv(rk.columns, rk.rows)};
}
const golden = name => new URL(`../fixtures/rack-exports/${name}.csv`, import.meta.url);

test('golden files: both device imports with two half-unit panels in one unit, bottom-up and top-down', () => {
  for (const numbering of ['bottom-up', 'top-down']) for (const [kind, text] of Object.entries(files(numbering))) {
    const url = golden(`half-units.${numbering}.${kind}`);
    if (process.env.REGEN) writeFileSync(url, text);
    assert.equal(text, readFileSync(url, 'utf8'), `${numbering} ${kind}`);
  }
});

test('the golden files hold only columns the imports take, and the positions the note gives', () => {
  // NetBox DeviceImportForm.Meta.fields has position, face and comments; RackImportForm has no starting_unit
  const head = (n, k) => readFileSync(golden(`half-units.${n}.${k}`), 'utf8').split('\r\n')[0];
  assert.equal(head('bottom-up', 'netbox.devices'), 'name,role,manufacturer,device_type,status,site,rack,position,face,comments');
  assert.equal(head('bottom-up', 'nautobot.devices'), X.NAUTOBOT_COLUMNS.join(','));
  assert.equal(head('bottom-up', 'netbox.rack'), 'site,name,status,width,u_height,desc_units');
  const row = (n, k, name) => readFileSync(golden(`half-units.${n}.${k}`), 'utf8').split('\r\n').find(l => l.startsWith(`${name},`));
  // NetBox: the upper panel at 12.5 bottom-up; top-down the pair is at 33.5 and 34, the upper the higher number's half below
  assert.match(row('bottom-up', 'netbox.devices', 'ODF B'), /,R1,12\.5,front,/);
  assert.match(row('bottom-up', 'netbox.devices', 'ODF A'), /,R1,12,front,/);
  assert.match(row('top-down', 'netbox.devices', 'ODF B'), /,R1,34,front,/);
  assert.match(row('top-down', 'netbox.devices', 'ODF A'), /,R1,34\.5,front,/);
  // Nautobot: one of the two is positioned, at a whole unit, and neither is lost
  assert.match(row('bottom-up', 'nautobot.devices', 'ODF A'), /,R1,DC1,12,front,/);
  assert.match(row('bottom-up', 'nautobot.devices', 'ODF B'), /,R1,DC1,,,/);
  assert.match(row('top-down', 'nautobot.devices', 'ODF A'), /,R1,DC1,34,front,/);
});

test('a rolled item says so in the BOM notes and in the comment of both imports', () => {
  assert.deepEqual([{roll: 180}, {roll: 90}, {roll: 270}, {}, {roll: 45}].map(X.rollNote), [
    'Mounted upside down.', 'Mounted rotated 90 degrees clockwise, as seen from its face.',
    'Mounted rotated 90 degrees anticlockwise, as seen from its face.', '', '']);
  let r = {...M.newRack({name: 'R1'}), frame: M.normalizeFrame({kind: 'four-post', heightRU: 42})};
  r = M.withItem(r, {ref: 'sw', cfg: '', ru: 20, label: 'leaf-1'}).rack;
  r = M.withItem(r, {ref: 'box', cfg: '', ru: 30, label: 'box-1'}).rack;
  r = M.updateItem(M.updateItem(r, 'i1', {roll: 180}), 'i2', {roll: 90});
  const items = F.itemsWithU(r, chassisOf), types = new Map(items.map(i => [i.id, TYPE(i.ref)]));
  for (const target of ['netbox', 'nautobot']) {
    const rows = X.deviceImportRows({rack: r, items, types, target}).rows;
    assert.match(rows.find(x => x.name === 'leaf-1').comments, /^Mounted upside down\.$/, target);
    // owed from part 5: the quarter-turned item says it is turned, at the position its rolled box starts at
    assert.match(rows.find(x => x.name === 'box-1').comments, /Mounted rotated 90 degrees clockwise, as seen from its face\./, target);
  }
  assert.deepEqual(X.mountNotes(items, chassisOf, r.frame), [
    'leaf-1 at U20: Mounted upside down.', 'box-1 at U30: Mounted rotated 90 degrees clockwise, as seen from its face.']);
  // an upright rack says nothing new
  const up = M.updateItem(M.updateItem(r, 'i1', {roll: undefined}), 'i2', {roll: undefined});
  assert.deepEqual(X.mountNotes(F.itemsWithU(up, chassisOf), chassisOf, up.frame), []);
});

test('a PDU hung on brackets names them, and each bracket is a row of its own', () => {
  const rack = rackOf('bottom-up');
  const items = X.zeroUImportItems(rack, chassisOf), types = new Map(items.map(i => [i.id, TYPE(i.ref)]));
  for (const [target, T] of [['netbox', 'NetBox'], ['nautobot', 'Nautobot']]) {
    const rows = X.deviceImportRows({rack, items, types, target}).rows;
    assert.equal(rows.find(x => x.name === 'PDU A').comments, `0U, on 2 FS-PDUBK brackets at left-rear, from U4; ${T} has no field for that.`);
    assert.equal(rows.find(x => x.name === 'Bracket low').comments, `0U, beside the rack at left-rear, U4; ${T} has no field for that.`);
    assert.deepEqual(rows.map(x => [x.position, x.face]), [['', ''], ['', ''], ['', '']]);
  }
  assert.equal(X.zeroUNotes(rack, chassisOf).find(n => n.startsWith('PDU A')), 'PDU A: Eaton EVMA8365X, 0U, on 2 FS-PDUBK brackets at left-rear, from U4.');
  // the unit is the label on the rack: top-down, and numbered from 5
  assert.match(X.zeroUNotes(rackOf('top-down'), chassisOf).find(n => n.startsWith('PDU A')), /from U42\.$/);
  assert.match(X.zeroUNotes(rackOf('bottom-up', {startU: 5}), chassisOf).find(n => n.startsWith('PDU A')), /from U8\.$/);
  // let down again, it is beside the rack as before
  const down = apply(rack, {op: 'zerou.hang', id: 'z3', on: null}, ctx).rack;
  assert.match(X.zeroUNotes(down, chassisOf).find(n => n.startsWith('PDU A')), /0U, beside the rack at left-rear, U\d+-U\d+\.$/);
});

test('what is set off goes in the comment of both imports; a reading is in neither', () => {
  // named as the device type names its outlets, where the catalogue gives the name; by path where it gives none
  assert.equal(X.offNote({'outlet-a2': 'off', 'outlet-a1': 'on', 'outlet-a7': 'off'}, NAMES), 'Outlets off: A2, A7.');
  assert.equal(X.offNote({'outlet-a2': 'off', 'outlet-b9': 'off'}, NAMES), 'Outlets off: A2, outlet-b9.');
  assert.equal(X.offNote({'outlet-a2': 'off', 'outlet-a1': 'on', 'outlet-a7': 'off'}), 'Outlets off: outlet-a2, outlet-a7.');
  assert.deepEqual(configFacts(slotsOf('pdu'), '').names, NAMES);
  assert.deepEqual(configFacts(slotsOf('sw'), '').names, {});
  assert.equal(X.offNote({'psu-1': 'off', 'outlet-a2': 'off'}), 'Outlets off: outlet-a2. Off: psu-1.');
  assert.deepEqual([X.offNote({}), X.offNote(null), X.offNote({'outlet-a1': 'on'})], ['', '', '']);
  const rack = rackOf('bottom-up');
  const items = [...F.itemsWithU(rack, chassisOf), ...X.zeroUImportItems(rack, chassisOf)], types = new Map(items.map(i => [i.id, TYPE(i.ref)]));
  for (const target of ['netbox', 'nautobot']) {
    const rows = X.deviceImportRows({rack, items, types, target, statesOf, namesOf}).rows;
    assert.match(rows.find(x => x.name === 'PDU A').comments, / Outlets off: A2, A7\.$/, target);
    // without the names of the catalogue, the path the rack file has
    assert.match(X.deviceImportRows({rack, items, types, target, statesOf}).rows.find(x => x.name === 'PDU A').comments, / Outlets off: outlet-a2, outlet-a7\.$/);
    // a state the part does not declare (fan-9) is kept in the file and is not exported
    assert.match(rows.find(x => x.name === 'leaf-1').comments, /^Mounted upside down\. Off: psu-1\.$/, target);
    const all = X.toCsv(X.deviceImportRows({rack, items, types, target, statesOf}).columns, rows);
    assert.doesNotMatch(all, /snmp|current-a|1\.2|2026-10-08/, `${target}: no reading`);
    // without the states nothing is said of them
    assert.doesNotMatch(X.toCsv(X.NETBOX_COLUMNS, X.deviceImportRows({rack, items, types, target}).rows), /off/i);
    // and no column is new
    assert.deepEqual(X.deviceImportRows({rack, items, types, target, statesOf}).columns, target === 'netbox' ? X.NETBOX_COLUMNS : X.NAUTOBOT_COLUMNS);
  }
});

test('the BOM notes total the spare, and a draw.io cable carries its own', () => {
  const bare = FX.rack(), ctx0 = FX.ctxOf(bare);
  // with no length bought there is nothing spare: no line, and no spare on an edge
  assert.equal(SL.spareBomLine(bare, ctx0), '');
  assert.equal(X.cableBomNotes(bare, new Map(), {spare: SL.spareExports(bare, ctx0)}).some(n => /^Spare cable/.test(n)), false);
  const r = R.withRoutedLengths(bare, ctx0), c = FX.ctxOf(r);
  const spare = SL.spareExports(r, c);
  const each = r.cables.map(x => SL.slackOf(r, x, c)).filter(s => s && !s.short);
  const sum = k => Math.round(each.reduce((n, s) => n + s.spare[k], 0) * 100) / 100;
  const unplaced = each.filter(s => !s.said && s.unplaced_m > 0.005).length;
  assert.ok(each.length > 10 && sum('spare_m') > 0 && unplaced > 1);
  assert.equal(spare.bom, `Spare cable: ${sum('spare_m')} m of ${sum('stock_m')} m bought; ${unplaced} cords have spare that is not placed.`);
  assert.deepEqual(X.cableBomNotes(r, new Map(), {spare}).filter(n => /^Spare/.test(n)), [spare.bom]);
  assert.equal(X.cableBomNotes(r, new Map()).some(n => /^Spare/.test(n)), false, 'none without it');
  // one cord: "1 cord has"
  const one = {...r, cables: r.cables.slice(0, 1)};
  assert.match(SL.spareBomLine(one, FX.ctxOf(one)), /; [01] cords? ha(s|ve) spare that is not placed\.$/);
  // draw.io: each drawn cable with a length carries what is spare of it
  const ends = new Map();
  const d = X.drawioCables(r, {ends, idOf: id => id, drawn: () => true, spare}).cables;
  assert.ok(d.length > 10);
  for (const x of d) assert.equal(x.spare, SL.mText(spare.byCable.get(x.id).spare.spare_m), x.id);
  assert.equal(X.drawioCables(r, {ends, idOf: id => id, drawn: () => true}).cables.some(x => 'spare' in x), false);
  assert.equal(X.drawioCables(bare, {ends, idOf: id => id, drawn: () => true, spare: SL.spareExports(bare, ctx0)}).cables.some(x => 'spare' in x), false);
});

test('the draw.io writer puts the spare of a cable after its length in the edge label', async () => {
  const drawio = await import('../../../kit/drawio.js');
  const vb = [0, 0, 18, 14];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"/>`;
  const face = {svg, vb, ports: [{id: 'p0', cls: 'port', path: 'p0', x: 4, y: 4, w: 2, h: 2}]};
  const plan = [{label: 'Front', faces: ['front'], racks: [{label: 'R', mounted: [
    {name: 'a', id: 'i1', u: 1, ru: 1, faces: {front: face}}, {name: 'b', id: 'i2', u: 1, ru: 2, faces: {front: face}}]}]}];
  const end = item => ({item, path: 'p0', view: 'front'});
  const cable = {id: 'c1', a: end('i1'), b: end('i2'), media: 'os2', label: 'up-1', length: {value: 1, unit: 'm', source: 'routed'}};
  const labelOf = c => /<object label="([^"]*)"([^>]*) id="cable-c1"/.exec(drawio.rackDiagram(plan, {cables: [c]}));
  const [, withSpare, attrs] = labelOf({...cable, spare: '0.58 m'});
  assert.equal(withSpare, 'up-1 · 1 m, 0.58 m spare');
  // the length a round trip reads back is the attribute, which is still the length alone
  assert.match(attrs, / portrayal-length="1 m"/);
  assert.doesNotMatch(attrs, /spare/);
  assert.equal(labelOf(cable)[1], 'up-1 · 1 m');
  // a cable with no length says nothing of spare, whatever it is handed
  const {length: _l, ...bare} = cable;
  assert.equal(labelOf({...bare, spare: '0.58 m'})[1], 'up-1');
});

