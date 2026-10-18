// spec/tests/js/rack-frames.mjs
// RACK PRODUCTS APPLIED TO A FRAME (#935 step 2, docs/rack-products-design.md
// section 9): the catalogue's `frames`, `frame.apply`, `frame.customise`, a
// frame held to what its product fixes, and a ref the catalogue lacks or
// disagrees with. The file stays what a version-3 reader reads: only `ref` and
// the frame keys it already had are ever written.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as V3 from '../fixtures/rack-readers/model-v3.js';
import {validate} from '../../../kit/rack/validate.js';
import {COMMANDS} from '../../../kit/rack/commands.js';
import {createRackEditor} from '../../../kit/rack/editor.js';
import * as F from '../../../kit/rack/frames.js';

// jdist resolves a url against location.href and fetches it: stand both in.
globalThis.location = {href: 'https://page.test/', search: ''};
let bodies = {};
globalThis.fetch = async url => ({ok: true, json: async () => bodies[url]});
const {loadCatalog} = await import('../../../kit/rack/catalog.js');
const {clearDistCache} = await import('../../../kit/dist.js');

// The rows rack.json holds for these products (spec/tests/test_rack_frames.py
// pins them to the manifests).
const AR203A = {ref: 'apc/ar203a@1', vendor: 'apc', name: 'ar203a', version: '1.0.0', major: 1, manufacturer: 'APC', model: 'AR203A',
  maturity: 'modelled', form: '4-post-frame', ru: 44, numbering: {direction: 'bottom-up', start: 1}, width: 19,
  'hole-centres': 465.1, opening: 450.85, holes: {style: 'square', size: 9.5, fixing: 'M6'},
  rails: [{id: 'front'}, {id: 'rear', depth: {fixed: 740}}], 'max-device-depth': 740,
  outer: {w: 600, h: 2130, d: 747}, 'weight-kg': 40.32, load: {'static-kg': 907.2}};
const AR201 = {ref: 'apc/ar201@1', vendor: 'apc', name: 'ar201', version: '1.0.0', major: 1, manufacturer: 'APC', model: 'AR201',
  maturity: 'modelled', form: '2-post-frame', ru: 45, numbering: {direction: 'bottom-up', start: 1}, width: 19,
  'hole-centres': 465.1, opening: 450.85, holes: {style: 'tapped', thread: '12-24'}, rails: [{id: 'front'}],
  'max-device-depth': 1048, outer: {w: 513, h: 2136, d: 376}, 'weight-kg': 11.82, load: {'static-kg': 340.2}};
const GENERIC = {ref: 'generic/4-post-frame@1', vendor: 'generic', name: '4-post-frame', version: '1.0.0', major: 1,
  manufacturer: 'Generic', model: '4-post-frame', maturity: 'modelled', form: '4-post-frame', ru: 42,
  numbering: {direction: 'bottom-up', start: 1}, width: 19, 'hole-centres': 465, opening: 450, holes: {style: 'square'},
  rails: [{id: 'front'}, {id: 'rear'}]};
// a product whose rear rail moves in steps, and a short one: neither is in the library
const RANGED = {...GENERIC, ref: 'test/ranged@1', vendor: 'test', name: 'ranged', manufacturer: 'Test', model: 'Ranged', ru: 20,
  rails: [{id: 'front'}, {id: 'rear', depth: {min: 600, max: 900, step: 50, factory: 750}}]};
const WIDE = {...GENERIC, ref: 'test/wide@1', manufacturer: 'Test', model: 'Wide', width: 23};
const ROWS = Object.fromEntries([AR203A, AR201, GENERIC, RANGED, WIDE].map(r => [r.ref, r]));
const frameOf = ref => (Object.hasOwn(ROWS, ref) ? ROWS[ref] : null);

const SIZES = {sw: {ru: 1, h: 43.5, d: 400, model: 'SW', default: 'base'}};
const ctx = {chassisOf: ref => SIZES[ref] || null, frameOf};
const run = (op, rack, args = {}) => COMMANDS[op].run(rack, args, ctx);
const V3_FRAME_KEYS = ['kind', 'heightRU', 'numbering', 'holes', 'railDepth', 'usableDepth', 'ref'];

test('applying AR203A to a generic frame copies its numbers and its ref, and nothing else', () => {
  const r = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'});
  assert.equal(r.error, undefined);
  assert.deepEqual(r.rack.frame, {kind: 'four-post', heightRU: 44, numbering: 'bottom-up', holes: {style: 'square', thread: null},
    railDepth: 740, usableDepth: 740, ref: 'apc/ar203a@1'});
  assert.equal(r.summary, 'Set the frame to APC AR203A (apc/ar203a@1).');
});

test('applying AR201 makes a two-post frame: no rail depth, tapped holes and the product\'s usable depth', () => {
  const r = run('frame.apply', M.newRack(), {ref: 'apc/ar201@1'});
  assert.deepEqual(r.rack.frame, {kind: 'two-post', heightRU: 45, numbering: 'bottom-up', holes: {style: 'tapped', thread: '12-24'},
    railDepth: null, usableDepth: 1048, ref: 'apc/ar201@1'});
});

test('a generic four-post product keeps the frame\'s own rail depth and usable depth: it states none', () => {
  const start = M.withFrame(M.newRack(), {railDepth: 800, usableDepth: 1100});
  const r = run('frame.apply', start, {ref: 'generic/4-post-frame@1'});
  assert.equal(r.rack.frame.railDepth, 800);
  assert.equal(r.rack.frame.usableDepth, 1100);
  assert.equal(r.rack.frame.ref, 'generic/4-post-frame@1');
});

test('a ranged rear rail takes its factory depth; a product with no factory depth keeps the frame\'s, held inside the range', () => {
  assert.equal(run('frame.apply', M.newRack(), {ref: 'test/ranged@1'}).rack.frame.railDepth, 750);
  const noFactory = {...RANGED, ref: 'test/nofactory@1', rails: [{id: 'front'}, {id: 'rear', depth: {min: 600, max: 700}}]};
  const c = {...ctx, frameOf: ref => (ref === noFactory.ref ? noFactory : frameOf(ref))};
  assert.equal(COMMANDS['frame.apply'].run(M.newRack(), {ref: noFactory.ref}, c).rack.frame.railDepth, 700);
});

test('the saved file is a valid version-3 file: only keys version 3 had, read the same by the version-3 reader', () => {
  const schema = JSON.parse(readFileSync(new URL('../../schemas/rack.schema.json', import.meta.url)));
  const rack = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'}).rack;
  const doc = {format: 'portrayal-rack', version: M.VERSION, id: 'doc-f', racks: [rack]};
  const text = M.serialize(doc);
  const saved = JSON.parse(text);
  assert.deepEqual(validate(schema, saved), []);
  assert.deepEqual(Object.keys(saved.racks[0].frame).sort(), [...V3_FRAME_KEYS].sort());
  for (const k of ['width', 'startU', 'options', 'setback', 'heldBy', 'channel']) assert.ok(!text.includes(`"${k}"`), k);
  // the version-3 reader keeps the frame as it is
  const was = V3.parseDoc({...saved, version: 3});
  assert.deepEqual(was.racks[0].frame, saved.racks[0].frame);
  assert.deepEqual(M.parseDoc(text), saved);
});

test('a number the product fixes is refused while the ref is set, each with its sentence', () => {
  const rack = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'}).rack;
  const refused = patch => run('frame', rack, patch).error;
  assert.equal(refused({heightRU: 42}), 'APC AR203A fixes the height; customise the frame to change it.');
  assert.equal(refused({kind: 'two-post'}), 'APC AR203A fixes the kind; customise the frame to change it.');
  assert.equal(refused({numbering: 'top-down'}), 'APC AR203A fixes the numbering; customise the frame to change it.');
  assert.equal(refused({holes: {style: 'tapped', thread: 'M6'}}), 'APC AR203A fixes the rail holes; customise the frame to change it.');
  assert.equal(refused({holes: {thread: 'M6'}}), 'APC AR203A fixes the rail holes; customise the frame to change it.');
  assert.equal(refused({usableDepth: 900}), 'APC AR203A fixes the usable depth; customise the frame to change it.');
  assert.equal(refused({startU: 2}), 'APC AR203A fixes the first unit; customise the frame to change it.');
  assert.equal(refused({railDepth: 700}), 'APC AR203A fixes the rail depth at 740 mm.');
  // asking for the value it already has changes nothing and is no refusal
  const same = run('frame', rack, {heightRU: 44, railDepth: 740, holes: {style: 'square'}});
  assert.equal(same.error, undefined);
  assert.equal(same.rack, rack);
  // what the product does not fix is free: the setback is not a product number
  assert.equal(run('frame', rack, {setback: 10}).rack.frame.setback, 10);
  assert.equal(run('frame', rack, {setback: 10}).rack.frame.ref, 'apc/ar203a@1');
});

test('the rail depth is accepted within the product\'s range and step, and refused outside them', () => {
  const rack = run('frame.apply', M.newRack(), {ref: 'test/ranged@1'}).rack;
  assert.equal(run('frame', rack, {railDepth: 650}).rack.frame.railDepth, 650);
  assert.equal(run('frame', rack, {railDepth: 900}).rack.frame.railDepth, 900);
  assert.equal(run('frame', rack, {railDepth: 550}).error, 'Test Ranged takes a rail depth from 600 to 900 mm, not 550.');
  assert.equal(run('frame', rack, {railDepth: 950}).error, 'Test Ranged takes a rail depth from 600 to 900 mm, not 950.');
  assert.equal(run('frame', rack, {railDepth: 625}).error, 'Test Ranged sets the rail depth in steps of 50 mm from 600, so 625 is not one.');
  // the height is still fixed
  assert.match(run('frame', rack, {heightRU: 30}).error, /fixes the height/);
});

test('customising sets ref to null and keeps every number, and the frame is then edited freely', () => {
  const held = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'}).rack;
  const r = run('frame.customise', held);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.rack.frame, {...held.frame, ref: null});
  assert.equal(run('frame', r.rack, {heightRU: 30}).rack.frame.heightRU, 30);
  // a generic frame has nothing to customise
  assert.equal(run('frame.customise', M.newRack()).rack.frame.ref, null);
  assert.equal(run('frame.customise', r.rack).rack, r.rack);
});

test('applying a product again is no change; applying another replaces the first', () => {
  const held = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'}).rack;
  assert.equal(run('frame.apply', held, {ref: 'apc/ar203a@1'}).rack, held);
  const other = run('frame.apply', held, {ref: 'apc/ar201@1'});
  assert.equal(other.rack.frame.ref, 'apc/ar201@1');
  assert.equal(other.rack.frame.kind, 'two-post');
});

test('applying is refused for a product the catalogue lacks, a page with no catalogue, and a number version 3 cannot hold', () => {
  assert.equal(run('frame.apply', M.newRack(), {ref: 'apc/none@1'}).error, 'There is no rack product apc/none@1.');
  assert.match(COMMANDS['frame.apply'].run(M.newRack(), {ref: 'apc/ar203a@1'}, {chassisOf: ctx.chassisOf}).error, /not loaded/);
  assert.match(run('frame.apply', M.newRack(), {ref: 'test/wide@1'}).error, /Test Wide has 23 in rails, which this rack file cannot hold yet/);
});

test('a frame counting from another first unit is not given a product that counts from U1', () => {
  const r = run('frame.apply', M.withFrame(M.newRack(), {startU: 5}), {ref: 'apc/ar203a@1'});
  assert.equal(r.error, 'APC AR203A counts from U1, and this frame counts from U5; set the first unit to 1 first.');
});

test('a lower product height packs the devices down like a lower frame height, and the ref lands with it', () => {
  let rack = M.withItem(M.newRack(), {ref: 'sw', cfg: 'base', ru: 30, label: 'top'}).rack;
  rack = M.withItem(rack, {ref: 'sw', cfg: 'base', ru: 5, label: 'low'}).rack;
  const r = run('frame.apply', rack, {ref: 'test/ranged@1'});
  assert.equal(r.rack.frame.heightRU, 20);
  assert.equal(r.rack.frame.ref, 'test/ranged@1');
  assert.deepEqual(r.rack.items.map(i => i.ru), [2, 1]);
  assert.match(r.summary, /^Set the frame to Test Ranged \(test\/ranged@1\)\. /);
});

test('through the editor: a step, undone by undo, with the products the page loaded', () => {
  const ed = createRackEditor({doc: M.newDoc(), chassisOf: ctx.chassisOf, frameOf});
  const res = ed.apply({op: 'frame.apply', ref: 'apc/ar203a@1'});
  assert.equal(res.error, undefined);
  assert.equal(ed.rack().frame.ref, 'apc/ar203a@1');
  assert.match(ed.apply({op: 'frame', heightRU: 10}).error, /fixes the height/);
  ed.undo();
  assert.equal(ed.rack().frame.ref, null);
  assert.equal(ed.rack().frame.heightRU, 42);
});

test('a file whose ref the catalogue lacks loads, draws from its own numbers and carries the note', () => {
  const frame = {kind: 'four-post', heightRU: 40, numbering: 'top-down', holes: {style: 'square', thread: null},
                 railDepth: 700, usableDepth: 900, ref: 'apc/gone@2'};
  const doc = M.parseDoc({format: 'portrayal-rack', version: 3, id: 'd', racks: [{id: 'r1', name: 'R', frame, items: [], zeroU: [], cables: []}]});
  assert.deepEqual(doc.racks[0].frame, frame);
  const ed = createRackEditor({doc: M.newDoc(), chassisOf: ctx.chassisOf, frameOf});
  const {findings} = ed.loadDoc(doc);
  assert.deepEqual(findings.map(f => f.text), ['This frame was set from apc/gone@2, which the catalogue does not have, so it is drawn from the numbers in the file. Apply a product to set it again.']);
  assert.deepEqual(ed.rack().frame, frame);
  // not held to a product it cannot read, and the product can be applied again
  assert.equal(ed.apply({op: 'frame', heightRU: 30}).error, undefined);
  assert.equal(ed.apply({op: 'frame.apply', ref: 'apc/ar203a@1'}).error, undefined);
  // a page with no catalogue of products says nothing
  const bare = createRackEditor({doc: M.newDoc(), chassisOf: ctx.chassisOf});
  assert.deepEqual(bare.loadDoc(doc).findings, []);
  assert.equal(F.frameState(frame, ref => null).state, 'missing');
  assert.equal(F.frameState(frame).state, 'unknown');
});

test('a ref whose numbers no longer match the product is drawn from the file, with a note naming them', () => {
  const held = run('frame.apply', M.newRack(), {ref: 'apc/ar203a@1'}).rack;
  const drifted = {...held, frame: {...held.frame, heightRU: 42, railDepth: 700}};
  const s = F.frameState(drifted.frame, frameOf);
  assert.equal(s.state, 'changed');
  assert.deepEqual(s.mismatched, ['heightRU', 'railDepth']);
  assert.equal(s.note, "This frame's heightRU, railDepth no longer match APC AR203A (apc/ar203a@1), so it is drawn from the numbers in the file. Apply the product again to set them.");
  const ed = createRackEditor({doc: M.newDoc(), chassisOf: ctx.chassisOf, frameOf});
  assert.deepEqual(ed.loadDoc({...M.newDoc(), racks: [drifted]}).findings.map(f => f.text), [s.note]);
  assert.equal(ed.rack().frame.heightRU, 42);
  // applying it again puts the product's numbers back
  assert.equal(run('frame.apply', drifted, {ref: 'apc/ar203a@1'}).rack.frame.heightRU, 44);
  // a frame that agrees, and a generic one, carry no note
  assert.equal(F.frameState(held.frame, frameOf).note, null);
  assert.equal(F.frameState(M.newRack().frame, frameOf).state, 'generic');
});

// A VERSION-3 FILE WITH ref: null is what it was: every rack fixture opens in the
// version-3 reader and in this one the same, and saves as it did but for the number.
test('a version-3 file with ref null loads and saves byte for byte as before', () => {
  const dir = new URL('../fixtures/racks/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    const was = V3.parseDoc(text), now = M.parseDoc(text);
    assert.ok(now.racks.every(r => r.frame.ref === null), f);
    assert.equal(M.serialize(now), V3.serialize({...was, version: M.VERSION}), f);
    // and the editor loads it without a word about its frame
    const ed = createRackEditor({doc: M.newDoc(), chassisOf: ctx.chassisOf, frameOf});
    assert.ok(!ed.loadDoc(now).findings.some(x => /frame was set from|no longer match/.test(x.text)), f);
  }
});

test('frameProducts lists the catalogue by maker and model and narrows by text or form', () => {
  assert.deepEqual(F.frameProducts(ROWS).map(r => r.ref),
    ['apc/ar201@1', 'apc/ar203a@1', 'generic/4-post-frame@1', 'test/ranged@1', 'test/wide@1']);
  assert.deepEqual(F.frameProducts(ROWS, {text: 'AR203'}).map(r => r.ref), ['apc/ar203a@1']);
  assert.deepEqual(F.frameProducts(ROWS, {form: '2-post-frame'}).map(r => r.ref), ['apc/ar201@1']);
  const withNumber = {'x/y@1': {...AR203A, ref: 'x/y@1', 'part-numbers': {'FS-4P': 'a frame'}}};
  assert.equal(F.frameProducts(withNumber, {text: 'fs-4p'}).length, 1);
});

test('frameName is the maker and model, or the ref when the row has neither', () => {
  assert.equal(F.frameName(AR201), 'APC AR201');
  assert.equal(F.frameName(AR203A), 'APC AR203A');
  assert.equal(F.frameName(GENERIC), 'Generic 4-post-frame');
  assert.equal(F.frameName({ref: 'x/y@1', manufacturer: 'Acme'}), 'Acme');
  assert.equal(F.frameName({ref: 'x/y@1'}), 'x/y@1');
  assert.equal(F.frameName({ref: 'x/y@1', manufacturer: '', model: null}), 'x/y@1');
});

test('frameProducts results are the rows themselves, in the same order, with or without a name', () => {
  const all = F.frameProducts(ROWS);
  assert.ok(all.every(r => r === ROWS[r.ref]));
  assert.deepEqual(F.frameProducts(ROWS, {text: 'apc'}).map(r => r.ref), ['apc/ar201@1', 'apc/ar203a@1']);
  assert.deepEqual(F.frameProducts(ROWS, {text: 'x/none'}), []);
});

test('loadCatalog reads frames from rack.json, merges roots, refuses a clash, and takes a file with none', async () => {
  clearDistCache();
  bodies = {'https://page.test/a/rack.json': {format: 1, devices: {}, frames: {[AR203A.ref]: AR203A}},
            'https://page.test/b/rack.json': {format: 1, devices: {}, frames: {[AR201.ref]: AR201}},
            'https://page.test/old/rack.json': {format: 1, devices: {}}};
  const cat = await loadCatalog(['/a', '/b']);
  assert.deepEqual(Object.keys(cat.frames).sort(), ['apc/ar201@1', 'apc/ar203a@1']);
  assert.equal(cat.frameOf('apc/ar203a@1'), AR203A);
  assert.equal(cat.frameOf('apc/none@1'), null);
  assert.equal(cat.frameOf('toString'), null);
  clearDistCache();
  const old = await loadCatalog('/old');
  assert.deepEqual(old.frames, {});
  assert.equal(old.frameOf('apc/ar203a@1'), null);
  clearDistCache();
  bodies['https://page.test/b/rack.json'].frames = {[AR203A.ref]: AR203A};
  await assert.rejects(loadCatalog(['/a', '/b']), /rack product apc\/ar203a@1/);
});
