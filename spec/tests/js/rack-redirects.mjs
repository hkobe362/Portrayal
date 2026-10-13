// spec/tests/js/rack-redirects.mjs
// A replaced part leaves a redirect (#1049): the library says on the
// REPLACEMENT which removed refs it stands in for (`supersedes`, published on
// its components.json entry); the kit follows them when it reads a swap, and
// writes the new ref only when a rack is saved after an edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as Q from '../../../kit/rack/queries.js';
import {COMMANDS, apply} from '../../../kit/rack/commands.js';
import {createRackEditor} from '../../../kit/rack/editor.js';
import {slotEnv, holdsAt} from '../../../kit/rack/slots.js';
import {redirectsOf, resolverOf, followSwaps, auditRack, rewriteRack, pairText, MAX_HOPS} from '../../../kit/redirects.js';
import * as F from './slot-fixtures.mjs';

const SIG = 'sha256:' + '0'.repeat(64);
const claim = ref => ({ref, signature: SIG, from: '0123abc'});
const entry = (ns, name, major, supersedes = []) => ({ns, name, major: `v${major}`, supersedes});

// ---- the resolver --------------------------------------------------------

test('a table is read off the entries that carry supersedes', () => {
  const r = redirectsOf([entry('acme', 'lc6', 2, [claim('acme/lc6@1')]), entry('acme', 'blank', 1), {ns: 'x'}]);
  assert.equal(r.size, 1);
  assert.equal(r.follow('acme/lc6@1'), 'acme/lc6@2');
  assert.equal(r.follow('acme/blank@1'), 'acme/blank@1');
  assert.equal(r.catalogued, 2);
});

test('an entry with no list, a malformed list or a malformed claim adds nothing and throws nothing', () => {
  const r = redirectsOf([{ns: 'a', name: 'b', major: 'v2', supersedes: null}, {ns: 'a', name: 'c', major: 'v2', supersedes: 'a/b@1'},
    {ns: 'a', name: 'd', major: 'v2', supersedes: [null, 7, {ref: 5}, {ref: ''}, {}]}, null, 'x']);
  assert.equal(r.size, 0);
  assert.equal(redirectsOf(null).size, 0);
  assert.equal(redirectsOf(undefined).follow('a/b@1'), 'a/b@1');
});

test('a ref the catalogue still has is never redirected', () => {
  const r = redirectsOf([entry('acme', 'lc6', 2, [claim('acme/lc6@1')]), entry('acme', 'lc6', 1)]);
  assert.equal(r.follow('acme/lc6@1'), 'acme/lc6@1');
  assert.equal(r.size, 0);
});

// A catalogue read from components.json cannot hold a chain: a claim is made
// by a part that is published, so what it names is the end. The resolver is
// still bounded, for a table that is built some other way.
test('a chain of removed refs is followed to its end, one hop at a time', () => {
  const r = resolverOf(new Map([['a/y@3', 'a/z@4'], ['a/z@4', 'a/w@7']]));
  assert.equal(r.follow('a/y@3'), 'a/w@7');
  assert.deepEqual(r.trace('a/y@3'), {ref: 'a/w@7', from: 'a/y@3', hops: 2, loop: false});
  assert.deepEqual(r.trace('a/w@7'), {ref: 'a/w@7', from: null, hops: 0, loop: false});
});

test('a loop is never entered: the ref comes back as it was, flagged', () => {
  const r = resolverOf(new Map([['a/p@5', 'a/q@5'], ['a/q@5', 'a/p@5'], ['a/s@1', 'a/s@1']]));
  for (const ref of ['a/p@5', 'a/q@5', 'a/s@1']) {
    assert.equal(r.follow(ref), ref);
    assert.equal(r.trace(ref).loop, true);
  }
});

test('a chain longer than the bound is left where it was', () => {
  const m = new Map();
  for (let i = 0; i < MAX_HOPS + 3; i++) m.set(`c/p${i}@1`, `c/p${i + 1}@1`);
  const r = resolverOf(m);
  assert.equal(r.follow('c/p0@1'), 'c/p0@1');
  assert.equal(r.trace('c/p0@1').loop, true);
  assert.equal(r.follow(`c/p${3}@1`), `c/p${MAX_HOPS + 3}@1`);
});

test('a ref with a version suffix keeps it', () => {
  const r = redirectsOf([entry('acme', 'lc6', 2, [claim('acme/lc6@1')])]);
  assert.equal(r.follow('acme/lc6@1:1.2.0'), 'acme/lc6@2:1.2.0');
});

test('what is not a ref comes back as it came', () => {
  const r = redirectsOf([entry('acme', 'lc6', 2, [claim('acme/lc6@1')])]);
  for (const v of [null, undefined, '', 7, {}, ['acme/lc6@1']]) assert.equal(r.follow(v), v);
  assert.equal(r.follow('constructor'), 'constructor');
  assert.equal(r.follow('__proto__'), '__proto__');
});

test('one spelling: a pair is written "old is now new"', () => {
  assert.equal(pairText('acme/lc6@1', 'acme/lc6@2'), 'acme/lc6@1 is now acme/lc6@2');
});

// ---- the fixtures: a patch panel whose cassette took a major -------------

const OLD = 'acme/lc6@1', NEW = 'acme/lc6@2';
const bump = o => JSON.parse(JSON.stringify(o).replaceAll(OLD, NEW));
const SLOTS = bump(F.SLOTS);
const COMPONENTS = {...bump(F.COMPONENTS)};
delete COMPONENTS[OLD];
COMPONENTS[NEW] = {...F.COMPONENTS[OLD], description: 'LC cassette - six LC duplex, redrawn'};
const LIST = [entry('acme', 'lc6', 2, [claim(OLD)]), entry('acme', 'mpo2', 1), entry('acme', 'blank', 1)];
const compByRef = ref => {
  const k = ref == null ? null : String(ref).split(':')[0];
  return k && Object.hasOwn(COMPONENTS, k) ? COMPONENTS[k] : null;
};
const slotsOf = ref => (Object.hasOwn(SLOTS, ref) ? SLOTS[ref] : null);
const redirects = redirectsOf(LIST);
const withR = {chassisOf: F.chassisOf, slotsOf, compByRef, redirects};
const without = {chassisOf: F.chassisOf, slotsOf, compByRef};
const GONE = 'acme/gone@1';

const rackWith = (swaps, extra = {}) => {
  let r = M.newRack();
  r = M.withItem(r, {ref: 'pp', cfg: 'empty', ru: 5, label: 'PP-A', swaps}).rack;
  r = M.withItem(r, {ref: 'pp', cfg: 'empty', ru: 8, label: 'PP-B', swaps: {'bay-1': OLD}}).rack;
  r = M.withItem(r, {ref: 'leaf', cfg: 'base', ru: 12, label: 'LEAF'}).rack;
  return {...r, ...extra};
};

// ---- reading -------------------------------------------------------------

test('a swap that names the old ref is read as the new one', () => {
  const item = rackWith({'bay-1': OLD}).items[0];
  const env = slotEnv(item, slotsOf('pp'), compByRef, redirects);
  assert.equal(holdsAt(env, item.swaps, 'bay-1', env.bays[0]), NEW);
  const bare = slotEnv(item, slotsOf('pp'), compByRef);
  assert.equal(holdsAt(bare, item.swaps, 'bay-1', bare.bays[0]), OLD, 'without redirects the file is read as written');
});

test('inspect says the old ref was read as the new one, and what it seats is the new part', async () => {
  const rack = rackWith({'bay-1': OLD});
  const out = await Q.inspect(rack, 'i1', withR);
  assert.equal(out.bays.find(b => b.path === 'bay-1').holds, NEW);
  assert.deepEqual(out.redirected, [{path: 'bay-1', from: OLD, to: NEW}]);
  assert.match(out.notes.join('\n'), /acme\/lc6@1 is now acme\/lc6@2/);
  assert.ok(out.cages.some(c => c.path.startsWith('bay-1/module/')), 'the ports of the new part are listed');
  const plain = await Q.inspect(rack, 'i1', without);
  assert.equal(plain.redirected, undefined);
});

test('an item with nothing to follow says nothing', async () => {
  const out = await Q.inspect(rackWith({}), 'i1', withR);
  assert.equal(out.redirected, undefined);
  assert.equal(out.notes, undefined);
  assert.equal(out.unknown, undefined);
});

test('a ref that is gone and redirected nowhere is kept and reported by name', async () => {
  const rack = rackWith({'bay-1': GONE});
  const out = await Q.inspect(rack, 'i1', withR);
  assert.deepEqual(out.unknown, [{path: 'bay-1', ref: GONE}]);
  assert.match(out.notes.join('\n'), /acme\/gone@1 .*bay-1.* is no longer in the library/);
  assert.equal(out.bays.find(b => b.path === 'bay-1').holds, GONE, 'it is not replaced by the slot default');
});

test('with no catalogue at all nothing is called unknown', () => {
  const a = auditRack(rackWith({'bay-1': GONE}), {chassisOf: F.chassisOf, slotsOf, compByRef: () => null, redirects: redirectsOf([])});
  assert.deepEqual(a.unknown, []);
});

// ---- the audit ------------------------------------------------------------

test('auditRack lists the swaps it would follow and the refs it would keep', () => {
  const rack = rackWith({'bay-1': OLD, 'bay-2': GONE});
  const a = auditRack({...rack, zeroU: [{id: 'z1', ref: 'pp', ru: 1, swaps: {'bay-1': OLD}}]}, withR);
  assert.deepEqual(a.redirected.map(x => [x.item, x.path, x.from, x.to]),
    [['i1', 'bay-1', OLD, NEW], ['i2', 'bay-1', OLD, NEW], ['z1', 'bay-1', OLD, NEW]]);
  assert.deepEqual(a.unknown.map(x => [x.item, x.path, x.ref]), [['i1', 'bay-2', GONE]]);
});

test('auditRack on a rack that needs nothing is empty, and never throws on a rack that is not one', () => {
  assert.deepEqual(auditRack(M.newRack(), withR), {redirected: [], unknown: []});
  assert.deepEqual(auditRack(null, withR), {redirected: [], unknown: []});
  assert.deepEqual(auditRack({items: [null, {swaps: 7}, {swaps: {a: 5, b: null, c: ''}}]}, withR), {redirected: [], unknown: []});
});

test('followSwaps rewrites values and keeps keys, order and every other value', () => {
  const m = {'bay-2': 'acme/blank@1', 'bay-1': OLD, 'port-1': null, 'x': GONE};
  const f = followSwaps(m, redirects);
  assert.deepEqual(Object.keys(f.swaps), Object.keys(m));
  assert.deepEqual(f.swaps, {'bay-2': 'acme/blank@1', 'bay-1': NEW, 'port-1': null, 'x': GONE});
  assert.deepEqual(f.moved, [{path: 'bay-1', from: OLD, to: NEW}]);
  assert.equal(followSwaps(m, undefined).swaps, m);
  const same = followSwaps({'bay-2': 'acme/blank@1'}, redirects);
  assert.equal(same.moved.length, 0);
});

test('rewriteRack hands back the very rack when nothing is redirected', () => {
  const rack = rackWith({});
  rack.items[1].swaps = {};
  assert.equal(rewriteRack(rack, redirects).rack, rack);
  assert.equal(rewriteRack(rack, undefined).rack, rack);
});

test('rewriteRack rewrites items and zero-U parts and touches nothing else', () => {
  const rack = {...rackWith({'bay-1': OLD}), zeroU: [{id: 'z1', ref: 'pp', ru: 1, swaps: {'bay-1': OLD}, fields: {a: 1}}], cables: [{id: 'c1'}]};
  const out = rewriteRack(rack, redirects);
  assert.deepEqual(out.rack.items.map(i => i.swaps), [{'bay-1': NEW}, {'bay-1': NEW}, {}]);
  assert.deepEqual(out.rack.zeroU[0], {id: 'z1', ref: 'pp', ru: 1, swaps: {'bay-1': NEW}, fields: {a: 1}});
  assert.equal(out.rack.cables, rack.cables);
  assert.equal(out.rack.items[2], rack.items[2]);
  assert.equal(out.changed.length, 3);
  assert.equal(rack.items[0].swaps['bay-1'], OLD, 'the rack it was given is not changed');
});

// ---- a plain load and save changes nothing -------------------------------

const text = doc => M.serialize(doc);

test('a plain load and save is byte-identical, redirected refs and all', () => {
  const rack = rackWith({'bay-1': OLD, 'bay-2': GONE});
  const saved = text({format: M.FORMAT, version: M.VERSION, id: 'd1', racks: [rack]});
  const ed = createRackEditor({doc: M.parseDoc(saved), chassisOf: F.chassisOf});
  const loaded = ed.loadDoc(M.parseDoc(saved), {ctx: withR});
  assert.equal(text(ed.getDoc()), saved);
  const said = loaded.findings.map(f => f.text).join('\n');
  assert.match(said, /acme\/lc6@1 is now acme\/lc6@2/);
  assert.match(said, /not changed until it is next edited/);
  assert.match(said, /acme\/gone@1 .*is no longer in the library/);
});

test('loadDoc with no ctx behaves as it always did', () => {
  const saved = text({format: M.FORMAT, version: M.VERSION, id: 'd1', racks: [rackWith({'bay-1': OLD})]});
  const ed = createRackEditor({doc: M.parseDoc(saved), chassisOf: F.chassisOf});
  const loaded = ed.loadDoc(M.parseDoc(saved));
  assert.equal(loaded.findings.filter(f => /lc6/.test(f.text)).length, 0);
  assert.equal(text(ed.getDoc()), saved);
});

// ---- the first landed edit rewrites, and says so ----------------------------

test('the first edit that lands rewrites every redirected ref in the rack, and the finding says so', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'patch', id: 'i3', label: 'LEAF-1'}, withR);
  assert.ok(!res.error, res.error);
  assert.deepEqual(res.rack.items.map(i => i.swaps), [{'bay-1': NEW}, {'bay-1': NEW}, {}]);
  const said = res.findings.map(f => f.text).join('\n');
  assert.match(said, /the edit wrote the new ones: acme\/lc6@1 is now acme\/lc6@2 \(2 swaps on 2 devices\)\./);
});

test('an edit that changes nothing leaves the rack as it is', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'patch', id: 'i3', label: 'LEAF'}, withR);
  assert.equal(res.noop, true);
  assert.equal(res.rack, rack);
  assert.deepEqual(res.findings, []);
});

test('an edit that is refused leaves the rack as it is', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'patch', id: 'i9', label: 'x'}, withR);
  assert.ok(res.error);
  assert.equal(res.rack, undefined);
});

test('a command that is not a step does not count as an edit', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'dcim', site: 'S'}, withR);
  assert.ok(!res.error, res.error);
  assert.equal(res.rack.items[0].swaps['bay-1'], OLD);
});

test('a rack with nothing to follow gets the finding of no edit and no rewrite', () => {
  const rack = rackWith({});
  rack.items[1].swaps = {};
  const res = apply(rack, {op: 'patch', id: 'i3', label: 'LEAF-1'}, withR);
  assert.deepEqual(res.findings, []);
  assert.equal(res.rack.items[0], rack.items[0]);
});

test('without redirects in the context an edit rewrites nothing', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'patch', id: 'i3', label: 'LEAF-1'}, without);
  assert.equal(res.rack.items[0].swaps['bay-1'], OLD);
});

test('through the editor: one history step, and undo brings the old refs back with the edit', () => {
  const ed = createRackEditor({doc: {format: M.FORMAT, version: M.VERSION, id: 'd', racks: [rackWith({'bay-1': OLD})]}, chassisOf: F.chassisOf});
  const res = ed.apply({op: 'patch', id: 'i3', label: 'LEAF-1'}, {ctx: withR});
  assert.ok(!res.error, res.error);
  assert.equal(ed.rack().items[0].swaps['bay-1'], NEW);
  assert.equal(ed.canUndo, true);
  ed.undo();
  assert.equal(ed.rack().items[0].swaps['bay-1'], OLD);
  assert.equal(ed.rack().items[2].label, 'LEAF');
});

// ---- the data-loss case: an edit that writes back what the slot accepts --------

test('today an edit drops a swap that names the removed ref; with redirects it keeps it, as the new ref', () => {
  const rack = rackWith({'bay-1': OLD, 'bay-2': 'acme/blank@1'});
  const echo = {op: 'patch', id: 'i1', swaps: rack.items[0].swaps};
  const lost = apply(rack, echo, without);
  assert.deepEqual(lost.rack.items[0].swaps, {'bay-2': 'acme/blank@1'}, 'the swap is dropped without redirects');
  assert.match(lost.findings.map(f => f.text).join('\n'), /Left out bay-1/);
  const kept = apply(rack, echo, withR);
  assert.deepEqual(kept.rack.items[0].swaps, {'bay-1': NEW, 'bay-2': 'acme/blank@1'});
  assert.ok(!kept.findings.some(f => /Left out/.test(f.text)));
});

test('an edit that echoes a ref gone for good keeps it and says so, where it used to drop it', () => {
  const rack = rackWith({'bay-1': GONE});
  const echo = {op: 'patch', id: 'i1', swaps: {'bay-1': GONE, 'bay-2': 'acme/blank@1'}};
  const res = apply(rack, echo, withR);
  assert.deepEqual(res.rack.items[0].swaps, {'bay-1': GONE, 'bay-2': 'acme/blank@1'});
  assert.match(res.findings.map(f => f.text).join('\n'), /acme\/gone@1 .*bay-1.* is no longer in the library; it is kept as written/);
});

test('what sits under a ref that is gone is kept with it', () => {
  const rack = rackWith({'bay-1': GONE, 'bay-1/module/lc1': 'acme/lc-plug@1'});
  const echo = {op: 'patch', id: 'i1', swaps: rack.items[0].swaps};
  const res = apply(rack, echo, withR);
  assert.deepEqual(res.rack.items[0].swaps, {'bay-1': GONE, 'bay-1/module/lc1': 'acme/lc-plug@1'});
});

test('a ref that is gone, on a slot that does not exist, is still dropped as before', () => {
  const rack = rackWith({});
  const res = apply(rack, {op: 'patch', id: 'i1', swaps: {'bay-99': GONE}}, withR);
  assert.deepEqual(res.rack.items[0].swaps, {});
});

test('fit with the old ref seats the new part and says it read the old as the new', () => {
  const rack = rackWith({});
  const res = apply(rack, {op: 'fit', id: 'i1', path: 'bay-1', ref: OLD}, withR);
  assert.ok(!res.error, res.error);
  assert.equal(res.rack.items[0].swaps['bay-1'], NEW);
  assert.match(res.findings.map(f => f.text).join('\n'), /acme\/lc6@1 is now acme\/lc6@2/);
  const no = apply(rack, {op: 'fit', id: 'i1', path: 'bay-1', ref: OLD}, without);
  assert.match(no.error, /does not take acme\/lc6@1/);
});

test('fit on one slot carries the redirected refs of the others forward', () => {
  const rack = rackWith({'bay-1': OLD});
  const res = apply(rack, {op: 'fit', id: 'i1', path: 'bay-2', ref: 'acme/mpo2@1'}, withR);
  assert.deepEqual(res.rack.items[0].swaps, {'bay-1': NEW, 'bay-2': 'acme/mpo2@1'});
});

// ---- the commands table and the catalogue ----------------------------------

test('the commands table is unchanged: redirects add no command', () => {
  assert.ok(!Object.keys(COMMANDS).some(k => /redirect/i.test(k)));
});

// loadSlots reads components.json once and answers the table with the rest.
globalThis.location = {href: 'https://page.test/', search: ''};
let files = {};
globalThis.fetch = async url => {
  const name = url.slice('https://page.test/d/'.length);
  return Object.hasOwn(files, name) ? {ok: true, json: async () => files[name]} : {ok: false, status: 404};
};
const {loadSlots} = await import('../../../kit/rack/catalog.js');
const {clearDistCache} = await import('../../../kit/dist.js');

test('loadSlots hands the table on, read off components.json', async () => {
  clearDistCache();
  files = {'components.json': {components: [{ns: 'acme', name: 'lc6', major: 'v2', supersedes: [claim(OLD)]}, {ns: 'acme', name: 'blank', major: 'v1', supersedes: []}]}};
  const s = await loadSlots('/d', []);
  assert.equal(s.redirects.follow(OLD), NEW);
  assert.equal(s.redirects.catalogued, 2);
  assert.equal(s.compByRef(OLD), null, 'compByRef answers what components.json holds: the old ref is not an entry');
});

test('a components.json from before the key reads as no redirects', async () => {
  clearDistCache();
  files = {'components.json': {components: [{ns: 'acme', name: 'blank', major: 'v1'}]}};
  const s = await loadSlots('/d', []);
  assert.equal(s.redirects.size, 0);
  assert.equal(s.redirects.follow(OLD), OLD);
});

test('a failed components.json leaves no redirects and no unknown refs', async () => {
  clearDistCache();
  files = {};
  const s = await loadSlots('/d', []);
  assert.equal(s.redirects.size, 0);
  assert.equal(s.redirects.catalogued, 0);
});
