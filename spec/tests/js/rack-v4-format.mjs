// spec/tests/js/rack-v4-format.mjs
// RACK FILE VERSION 4, THE FORMAT (docs/rack-file-v4-design.md, part 1): the
// version, the identity migration from 3, the reader keeping what it does not
// know at all seven levels, every key of section 1.1 through a parse and a
// save, the schema, and what a version-3 reader does with a version-4 file.
// The version-3 reader is a frozen copy of model.js as it was
// (spec/tests/fixtures/rack-readers/model-v3.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as V3 from '../fixtures/rack-readers/model-v3.js';
import {validate} from '../../../kit/rack/validate.js';

const SCHEMA = JSON.parse(readFileSync(new URL('../../schemas/rack.schema.json', import.meta.url)));
const errs = d => validate(SCHEMA, JSON.parse(JSON.stringify(d))).map(e => `${e.keyword} at /${e.path.join('/')}`);
const DIR = new URL('../fixtures/racks/', import.meta.url);
const FIXTURES = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const frame = {kind: 'four-post', heightRU: 42, numbering: 'bottom-up', holes: {style: 'square', thread: null},
               railDepth: 740, usableDepth: 1000, ref: null};
const item = (id, ru, extra = {}) => ({id, ref: 'xcu', cfg: 'XCU10-21IC', label: id, ru, face: 'front', turned: false,
                                       swaps: {}, fields: {}, ...extra});
const end = (i, path) => ({item: i, path, view: 'front'});
const docOf = (rack, extra = {}) => ({format: 'portrayal-rack', version: 4, id: 'doc-v4', ...extra,
  racks: [{id: 'r1', name: 'Rack 1', frame, items: [], zeroU: [], cables: [], ...rack}]});

test('the version is 4 and the migration from 3 is the identity', () => {
  assert.equal(M.VERSION, 4);
  assert.equal(M.MIGRATIONS.length, 3);
  const d = {format: 'portrayal-rack', version: 3, id: 'd', racks: [{id: 'r1'}], extra: [1, {a: 2}]};
  assert.deepEqual(M.MIGRATIONS[2](d), {...d, version: 4});
  assert.equal(SCHEMA.$id, 'https://portrayal.dev/schemas/v3/rack.schema.json');
  assert.equal(SCHEMA.properties.version.const, 4);
});

// EVERY VERSION-3 RACK FIXTURE IN THE REPOSITORY, read by the reader of before
// and by this one: the same document but for the number, and the same text
// when saved. A directory that held none would prove nothing, so it is counted.
test('every rack fixture opens in the version-4 reader exactly as the version-3 reader read it', () => {
  assert.ok(FIXTURES.length >= 5, `only ${FIXTURES.length} rack fixtures were found`);
  let items = 0, cables = 0;
  for (const f of FIXTURES) {
    const text = readFileSync(new URL(f, DIR), 'utf8');
    const was = V3.parseDoc(text), now = M.parseDoc(text);
    assert.equal(was.version, 3, f);
    assert.equal(now.version, 4, f);
    assert.deepEqual({...now, version: 3}, was, f);
    assert.equal(M.serialize(now), V3.serialize({...was, version: 4}), `${f} saves as it did, but for the number`);
    // and what was saved opens again as itself
    assert.deepEqual(M.parseDoc(M.serialize(now)), now, f);
    assert.deepEqual(errs(now), [], f);
    for (const r of now.racks) { items += r.items.length; cables += r.cables.length; }
  }
  assert.ok(items >= 18 && cables >= 13, `the fixtures hold ${items} items and ${cables} cables`);
});

test('a version-3 file with bundles, zero-U parts and a side opens and saves as version 4 with nothing else changed', () => {
  const v3 = {format: 'portrayal-rack', version: 3, id: 'doc-3', racks: [{id: 'r1', name: 'Rack 1', frame,
    items: [item('i1', 2), item('i2', 2, {ref: 'mgr', on: 'i1', unit: 1}), item('i3', 9, {ref: 'bracket', side: 'left'})],
    zeroU: [{id: 'z1', ref: 'duct', cfg: '', label: 'Duct', at: 'left-front', offsetMm: 133.35, note: 'kept'}],
    cables: [{id: 'c1', a: end('i1', 'p1'), b: end('i3', 'p2'), media: 'os2', purpose: '', label: '',
              length: {value: 2, unit: 'm', source: 'routed', measured: 1.62}, route: [{item: 'i2', via: 'ring-1'}]},
             {id: 'c2', a: end('i1', 'p3'), b: end('i3', 'p4'), media: '', purpose: '', label: '', route: []}],
    dcim: {site: 'dc1', role: 'leaf'},
    bundles: [{id: 'b1', number: 1, label: '', members: [{cable: 'c1'}, {cable: 'c2'}], route: [{lane: 'left-front', ru: 4}],
               straps: {every: null}}]}]};
  const was = V3.parseDoc(structuredClone(v3)), now = M.parseDoc(structuredClone(v3));
  assert.deepEqual(was, v3, 'the fixture is a file the version-3 reader leaves alone');
  assert.deepEqual(now, {...v3, version: 4});
  assert.deepEqual(JSON.parse(M.serialize(now)), {...v3, version: 4});
});

test('a version-3 reader refuses a version-4 file whole, with its sentence', () => {
  const v4 = M.serialize(docOf({items: [item('i8', 12), item('i9', 12.5)]}));
  assert.throws(() => V3.parseDoc(v4), {message: 'This rack file is version 4; this reader supports up to version 3.'});
  // and this reader refuses the next one the same way
  assert.throws(() => M.parseDoc(docOf({}, {version: 5})), {message: 'This rack file is version 5; this reader supports up to version 4.'});
  // without the version gate it would have refused the half position anyway
  assert.throws(() => V3.parseDoc({...JSON.parse(v4), version: 3}), /Item 2 has no device or no U\./);
});

// EVERY KEY OF SECTION 1.1, written the way the note writes it.
const HELD = {heldBy: {item: 'i4', at: 'rail', x: 35, z: 0, turn: 0}};
const READINGS = {source: 'SNMP poll of the PDU network module', at: '2026-10-08T14:05:00Z',
                  values: {'outlet-a1': {'current-a': 1.8, 'power-w': 372}, input: {'current-a': 19.6}}};
const ALL = docOf({
  frame: {...frame, holes: {style: 'round', thread: null}, startU: 5, setback: 20, width: 23, options: ['channels']},
  items: [item('i8', 12, {setback: 12}), item('i9', 12.5, {roll: 180, states: {'outlet-a1': 'on'}, readings: READINGS}),
          item('i4', 20, {ref: 'dinrail2u'}), item('i7', 20, {ref: 'din-switch', ...HELD})],
  zeroU: [{id: 'z3', ref: 'fs-pdubk', cfg: 'front', label: 'Bracket', at: 'left-rear', offsetMm: 133.35, channel: 'rear-left'},
          {id: 'z2', ref: 'evma8365x', cfg: '', label: 'PDU A', at: 'left-rear', offsetMm: 120.65, heldBy: {parts: ['z3']},
           swaps: {}, fields: {'section-a-label': 'Row 4 A'}, states: {'outlet-a2': 'off'}, readings: READINGS}],
  cables: [{id: 'c2', a: end('i8', 'p1'), b: end('i9', 'p14'), media: 'os2', purpose: '', label: '',
            length: {value: 1, unit: 'm', source: 'routed', need: 0.42}, route: [{item: 'i4', via: 'r3'}],
            slack: [{item: 'i4', via: 'tray', form: 'coil'}, {end: 'a', value: 0.1, unit: 'm'}],
            lay: [{item: 'i4', via: 'tray', position: 2, face: 'top'}], straps: {anchors: false}},
           {id: 'c3', a: end('i8', 'p2'), b: end('i9', 'p15'), media: 'os2', purpose: '', label: '', route: [], slack: []}],
  bundles: [{id: 'b1', number: 1, label: '', members: [{cable: 'c2'}, {cable: 'c3'}], route: [],
             straps: {every: {value: 12, unit: 'in'}, breakout: false, anchors: true}},
            {id: 'b2', number: 2, label: '', members: [], route: [], straps: {breakout: false}}]});

test('each key of version 4 survives a parse and a save, and the schema describes it', () => {
  const read = M.parseDoc(structuredClone(ALL));
  assert.deepEqual(read, ALL);
  assert.deepEqual(JSON.parse(M.serialize(read)), ALL);
  assert.deepEqual(M.parseDoc(M.serialize(read)), read);
  assert.deepEqual(errs(ALL), []);
  // each key is one the schema names: none passes only because nothing looks
  const D = SCHEMA.$defs;
  for (const k of ['startU', 'setback', 'width', 'options']) assert.ok(D.frame.properties[k], `frame ${k}`);
  assert.deepEqual(D.frame.properties.holes.properties.style.enum, ['square', 'tapped', 'round']);
  for (const k of ['roll', 'states', 'readings', 'setback', 'heldBy']) assert.ok(D.item.properties[k], `item ${k}`);
  for (const k of ['swaps', 'fields', 'states', 'readings', 'heldBy', 'channel']) assert.ok(D.zeroU.properties[k], `zeroU ${k}`);
  for (const k of ['slack', 'lay', 'straps']) assert.ok(D.cable.properties[k], `cable ${k}`);
  assert.ok(D.cable.properties.length.properties.need);
  assert.deepEqual(Object.keys(D.bundle.properties.straps.properties), ['every', 'breakout', 'anchors']);
  assert.equal(D.bundle.properties.straps.required, undefined);
});

test('a version-3 reader would have erased or refused those keys', () => {
  // what the bump is for: read as version 3, the same content loses keys
  const lowered = structuredClone(ALL);
  lowered.version = 3;
  lowered.racks[0].items[1].ru = 13;                 // a half position it refuses outright
  const was = V3.parseDoc(lowered).racks[0];
  for (const k of ['roll', 'states', 'readings']) assert.equal(k in was.items[1], false, k);
  assert.equal('setback' in was.items[0], false);
  assert.equal('heldBy' in was.items[3], false);
  for (const k of ['startU', 'setback', 'width', 'options']) assert.equal(k in was.frame, false, k);
  assert.equal(was.frame.holes.style, 'square');
  assert.equal('straps' in was.bundles[1], false);
});

test('the schema takes a position in steps of 0.5 and refuses any other', () => {
  const at = ru => errs(docOf({items: [item('i1', ru)]}));
  assert.deepEqual(at(12), []);
  assert.deepEqual(at(12.5), []);
  assert.deepEqual(at(1), []);
  assert.deepEqual(at(12.25), ['multipleOf at /racks/0/items/0/ru']);
  assert.deepEqual(at(0.5), ['minimum at /racks/0/items/0/ru']);
  assert.deepEqual(at('12'), ['type at /racks/0/items/0/ru']);
  // and the loader, which a file meets first
  assert.equal(M.parseDoc(docOf({items: [item('i1', 12.5)]})).racks[0].items[0].ru, 12.5);
  for (const bad of [12.25, '12', null, NaN, Infinity])
    assert.throws(() => M.parseDoc(docOf({items: [item('i1', bad)]})), /Item 1 has no device or no U\./, String(bad));
});

test('the validator knows multipleOf', () => {
  const s = {type: 'number', multipleOf: 0.5};
  for (const ok of [0, 0.5, 1, 41.5, 100]) assert.deepEqual(validate(s, ok), [], String(ok));
  for (const bad of [0.25, 12.75, 0.1, 1e-3]) assert.equal(validate(s, bad)[0]?.keyword, 'multipleOf', String(bad));
  assert.deepEqual(validate({type: 'number', multipleOf: 0.1}, 0.3), [], 'a decimal step a float cannot hold exactly');
});

// AN UNKNOWN KEY AT EACH OF THE SEVEN LEVELS (decision 9): the four that
// dropped one before, and the three that always kept theirs.
test('a key the reader does not know is kept at all seven levels of the file', () => {
  const later = {made: 'later', n: [1, 2]};
  const d = docOf({
    later, frame: {...frame, later},
    items: [item('i1', 1, {later})],
    zeroU: [{id: 'z1', ref: 'duct', at: 'left-front', offsetMm: 0, later}],
    cables: [{id: 'c1', a: end('i1', 'p1'), b: end('i1', 'p2'), media: '', purpose: '', label: '', route: [], later}],
    bundles: [{id: 'b1', number: 1, label: '', members: [], route: [], later}]}, {later});
  const read = M.parseDoc(structuredClone(d));
  const r = read.racks[0];
  for (const [level, holder] of [['document', read], ['rack', r], ['frame', r.frame], ['item', r.items[0]],
                                 ['zero-U entry', r.zeroU[0]], ['cable', r.cables[0]], ['bundle', r.bundles[0]]])
    assert.deepEqual(holder.later, later, level);
  assert.deepEqual(JSON.parse(M.serialize(read)), d, 'and saved as it was');
  assert.notEqual(r.items[0].later, d.racks[0].items[0].later, 'a copy: the rack never shares an object with what it read');
  // a frame edit keeps it, since every frame change goes through normalizeFrame
  assert.deepEqual(M.withFrame(r, {heightRU: 24}).frame.later, later);
  // the reader of before dropped it at four of them
  const was = V3.parseDoc({...structuredClone(d), version: 3}), w = was.racks[0];
  assert.deepEqual(['later' in was, 'later' in w, 'later' in w.frame, 'later' in w.items[0]], [false, false, false, false]);
  assert.deepEqual(['later' in w.zeroU[0], 'later' in w.cables[0], 'later' in w.bundles[0]], [true, true, true]);
});

test('a key the reader knows is still read as before: a bad value is not kept as an unknown one', () => {
  const r = M.parseDoc(docOf({bundles: 'none', dcim: 7,
    items: [item('i1', 1, {on: 'i9', unit: 0, side: 'middle', face: 'top', turned: 1})]})).racks[0];
  assert.deepEqual(r.items[0], item('i1', 1, {turned: true}));
  assert.equal('bundles' in r, false);
  assert.equal('dcim' in r, false);
});

test('a bundle straps is kept when any key of it says something', () => {
  const read = straps => M.parseDoc(docOf({bundles: [{id: 'b1', number: 1, label: '', members: [], route: [], straps}]})).racks[0].bundles[0].straps;
  assert.deepEqual(read({breakout: false}), {breakout: false});
  assert.deepEqual(read({anchors: true}), {anchors: true});
  assert.deepEqual(read({every: null}), {every: null});
  assert.deepEqual(read({every: {value: 12, unit: 'cm'}, anchors: false}), {anchors: false}, 'the spacing that is none is left out');
  assert.deepEqual(read({every: {value: 300, unit: 'mm'}, breakout: 'no', note: 'kept'}), {every: {value: 300, unit: 'mm'}, note: 'kept'});
  assert.equal(read({every: {value: 12, unit: 'cm'}}), undefined);
  assert.equal(read({breakout: 'no'}), undefined);
  assert.equal(read({}), undefined);
  assert.equal(read([]), undefined);
});

test('round holes are a hole style the frame keeps, with no thread', () => {
  assert.deepEqual(M.normalizeFrame({...frame, holes: {style: 'round', thread: 'M6'}}).holes, {style: 'round', thread: null});
  assert.deepEqual(M.normalizeFrame({...frame, holes: {style: 'oval'}}).holes, {style: 'square', thread: null});
});
