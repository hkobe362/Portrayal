// spec/tests/js/dcim-panel-cables.mjs
// CABLES ON THE FIBRE PORTS OF A SEATED PANEL OR CASSETTE, in the DCIM cables
// files (#1020). Nothing here invents a port name: the parts and what each is
// called come from the built components.json (`optical.ports`, the exporter's
// own walk), and every name a row writes is looked up in the COMMITTED module
// type file of its target under library/exports.
//
// Run by spec/tests/test_dcim_panel_cables.py, which builds the index once and
// names its directory in PORTRAYAL_COMPONENTS. Not a rack-*.mjs file: those
// run with no build behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../../../kit/rack/dcim-rules.js';
import * as X from '../../../kit/rack/export-data.js';
import * as M from '../../../kit/rack/model.js';
import * as P from '../../../kit/rack/ports.js';
import * as CR from '../../../kit/rack/cable-rules.js';

const INDEX = process.env.PORTRAYAL_COMPONENTS;
assert.ok(INDEX, 'PORTRAYAL_COMPONENTS names the directory of a built components.json');
const COMPONENTS = JSON.parse(fs.readFileSync(`${INDEX}/components.json`, 'utf8')).components;
const byRef = new Map(COMPONENTS.map(c => [`${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`, c]));
const compByRef = ref => (ref == null ? null : byRef.get(String(ref).split(':')[0]) ?? null);
const refOf = c => `${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`;
const latest = name => COMPONENTS.filter(c => `${c.ns}/${c.name}` === name && !c['superseded-by'])
  .sort((a, b) => Number(String(b.major).slice(1)) - Number(String(a.major).slice(1))).map(refOf)[0];

// The committed type files, read as text: what a page fetches.
const EXPORTS = new URL('../../../library/exports/', import.meta.url);
const PATHS = Object.fromEntries(['netbox', 'nautobot'].map(t => [t,
  fs.readdirSync(new URL(`${t}/`, EXPORTS), {recursive: true}).filter(p => p.endsWith('.yaml')).sort().map(p => `${t}/${p}`)]));
const lists = path => D.typeLists(fs.readFileSync(new URL(path, EXPORTS), 'utf8'));
const moduleLists = (target, ref) => {
  const path = X.moduleTypePath(PATHS[target], X.partNumber(compByRef(ref)));
  return path ? lists(path) : null;
};

const PANEL = latest('fs/fhd-fap12lcd-os2'), CASSETTE = latest('fs/fhd-1mtp6lcd-os2-a'), OPTIC = latest('generic/qsfp-lc');
const ENCLOSURE = {netbox: 'netbox/device-types/FS.com/FHD-1UFCE.yaml', nautobot: 'nautobot/device-types/FS.com/FHD-1UFCE.yaml'};
const SWITCH = {netbox: 'netbox/device-types/Edgecore/7726-32X-O-AC-F.yaml', nautobot: 'nautobot/device-types/Edgecore/7726-32X-O-AC-F.yaml'};

// configs.json for the two devices, cut to what the rules read: an enclosure
// of four bays opening to the front, and a switch of QSFP cages.
const bay = (id, accepts) => ({id, group: 'slots', accepts, default: null});
const slotsFor = (held, accepts = Object.values(held)) => ({
  'fhd-1ufce': {default: 'seated', 'pdu-class': null, cages: {front: [], rear: []},
    bays: {front: ['bay-1', 'bay-2', 'bay-3', 'bay-4'].map(id => bay(id, accepts)), rear: []},
    configs: [{name: 'seated', description: '', airflow: 'passive', bays: held, occupants: {}}]},
  'as7726-32x': {default: 'base', 'pdu-class': null, bays: {front: [], rear: []},
    cages: {front: [1, 2, 3, 4].map(n => ({id: `port-${n}`, kind: 'cage', group: 'qsfp', interface: 'qsfp28', media: 'qsfp28',
                                           accepts: [OPTIC], default: null})), rear: []},
    configs: [{name: 'base', description: '', airflow: 'front-to-back', bays: {}, occupants: {}}]}});
const ctxFor = held => { const slots = slotsFor(held); return {slotsOf: ref => slots[ref] ?? null, compByRef}; };

const resolverFor = (rack, ctx, target, held) => D.endResolver({rack, ctx,
  deviceOf: id => lists((rack.items.find(i => i.id === id).ref === 'fhd-1ufce' ? ENCLOSURE : SWITCH)[target]),
  moduleAt: (id, bayId) => (rack.items.find(i => i.id === id).ref === 'fhd-1ufce' && held[bayId] ? moduleLists(target, held[bayId]) : null)});

// ── the sweep: every module type whose glass the exporter projects ───────
// WHAT IT REACHES, of the 63 modules that publish ports (2026-10-11):
//   - 3 have no type file the kit can find, on either target: FS panels with
//     no attrs.model, whose file is named for the contract while the kit looks
//     for the part number (#1025). They are not measured here.
//   - NetBox: the other 60 are measured. 4 are DCMs, whose one adapter is a
//     front and a rear port at once and is left out by its reason; every port
//     of the other 56 resolves.
//   - Nautobot: of the 60, 4 types carry no glass (two couplers and two
//     add/drop filters: a split has no Nautobot spelling), and the 4 DCMs
//     name their ports by a bay chain, {module.parent}/{module}/x, which the
//     kit does not read (#1024). Those 8 are left out by a reason, which is
//     checked. The others resolve whole. The 20 Fibrain holders were among
//     the bay-chain ones until #1040: they name their ports {module}/x now,
//     the XCU10 drawer's slots carrying `drawer/` in their own position.
// The sweep seats each module straight in a device bay, which is how a
// Fibrain holder sits in the 1U frame fibrain/xpu; in the XCU10 it sits in
// the drawer, a bay deeper, which this sweep does not seat.
const FIBRE = COMPONENTS.filter(c => c.kind === 'module' && c.optical?.ports && !c['superseded-by']);

test('the build publishes the ports of a part where it publishes the fibre graph of a projected module', () => {
  assert.ok(FIBRE.length >= 60, `only ${FIBRE.length} modules publish optical.ports`);
  assert.deepEqual(compByRef(PANEL).optical.ports.lc01, {'front-ports': ['1', '2']});
  assert.deepEqual(compByRef(PANEL).optical.ports['rear:b01'], {'rear-ports': ['B01-1', 'B01-1']});
  assert.deepEqual([...new Set(compByRef(CASSETTE).optical.ports['rear:mtp']['rear-ports'])], ['MTP-1']);
});

for (const target of ['netbox', 'nautobot']) {
  test(`${target}: every port a cable can land on, on every module that carries glass, is named as its committed type file names it`, () => {
    let ends = 0, written = 0, modules = 0;
    const odd = [], unfound = [], whole = [];
    for (const comp of FIBRE) {
      const ref = refOf(comp), held = {'bay-1': ref}, ctx = ctxFor(held);
      const type = moduleLists(target, ref);
      if (!type) { unfound.push(`${comp.ns}/${comp.name}`); continue; }   // no file under its part number (#1025)
      modules++;
      const rack = {name: 'sweep', frame: M.normalizeFrame({heightRU: 12}), zeroU: [], cables: [],
                    items: [{id: 'i1', ref: 'fhd-1ufce', cfg: 'seated', label: 'pp', ru: 2, u: 1, face: 'front', turned: false}]};
      const resolve = resolverFor(rack, ctx, target, held);
      const named = new Set();
      // every part the build published ports for, at its address: the face on the bay's panel, the back on the other
      for (const key of Object.keys(comp.optical.ports)) {
        const back = key.startsWith('rear:');
        const port = {path: `bay-1/module/${back ? key.slice('rear:'.length) : key}`, view: back ? 'rear' : 'front'};
        assert.equal(P.seatedPort(rack.items[0], {item: 'i1', ...port}, ctx)?.port, true, `${ref} ${key} is a port of what is seated`);
        ends++;
        const r = resolve({item: 'i1', path: port.path, view: port.view});
        const sections = Object.keys(comp.optical.ports[key]);
        if (!r.ok) {
          // the only two ways out: a part that is two kinds of port, or a type file of this target that does not list the
          // name as {module}/<name> (Nautobot: a type with no glass, or one that names its ports by a bay chain)
          const want = sections.length > 1 ? /is .* and .*, and one end of a cable is one kind of port$/
            : new RegExp(`^the module type .* lists no (front|rear) port named \\{module\\}/`);
          assert.match(r.reason, want, `${ref} ${port.path}`);
          if (sections.length === 1) {
            const section = sections[0];
            assert.ok(comp.optical.ports[key][section].some(n => n != null && !type.sections[section].includes(`{module}/${n}`)), `${ref} ${key}`);
          }
          odd.push(`${ref} ${key}`);
          continue;
        }
        const section = sections[0];
        assert.equal(r.type, section === 'front-ports' ? 'dcim.frontport' : 'dcim.rearport');
        assert.ok(r.names.length >= 1 && r.name === r.names[0]);
        for (const name of r.names) {
          assert.match(name, /^bay-1\//);
          assert.ok(type.sections[section].includes(`{module}/${name.slice('bay-1/'.length)}`),
            `${ref}: ${name} is not in the committed ${target} type ${type.model} under ${section}`);
          named.add(`${section} {module}/${name.slice('bay-1/'.length)}`);
          written++;
        }
      }
      // and nothing the type file lists is out of a cable's reach, on a module whose every port resolved
      if (!odd.some(o => o.startsWith(`${ref} `))) whole.push(ref);
      if (!odd.some(o => o.startsWith(`${ref} `)))
        for (const section of ['front-ports', 'rear-ports'])
          for (const name of type.sections[section])
            assert.ok(named.has(`${section} ${name}`), `${ref}: no cable end reaches ${name} of the ${target} type ${type.model}`);
    }
    assert.deepEqual(unfound, ['fs/fhd-fap12lcd-om5', 'fs/fhd-fap12mtp-b', 'fs/fhd-fap12mtp16-a'], 'the modules with no type file under their part number (#1025)');
    const partly = new Set(odd.map(o => o.split(' ')[0].split('@')[0]));
    assert.equal(whole.length + partly.size, modules);
    if (target === 'netbox') {
      assert.deepEqual([...new Set(odd.map(o => o.split(' ')[1]))], ['dcm'], 'only a DCM adapter is two kinds of port');
      assert.ok(modules >= 60 && whole.length >= 56 && written >= 900, `measured too little: ${modules} modules, ${whole.length} whole, ${written} names`);
    } else {
      // every module the Nautobot file cannot name is one of the two kinds the comment above gives
      for (const name of partly) {
        const l = moduleLists(target, latest(name)), listed = [...l.sections['front-ports'], ...l.sections['rear-ports']];
        assert.ok(!listed.length || listed.every(n => n.startsWith('{module.parent}/')), `${name}: left out for neither reason`);
      }
      const bare = [...partly].filter(name => { const l = moduleLists(target, latest(name)); return !l.sections['front-ports'].length && !l.sections['rear-ports'].length; });
      assert.deepEqual(bare.sort(), ['smartoptics/ppm-ad1-1510', 'smartoptics/ppm-ad1-1625', 'smartoptics/ppm-ocu-50-50', 'smartoptics/ppm-ocu-97-3']);
      assert.ok(modules >= 60 && whole.length >= 32 && written >= 750, `measured too little: ${modules} modules, ${whole.length} whole, ${written} names`);
    }
  });
}

// ── one rack, both files ─────────────────────────────────────────────────
const HELD = {'bay-1': PANEL, 'bay-2': CASSETTE};
const CTX = ctxFor(HELD);
const item = (id, ref, label, ru, swaps) => ({id, ref, cfg: ref === 'fhd-1ufce' ? 'seated' : 'base', label, ru, u: 1, face: 'front', turned: false,
                                             ...(swaps ? {swaps} : {})});
const optics = Object.fromEntries([1, 2, 3, 4].map(n => [`port-${n}`, OPTIC]));
const ITEMS = [item('i1', 'as7726-32x', 'sw-1', 20, optics), item('i2', 'fhd-1ufce', 'pp-1', 30), item('i3', 'fhd-1ufce', 'pp-2', 32),
               item('i4', 'as7726-32x', 'sw-2', 22, optics)];
const end = (itemId, path, view = 'front') => ({item: itemId, path, view});
const cable = (id, a, b, rest = {}) => ({id, a, b, media: 'os2', purpose: 'uplink', label: id.toUpperCase(), route: [],
                                         length: {value: 3, unit: 'm', source: 'entered'}, ...rest});
const CABLES = [
  cable('c1', end('i1', 'port-1'), end('i2', 'bay-1/module/lc01')),                       // an optic to a panel's front, duplex
  cable('c2', end('i2', 'bay-1/module/b01', 'rear'), end('i4', 'port-1')),                // a panel's rear to an optic
  cable('c3', end('i2', 'bay-2/module/lc1'), end('i1', 'port-2')),                        // a cassette's front to an optic
  cable('c4', end('i2', 'bay-2/module/mtp', 'rear'), end('i3', 'bay-2/module/mtp', 'rear'), {label: 'TRUNK-1', length: {value: 12.5, unit: 'm', source: 'entered'}}),
  cable('c5', end('i2', 'bay-1/module/lc02'), end('i3', 'bay-1/module/lc02')),            // front to front: two fibres at both ends
  cable('c6', end('i3', 'bay-1/module/b03', 'rear'), end('i2', 'bay-1/module/lc03')),     // one rear connector to two front ports
  cable('c7', end('i1', 'port-3'), end('i4', 'port-3'), {media: 'dac'})];                 // no module port at all
const RACK = {name: 'Panel cables', frame: M.normalizeFrame({heightRU: 42}), zeroU: [], items: ITEMS, cables: CABLES};
const ENDS = P.settleEnds(RACK, new Map(CABLES.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: null, reason: null}])), CTX);
const NAMES = X.uniqueNames(ITEMS), KEPT = new Set(ITEMS.map(i => i.id));
const file = target => D.cableImportRows({rack: RACK, target, names: NAMES, kept: KEPT, ends: ENDS, uOf: () => 1,
                                          resolve: resolverFor(RACK, CTX, target, HELD)});
const golden = target => new URL(`../fixtures/rack-exports/panel-cables.${target}.cables.csv`, import.meta.url);

for (const target of ['netbox', 'nautobot']) {
  test(`${target}: the cables file of a rack cabled through a panel and a cassette is the golden file`, () => {
    const got = file(target);
    assert.deepEqual(got.left, []);
    const text = X.toCsv(got.columns, got.rows);
    if (process.env.PORTRAYAL_WRITE_GOLDEN) fs.writeFileSync(golden(target), text);
    assert.equal(text, fs.readFileSync(golden(target), 'utf8'));
  });
}

test('NetBox: one row a cord, with both fibre ports of an adapter in one cell and one kind of port a side', () => {
  const got = file('netbox'), row = id => got.rows.find(r => r.label === id);
  const sides = r => [r.side_a_type, r.side_a_name, r.side_b_type, r.side_b_name];
  assert.equal(got.rows.length, 7);
  assert.deepEqual(sides(row('C1')), ['dcim.interface', 'port-1', 'dcim.frontport', 'bay-1/1,bay-1/2']);
  assert.deepEqual(sides(row('C2')), ['dcim.rearport', 'bay-1/B01-1', 'dcim.interface', 'port-1']);
  assert.deepEqual(sides(row('C3')), ['dcim.frontport', 'bay-2/1,bay-2/2', 'dcim.interface', 'port-2']);
  assert.deepEqual(sides(row('TRUNK-1')), ['dcim.rearport', 'bay-2/MTP-1', 'dcim.rearport', 'bay-2/MTP-1']);
  assert.deepEqual(sides(row('C5')), ['dcim.frontport', 'bay-1/3,bay-1/4', 'dcim.frontport', 'bay-1/3,bay-1/4']);
  assert.deepEqual(sides(row('C6')), ['dcim.rearport', 'bay-1/B03-1', 'dcim.frontport', 'bay-1/5,bay-1/6']);
  assert.deepEqual(sides(row('C7')), ['dcim.interface', 'port-3', 'dcim.interface', 'port-3']);
  assert.match(got.notes.join('\n'), /Its row names both, separated by a comma, which NetBox's cable import reads as the ports of one end: C1, C3, C5 and C6\./);
});

test('Nautobot: one port a side, so a row for each fibre, tied by the label; one row to the first port where the other end is single', () => {
  const got = file('nautobot');
  assert.deepEqual(got.rows.map(r => [r.label, r.a_type, r.a_name, r.b_type, r.b_name, r.length, r.length_unit]), [
    ['C1', 'dcim.interface', 'port-1', 'dcim.frontport', 'bay-1/1', 3, 'm'],
    ['C2', 'dcim.rearport', 'bay-1/B01-1', 'dcim.interface', 'port-1', 3, 'm'],
    ['C3', 'dcim.frontport', 'bay-2/1', 'dcim.interface', 'port-2', 3, 'm'],
    ['TRUNK-1', 'dcim.rearport', 'bay-2/MTP-1', 'dcim.rearport', 'bay-2/MTP-1', 13, 'm'],
    ['C5 (1/2)', 'dcim.frontport', 'bay-1/3', 'dcim.frontport', 'bay-1/3', 3, 'm'],
    ['C5 (2/2)', 'dcim.frontport', 'bay-1/4', 'dcim.frontport', 'bay-1/4', 3, 'm'],
    ['C6', 'dcim.rearport', 'bay-1/B03-1', 'dcim.frontport', 'bay-1/5', 3, 'm'],
    ['C7', 'dcim.interface', 'port-3', 'dcim.interface', 'port-3', 3, 'm']]);
  const notes = got.notes.join('\n');
  assert.match(notes, /one row for each fibre, first port to first port, .* as \(1\/2\)\. First to first is an order, not a polarity: .* The cords: C5\./);
  assert.match(notes, /and not one whose ends differ \(a Type A cassette facing a Type AF one/);
  assert.match(notes, /These ports have no cable in this file: C1 \(pp-1 bay-1\/2\); C3 \(pp-1 bay-2\/2\); C6 \(pp-1 bay-1\/6\)\./);
});

test('a port is used once: a second cable on either fibre of an adapter is left out, by its reason', () => {
  const again = cable('c8', end('i1', 'port-4'), end('i2', 'bay-1/module/lc01'));
  const rack = {...RACK, cables: [...CABLES, again]};
  const ends = P.settleEnds(rack, new Map(rack.cables.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: null, reason: null}])), CTX);
  for (const target of ['netbox', 'nautobot']) {
    const got = D.cableImportRows({rack, target, names: NAMES, kept: KEPT, ends, uOf: () => 1, resolve: resolverFor(rack, CTX, target, HELD)});
    assert.deepEqual(got.left, ['Cable C8 is not in the cables file: end B, pp-1 (U30) bay-1/module/lc01, already has cable C1 in this file.']);
  }
});

test('a long label keeps which fibre the row is', () => {
  const long = 'L'.repeat(100);
  const rack = {...RACK, cables: [cable('c5', CABLES[4].a, CABLES[4].b, {label: long})]};
  const ends = P.settleEnds(rack, new Map(rack.cables.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: null, reason: null}])), CTX);
  const got = D.cableImportRows({rack, target: 'nautobot', names: NAMES, kept: KEPT, ends, uOf: () => 1, resolve: resolverFor(rack, CTX, 'nautobot', HELD)});
  assert.deepEqual(got.rows.map(r => [X.charCount(r.label), r.label.slice(-9)]), [[100, ' c5 (1/2)'], [100, ' c5 (2/2)']]);
  assert.match(got.notes.join('\n'), /its 2 rows are labelled L{91} c5, the label shortened and the id of the cable after it/);
});

test('no two cords share the label that ties their rows: long labels alike in all that is kept, and one label on two cords', () => {
  const run = (l1, l2) => {
    const rack = {...RACK, cables: [cable('c5', CABLES[4].a, CABLES[4].b, {label: l1}),
                                    cable('c9', end('i2', 'bay-1/module/lc04'), end('i3', 'bay-1/module/lc04'), {label: l2})]};
    const ends = P.settleEnds(rack, new Map(rack.cables.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: null, reason: null}])), CTX);
    return D.cableImportRows({rack, target: 'nautobot', names: X.uniqueNames(ITEMS), kept: KEPT, ends, uOf: () => 1, resolve: resolverFor(rack, CTX, 'nautobot', HELD)});
  };
  const stems = got => got.rows.map(r => r.label.replace(/ \(\d\/2\)$/, ''));
  // 97 characters in common, so the 94 a row could keep are the same
  const long = run(`${'L'.repeat(97)}-A`, `${'L'.repeat(97)}-B`);
  assert.equal(long.rows.length, 4);
  assert.equal(new Set(long.rows.map(r => r.label)).size, 4);
  assert.deepEqual(stems(long), [`${'L'.repeat(91)} c5`, `${'L'.repeat(91)} c5`, `${'L'.repeat(91)} c9`, `${'L'.repeat(91)} c9`]);
  assert.ok(long.rows.every(r => X.charCount(r.label) <= 100));
  // one short label on two cords: the first keeps it, the second carries its id
  const twice = run('UPLINK', 'UPLINK');
  assert.deepEqual(twice.rows.map(r => r.label), ['UPLINK (1/2)', 'UPLINK (2/2)', 'UPLINK c9 (1/2)', 'UPLINK c9 (2/2)']);
  assert.match(twice.notes.join('\n'), /its 2 rows are labelled UPLINK c9, the label another cable has too and the id of the cable after it/);
  // and a cord whose label no other has is written as it is
  assert.deepEqual(run('A', 'B').rows.map(r => r.label), ['A (1/2)', 'A (2/2)', 'B (1/2)', 'B (2/2)']);
});

test('ends on two different counts of several ports: NetBox takes the row, Nautobot leaves the cord out, by its reason', () => {
  // No part of the library is three ports, so the ends are a resolver's own: two ports at one end, three at the other.
  const rack = {...RACK, cables: [cable('c5', CABLES[4].a, CABLES[4].b)]};
  const ends = new Map(rack.cables.flatMap(c => [c.a, c.b]).map(e => [CR.endKey(e), {info: null, reason: null}]));
  const resolve = e => ({ok: true, type: 'dcim.frontport', name: 'bay-1/1',
                         names: e.item === 'i2' ? ['bay-1/1', 'bay-1/2'] : ['bay-1/1', 'bay-1/2', 'bay-1/3']});
  const run = target => D.cableImportRows({rack, target, names: NAMES, kept: KEPT, ends, uOf: () => 1, resolve});
  assert.deepEqual(run('nautobot').rows, []);
  assert.deepEqual(run('nautobot').left, ['Cable C5 is not in the cables file: its ends are on 2 and 3 ports, and Nautobot gives a cable one port at each end.']);
  assert.deepEqual(run('netbox').left, []);
  assert.deepEqual(run('netbox').rows.map(r => [r.side_a_name, r.side_b_name]), [['bay-1/1,bay-1/2', 'bay-1/1,bay-1/2,bay-1/3']]);
});

test('with no catalogue the kit answers as it did: the part id is looked up, not guessed at', () => {
  const resolve = D.endResolver({rack: RACK, ctx: null, deviceOf: () => lists(ENCLOSURE.netbox), moduleAt: () => moduleLists('netbox', PANEL)});
  assert.deepEqual(resolve(end('i2', 'bay-1/module/lc01')), {ok: false, reason: 'the module type FHD-FAP12LCDXSMF lists no port named {module}/lc01'});
});
