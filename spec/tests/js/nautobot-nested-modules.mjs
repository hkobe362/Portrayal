// The Nautobot modules file writes a module seated in a bay of another module (roc-ops/Portrayal#1127).
//
// Nautobot 3.2.6's CSV import installs such a module with lookup columns down through the parent module: the device
// and the bay of the outermost module, then the bay of each module below it, one `parent_module_bay__parent_module__`
// more for each level of nesting. A CSV has one header, and rows of different depths name different columns, so the
// file is one SECTION PER DEPTH, each its own CSV with its own header: `columns` and `rows` are the modules in the
// device's bays (depth 0, as before), `deeper` holds the sections for depth 1 and below, outermost first. Importing
// them in that order installs a module after the one it sits in.
//
// Run with PORTRAYAL_COMPONENTS naming a directory of a built components.json (the sweep reads it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../../../kit/rack/dcim-rules.js';
import * as X from '../../../kit/rack/export-data.js';

const INDEX = process.env.PORTRAYAL_COMPONENTS;
assert.ok(INDEX, 'PORTRAYAL_COMPONENTS names the directory of a built components.json');
const COMPONENTS = JSON.parse(fs.readFileSync(`${INDEX}/components.json`, 'utf8')).components;
const byRef = new Map(COMPONENTS.map(c => [`${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`, c]));
const compByRef = ref => (ref == null ? null : byRef.get(String(ref).split(':')[0]) ?? null);
const refOf = c => `${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`;

const EXPORTS = new URL('../../../library/exports/', import.meta.url);
const PATHS = fs.readdirSync(new URL('nautobot/', EXPORTS), {recursive: true}).filter(p => p.endsWith('.yaml')).sort().map(p => `nautobot/${p}`);
const lists = path => D.typeLists(fs.readFileSync(new URL(path, EXPORTS), 'utf8'));
const moduleLists = ref => {
  const comp = compByRef(ref);
  const path = X.moduleTypePath(PATHS, X.partNumber(comp), comp?.name);
  return path ? lists(path) : null;
};

// ── the columns, by the depth ────────────────────────────────────────────
const UP = 'parent_module_bay__parent_module__';
const HEAD = ['module_type__manufacturer__name', 'module_type__model'];
const columnsAt = depth => [...HEAD, `${UP.repeat(depth)}parent_module_bay__parent_device__name`,
  ...Array.from({length: depth + 1}, (_, j) => `${UP.repeat(depth - j)}parent_module_bay__name`), 'status__name'];

// A host with a bay `drawer`; Fibrain's real drawer and holder types, from the committed Nautobot files.
const XCU = lists('nautobot/device-types/Fibrain/XCU10-21IC.yaml');
const DRAWER = {manufacturer: 'Fibrain', model: 'XCU10', lists: lists('nautobot/module-types/Fibrain/XCU10.yaml')};
const HOLDER = {manufacturer: 'Fibrain', model: 'XMI1051GA', lists: lists('nautobot/module-types/Fibrain/XMI1051GA.yaml')};
const NAMES = new Map([['i1', {name: 'xcu-1'}]]);
const rowsFor = (parts, types, device = XCU, kept = new Set(['i1'])) =>
  D.moduleImportRows({target: 'nautobot', parts, names: NAMES, kept, deviceOf: () => device, moduleOf: ref => types[ref] ?? null});

const NESTED_PARTS = [{itemId: 'i1', path: 'drawer/module/slot-1/module', ref: 'holder'}, {itemId: 'i1', path: 'drawer/module', ref: 'drawer'},
                      {itemId: 'i1', path: 'drawer/module/slot-1/module/sc01-occupant', ref: 'plug'}];
const TYPES = {drawer: DRAWER, holder: HOLDER};

test('a module nested one level has a row with the lookup columns down through its parent, after its parent', () => {
  const got = rowsFor(NESTED_PARTS, TYPES);
  assert.deepEqual(got.columns, ['module_type__manufacturer__name', 'module_type__model', 'parent_module_bay__parent_device__name',
    'parent_module_bay__name', 'status__name']);
  assert.deepEqual(got.rows, [{module_type__manufacturer__name: 'Fibrain', module_type__model: 'XCU10',
    parent_module_bay__parent_device__name: 'xcu-1', parent_module_bay__name: 'drawer', status__name: 'Planned'}]);
  assert.equal(got.deeper.length, 1);
  assert.equal(got.deeper[0].depth, 1);
  assert.deepEqual(got.deeper[0].columns, [
    'module_type__manufacturer__name', 'module_type__model',
    'parent_module_bay__parent_module__parent_module_bay__parent_device__name',
    'parent_module_bay__parent_module__parent_module_bay__name',
    'parent_module_bay__name', 'status__name']);
  assert.deepEqual(got.deeper[0].rows, [{module_type__manufacturer__name: 'Fibrain', module_type__model: 'XMI1051GA',
    parent_module_bay__parent_module__parent_module_bay__parent_device__name: 'xcu-1',
    parent_module_bay__parent_module__parent_module_bay__name: 'drawer', parent_module_bay__name: 'slot-1', status__name: 'Planned'}]);
  assert.deepEqual(got.deeper[0].columns, columnsAt(1));
  assert.deepEqual(got.left, []);
});

test('the note that tells the reader to install nested modules by hand is gone', () => {
  const got = rowsFor([{itemId: 'i1', path: 'drawer/module/slot-2/module', ref: 'holder'}, {itemId: 'i1', path: 'drawer/module/slot-1/module', ref: 'holder'},
                       {itemId: 'i1', path: 'drawer/module', ref: 'drawer'}], TYPES);
  assert.deepEqual(got.left, []);
  assert.deepEqual(got.deeper[0].rows.map(r => r.parent_module_bay__name), ['slot-2', 'slot-1']);
  assert.doesNotMatch(JSON.stringify(got), /by hand|cannot name|install it in the module bay/);
});

test('a module whose parent is not a row of the file is still left out, with the reason', () => {
  const got = rowsFor([NESTED_PARTS[0]], TYPES);
  assert.deepEqual([got.rows, got.deeper], [[], []]);
  assert.deepEqual(got.left, ['xcu-1 drawer/module/slot-1: XMI1051GA is not in the modules file. The module it sits in, at drawer, is not in the modules file.']);
});

// ── one more level for each level of nesting, with a fixture: the library holds none below depth 1 ──
const bays = (...ids) => `module-bays:\n${ids.map(id => `  - name: ${id}\n    position: ${id}\n`).join('')}`;
const A = {manufacturer: 'Acme', model: 'A', lists: D.typeLists(`model: A\n${bays('b1')}`)};
const B = {manufacturer: 'Acme', model: 'B', lists: D.typeLists(`model: B\n${bays('c1', 'c2')}`)};
const C = {manufacturer: 'Acme', model: 'C', lists: D.typeLists(`model: C\n${bays('d1')}`)};
const E = {manufacturer: 'Acme', model: 'E', lists: D.typeLists('model: E\n')};
const HOST = D.typeLists(`model: Host\n${bays('a')}`);
const DEEP_PARTS = [{itemId: 'i1', path: 'a/module/b1/module/c2/module/d1/module', ref: 'e'},   // listed before what holds it
                    {itemId: 'i1', path: 'a/module/b1/module/c1/module', ref: 'c'}, {itemId: 'i1', path: 'a/module/b1/module', ref: 'b'},
                    {itemId: 'i1', path: 'a/module/b1/module/c2/module', ref: 'c'}, {itemId: 'i1', path: 'a/module', ref: 'a'}];
const DEEP_TYPES = {a: A, b: B, c: C, e: E};

test('one more parent_module_bay__parent_module__ level for each level of modules', () => {
  const got = rowsFor(DEEP_PARTS, DEEP_TYPES, HOST);
  assert.deepEqual(got.left, []);
  assert.deepEqual(got.rows.map(r => r.module_type__model), ['A']);
  assert.deepEqual(got.deeper.map(s => s.depth), [1, 2, 3]);
  assert.deepEqual(got.deeper.map(s => s.columns), [1, 2, 3].map(columnsAt));
  assert.deepEqual(got.deeper[2].columns, [
    'module_type__manufacturer__name', 'module_type__model',
    'parent_module_bay__parent_module__parent_module_bay__parent_module__parent_module_bay__parent_module__parent_module_bay__parent_device__name',
    'parent_module_bay__parent_module__parent_module_bay__parent_module__parent_module_bay__parent_module__parent_module_bay__name',
    'parent_module_bay__parent_module__parent_module_bay__parent_module__parent_module_bay__name',
    'parent_module_bay__parent_module__parent_module_bay__name',
    'parent_module_bay__name', 'status__name']);
  assert.deepEqual(got.deeper[2].rows, [{module_type__manufacturer__name: 'Acme', module_type__model: 'E',
    [got.deeper[2].columns[2]]: 'xcu-1', [got.deeper[2].columns[3]]: 'a', [got.deeper[2].columns[4]]: 'b1',
    [got.deeper[2].columns[5]]: 'c2', parent_module_bay__name: 'd1', status__name: 'Planned'}]);
  assert.deepEqual(got.deeper[1].rows.map(r => [r.module_type__model, r.parent_module_bay__parent_module__parent_module_bay__name, r.parent_module_bay__name]),
    [['C', 'b1', 'c1'], ['C', 'b1', 'c2']]);
});

// ── the file as Nautobot's CSV import reads it ───────────────────────────
// Nautobot's import reads the header of a file once, takes each `__`-joined column as a lookup path into the row's
// fields, and looks every row up against the database as it is when the row is read. This stands in for that: it
// parses the CSV text the kit writes and resolves each row's chain of bays against what the files imported before
// have installed. A row it cannot resolve refuses the file whole, as Nautobot does.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function importFiles(files, {devices, types, installed = new Map()}) {
  for (const [name, text] of files) {
    const [head, ...body] = parseCsv(text);
    const depth = head[2].split('parent_module__').length - 1;
    for (const cells of body) {
      const row = Object.fromEntries(head.map((c, i) => [c, cells[i]]));
      for (const [c, v] of Object.entries(row)) if (v === '') throw new Error(`${name}: column ${c} is blank`);
      const model = row.module_type__model, type = types[model];
      if (!type) throw new Error(`${name}: no module type ${model}`);
      // the chain, outermost first: device, then a bay name for each level
      const chain = [row[head[2]], ...Array.from({length: depth + 1}, (_, j) => row[`${UP.repeat(depth - j)}parent_module_bay__name`])];
      if (!devices.has(chain[0])) throw new Error(`${name}: no device ${chain[0]}`);
      let holder = devices.get(chain[0]), key = chain[0];
      for (const [k, bayName] of chain.slice(1).entries()) {
        if (!holder.bays.some(b => b.name === bayName)) throw new Error(`${name}: ${key} has no module bay ${bayName}`);
        key = `${key}|${bayName}`;
        if (k < depth) {
          const inside = installed.get(key);
          if (!inside) throw new Error(`${name}: no module installed in ${key}`);
          holder = inside.lists;
        }
      }
      if (installed.has(key)) throw new Error(`${name}: ${key} already holds a module`);
      installed.set(key, type);
    }
  }
  return installed;
}
const FILE = (columns, rows) => X.toCsv(columns, rows);
const filesOf = got => [['depth-0', FILE(got.columns, got.rows)], ...got.deeper.map(s => [`depth-${s.depth}`, FILE(s.columns, s.rows)])];

test('the files import as Nautobot reads them: each depth in its own file, in order, a module after the one it sits in', () => {
  const got = rowsFor(DEEP_PARTS, DEEP_TYPES, HOST);
  const world = {devices: new Map([['xcu-1', HOST]]), types: Object.fromEntries(Object.values(DEEP_TYPES).map(t => [t.model, t]))};
  const done = importFiles(filesOf(got), world);
  assert.deepEqual([...done.keys()].sort(), ['xcu-1|a', 'xcu-1|a|b1', 'xcu-1|a|b1|c1', 'xcu-1|a|b1|c2', 'xcu-1|a|b1|c2|d1']);
  // out of order the same files are refused: the module a row sits in is not installed yet
  assert.throws(() => importFiles([...filesOf(got)].reverse(), {...world, installed: new Map()}), /no module installed in/);
  // and one header cannot carry two depths: the second depth's columns are not the first's
  assert.notDeepEqual(got.deeper[0].columns, got.columns);
});

test('the Fibrain drawer and its holders import from the committed Nautobot type files', () => {
  const got = rowsFor([{itemId: 'i1', path: 'drawer/module/slot-2/module', ref: 'holder'}, {itemId: 'i1', path: 'drawer/module/slot-1/module', ref: 'holder'},
                       {itemId: 'i1', path: 'drawer/module', ref: 'drawer'}], TYPES);
  const types = {XCU10: {lists: DRAWER.lists}, XMI1051GA: {lists: HOLDER.lists}};
  assert.deepEqual([...importFiles(filesOf(got), {devices: new Map([['xcu-1', XCU]]), types}).keys()].sort(),
    ['xcu-1|drawer', 'xcu-1|drawer|slot-1', 'xcu-1|drawer|slot-2']);
});

test("the README lists a file for each depth after the modules file, and a rack with none reads as it did", () => {
  const rack = {name: 'R', frame: {heightRU: 24, numbering: 'bottom-up'}};
  const text = rowsIn => D.kitReadme({target: 'nautobot', rack, date: new Date(Date.UTC(2026, 9, 4)), dcim: {site: 'L', role: 'X'},
    rows: {devices: 1, modules: 1, cables: 0, modulesIn: rowsIn}}).text.split('\n');
  const flat = text([2, 1]).join(' ').replace(/\s+/g, ' ');
  const one = 'Then 2b-modules-depth-1.csv (2 rows), the same way: modules in a bay of a module of that file.';
  const two = 'Then 2b-modules-depth-2.csv (1 row), the same way: modules in a bay of a module of the file before.';
  assert.ok(flat.includes(`${one} ${two}`), flat);
  assert.ok(flat.indexOf('2-modules.csv') < flat.indexOf(one) && flat.indexOf(two) < flat.indexOf('Not in this kit'));
  assert.deepEqual(text([]), text(undefined));
  assert.ok(!text(undefined).join('\n').includes('modules-depth'));
  assert.equal(D.nautobotModuleFile(0), '2-modules.csv');
  assert.ok([D.nautobotModuleFile(1), D.nautobotModuleFile(2)].every(f => f > '2-modules.csv' && f < '3-cables.csv'));
});

// ── a rack with no nested module: the file is what it was ────────────────
const FLAT = {i1: lists('nautobot/device-types/Cisco/ASR-9006-AC-V2.yaml')};
test('a rack with no nested module gives a byte-identical file, and no section beyond it', () => {
  const card = {manufacturer: 'Cisco', model: 'A9K-16X100GE-TR', lists: lists('nautobot/module-types/Cisco/A9K-16X100GE-TR.yaml')};
  const got = D.moduleImportRows({target: 'nautobot', names: NAMES, kept: new Set(['i1']), deviceOf: id => FLAT[id], moduleOf: () => card,
    parts: [{itemId: 'i1', path: 'slot-2/module', ref: 'c'}, {itemId: 'i1', path: 'slot-2/module/p0-occupant', ref: 'o'}, {itemId: 'i1', path: 'slot-3/module', ref: 'c'}]});
  assert.deepEqual(got.deeper, []);
  assert.deepEqual(got.left, []);
  // the golden text, as the kit wrote it before nested modules were written
  assert.equal(X.toCsv(got.columns, got.rows),
    'module_type__manufacturer__name,module_type__model,parent_module_bay__parent_device__name,parent_module_bay__name,status__name\r\n' +
    'Cisco,A9K-16X100GE-TR,xcu-1,slot-2,Planned\r\n' +
    'Cisco,A9K-16X100GE-TR,xcu-1,slot-3,Planned\r\n');
});

test('the NetBox modules file is unchanged', () => {
  const types = {drawer: {...DRAWER, lists: lists('netbox/module-types/Fibrain/XCU10.yaml')}, holder: {...HOLDER, lists: lists('netbox/module-types/Fibrain/XMI1051GA.yaml')}};
  const got = D.moduleImportRows({target: 'netbox', parts: NESTED_PARTS, names: NAMES, kept: new Set(['i1']),
    deviceOf: () => lists('netbox/device-types/Fibrain/XCU10-21IC.yaml'), moduleOf: ref => types[ref] ?? null});
  assert.deepEqual(Object.keys(got).sort(), ['columns', 'left', 'rows']);
  assert.equal(X.toCsv(got.columns, got.rows),
    'device,module_bay,module_type,status\r\n' +
    'xcu-1,drawer,XCU10,planned\r\n' +
    'xcu-1,drawer/slot-1,XMI1051GA,planned\r\n');
});

// ── the sweep: every module a bay of another module accepts, on the committed Nautobot type files ──
const parentsOf = new Map();
for (const parent of COMPONENTS.filter(c => c.kind === 'module' && !c['superseded-by'] && c.bays))
  for (const [bayId, b] of Object.entries(parent.bays))
    for (const accepted of b.accepts ?? []) parentsOf.set(accepted, [...(parentsOf.get(accepted) ?? []), {parent, bayId}]);
const NESTED = COMPONENTS.filter(c => c.kind === 'module' && c.optical?.ports && !c['superseded-by'] && parentsOf.has(refOf(c)));
const DEVICE_BAY = {'fibrain/xcu-drawer': 'drawer'};

test('every nested module in the library writes one row, on the committed Nautobot type files', () => {
  assert.equal(NESTED.length, 28);
  let rows = 0;
  const seen = new Set();
  for (const comp of NESTED) {
    const ref = refOf(comp), type = moduleLists(ref);
    assert.ok(type, `${ref} has a Nautobot type file`);
    for (const {parent, bayId} of parentsOf.get(ref)) {
      const carrierRef = refOf(parent), carrier = moduleLists(carrierRef);
      assert.ok(carrier, `${carrierRef} has a Nautobot type file`);
      const devBay = DEVICE_BAY[`${parent.ns}/${parent.name}`] ?? 'slot-1';
      const carrierBay = carrier.bays.find(b => b.position.split('/').pop() === bayId || b.name === bayId);
      assert.ok(carrierBay, `${carrierRef}: no module bay ${bayId}`);
      const host = D.typeLists(`model: Host\n${bays(devBay)}`);
      const comps = {[carrierRef]: {manufacturer: 'M', model: carrier.model, lists: carrier}, [ref]: {manufacturer: 'M', model: type.model, lists: type}};
      const got = rowsFor([{itemId: 'i1', path: `${devBay}/module/${bayId}/module`, ref}, {itemId: 'i1', path: `${devBay}/module`, ref: carrierRef}], comps, host);
      assert.deepEqual(got.left, [], `${ref} in ${carrierRef}`);
      assert.equal(got.rows.length, 1, `${carrierRef} in the device's bay`);
      assert.equal(got.deeper.length, 1, `${ref} in ${carrierRef}`);
      assert.deepEqual(got.deeper[0].rows, [{module_type__manufacturer__name: 'M', module_type__model: type.model,
        parent_module_bay__parent_module__parent_module_bay__parent_device__name: 'xcu-1',
        parent_module_bay__parent_module__parent_module_bay__name: devBay, parent_module_bay__name: carrierBay.name, status__name: 'Planned'}]);
      // the files import: the carrier, then the module in it
      importFiles(filesOf(got), {devices: new Map([['xcu-1', host]]), types: {[carrier.model]: {lists: carrier}, [type.model]: {lists: type}}});
      rows++;
      seen.add(ref);
    }
  }
  assert.equal(seen.size, 28);
  assert.equal(rows, NESTED.reduce((n, c) => n + parentsOf.get(refOf(c)).length, 0));
  assert.deepEqual([NESTED.filter(c => c.ns === 'fibrain').length, NESTED.filter(c => c.ns === 'smartoptics').length], [20, 8]);
});
