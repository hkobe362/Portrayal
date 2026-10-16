// spec/tests/js/rack-displays.mjs
// WHAT A DISPLAY IN A RACK SHOWS (P-0042, docs/display-content-design.md): the
// content rules of kit/displays.js, the rack's `displays` map (read, kept, set,
// asked about) and the library's marks, here as the build publishes them
// (`displays` on a configuration of configs.json and on a part of
// components.json), cut down.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as D from '../../../kit/displays.js';
import * as RD from '../../../kit/rack/displays.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply, COMMANDS} from '../../../kit/rack/commands.js';
import {configFacts} from '../../../kit/rack/catalog.js';
import {validate} from '../../../kit/rack/validate.js';

// ── what the build publishes, cut down ─────────────────────────────────────
const SEG = {kind: 'segment', characters: 1, glyphs: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'blank']};
const DIGITS = {'digit-1': {...SEG, at: [1.75, 1.5], size: [5.7, 6.9]}, 'digit-2': {...SEG, at: [9.75, 1.5], size: [5.7, 6.9]}};
const LCD = {lcd: {kind: 'pixel', characters: 19, at: [8.95, 52.15], size: [31.1, 30.9]}};
const GRID = {screen: {kind: 'character', characters: 8, rows: 2, at: [2, 2], size: [40, 10]}};
const comp = (ref, rest) => { const [ns, tail] = ref.split('/'), [name, major] = tail.split('@'); return {ns, name, major: `v${major}`, parts: [], cages: [], bays: {}, attrs: {}, ...rest}; };
const ENMC = comp('eaton/g4-enmc@1', {class: 'nic', kind: 'module', displays: LCD});
const COVER = comp('eaton/g4-cover@1', {class: 'mechanical', kind: 'module'});
const compByRef = ref => ({'eaton/g4-enmc@1': ENMC, 'eaton/g4-cover@1': COVER})[ref] ?? null;

const SIZES = {
  ncp: {manufacturer: 'Acme', model: 'NCP', ru: 1, h: 43.5, w: 438, d: 515, default: 'base', configs: ['base']},
  pdu: {manufacturer: 'Acme', model: 'PDU', mount: 'rack-side', kind: 'pdu', ru: 0, h: 1829, w: 52, d: 65, default: 'base', configs: ['base']},
  panel: {manufacturer: 'Acme', model: 'PANEL', ru: 1, h: 43.5, w: 438, d: 100, default: 'base', configs: ['base']},
};
const SLOTS = {
  ncp: {default: 'base', 'pdu-class': null, bays: {front: []}, cages: {front: []},
        configs: [{name: 'base', description: '', airflow: 'passive', bays: {}, occupants: {}, displays: {'status-display': DIGITS}}]},
  pdu: {default: 'base', 'pdu-class': 'managed',
        bays: {front: [{id: 'network-module', at: [1.45, 761.65], size: {w: 49.15, h: 187.9}, accepts: ['eaton/g4-enmc@1', 'eaton/g4-cover@1'], default: 'eaton/g4-enmc@1', rotate: null}]},
        cages: {front: []},
        configs: [{name: 'base', description: '', airflow: 'passive', bays: {'network-module': 'eaton/g4-enmc@1'}, occupants: {}}]},
  panel: {default: 'base', 'pdu-class': null, bays: {front: []}, cages: {front: []},
          configs: [{name: 'base', description: '', airflow: 'passive', bays: {}, occupants: {}, displays: {grid: GRID}}]},
};
const ctx = {chassisOf: ref => SIZES[ref] ?? null, slotsOf: ref => SLOTS[ref] ?? null, compByRef};
const run = (rack, cmds, c = ctx) => apply(rack, cmds, c);

const R0 = M.newRack();
const P1 = run(R0, [{op: 'place', ref: 'ncp', face: 'front', ru: 10, label: 'ncp-1', as: 'n'},
                    {op: 'place', ref: 'panel', face: 'front', ru: 20, label: 'panel-1'},
                    {op: 'zerou.place', ref: 'pdu', at: 'left-rear', ru: 1, label: 'pdu-1'}]);
assert.ok(!P1.error, P1.error);
const RACK = P1.rack;
const NCP = RACK.items.find(i => i.label === 'ncp-1').id;
const PANEL = RACK.items.find(i => i.label === 'panel-1').id;
const PDU = RACK.zeroU[0].id;

// ── bytes: a picture of each sort, as the least a reader needs ─────────────
const url = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const be = n => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const png = (w, h) => url('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be(w), ...be(h), 8, 6, 0, 0, 0]);
const jpeg = (w, h) => url('image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const svg = (attrs, body = '<rect width="10" height="10"/>') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`)}`;
// two frames: the first 3 wide and 2 tall, a loop extension, a delay on each
const frame = delay => [0x21, 0xf9, 4, 0, delay, 0, 0, 0, 0x2c, 0, 0, 0, 0, 3, 0, 2, 0, 0, 2, 2, 0x44, 1, 0];
const GIF = [...Buffer.from('GIF89a'), 3, 0, 2, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255,
  0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0, ...frame(10), ...frame(20), 0x3b];
const imageDescriptors = bytes => { let n = 0; for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x2c) n++; return n; };

// ── the library says what a display is ─────────────────────────────────────
test('a pixel element is a display of its own; the segment cells of a part are one, left to right', () => {
  const lcd = D.displayRecords('network-module/module', LCD);
  assert.deepEqual(lcd, [{path: 'network-module/module/lcd', kind: 'pixel', columns: 19, rows: null, window: [8.95, 52.15, 31.1, 30.9]}]);
  const [seg] = D.displayRecords('status-display', {'digit-2': DIGITS['digit-2'], 'digit-1': DIGITS['digit-1']});
  assert.equal(seg.path, 'status-display');
  assert.deepEqual([seg.kind, seg.columns, seg.rows], ['segment', 2, 1]);
  assert.deepEqual(seg.digits.map(d => d.path), ['status-display/digit-1', 'status-display/digit-2']);
  assert.deepEqual(seg.window, [1.75, 1.5, 13.7, 6.9]);
});

test('an element that says no kind, or no box, or no width, is not a display', () => {
  assert.deepEqual(D.displayRecords('x', {a: {characters: 4, at: [0, 0], size: [1, 1]}}), []);
  assert.deepEqual(D.displayRecords('x', {a: {kind: 'pixel', at: [0, 0], size: [1, 1]}}), []);
  assert.deepEqual(D.displayRecords('x', {a: {kind: 'pixel', characters: 4}}), []);
  assert.deepEqual(D.displayRecords('x', {a: {kind: 'oled', characters: 4, at: [0, 0], size: [1, 1]}}), []);
  assert.deepEqual(D.displayRecords('x', null), []);
});

test('a device lists its own displays and those of what its bays hold under its swaps', () => {
  assert.deepEqual(RD.displaysOf(RACK.items.find(i => i.id === NCP), ctx).map(d => d.path), ['status-display']);
  const pdu = RACK.zeroU[0];
  assert.deepEqual(RD.displaysOf(pdu, ctx).map(d => d.path), ['network-module/module/lcd']);
  assert.deepEqual(RD.displaysOf({...pdu, swaps: {'network-module': 'eaton/g4-cover@1'}}, ctx), []);
  assert.deepEqual(RD.displaysOf({...pdu, swaps: {'network-module': null}}, ctx), []);
  assert.equal(RD.displaysOf(pdu, {...ctx, slotsOf: () => null}), null, 'parts not loaded: not known, not none');
  assert.deepEqual(configFacts(SLOTS.ncp, 'base').displays['status-display'], DIGITS);
});

// ── the rules ──────────────────────────────────────────────────────────────
const lcd = D.displayRecords('network-module/module', LCD)[0];
const seg = D.displayRecords('status-display', DIGITS)[0];
const grid = D.displayRecords('grid', GRID)[0];

test('a content is exactly one of text, digits and image', () => {
  assert.equal(D.shapeRefusal({text: ['a']}), null);
  assert.equal(D.shapeRefusal({digits: '04'}), null);
  assert.equal(D.shapeRefusal({image: 'x.png'}), null);
  assert.match(D.shapeRefusal({text: ['a'], digits: '1'}), /one of text, digits or image/);
  assert.match(D.shapeRefusal({}), /one of text, digits or image/);
  assert.match(D.shapeRefusal({text: 'a'}), /list of lines/);
  assert.match(D.shapeRefusal({text: [1]}), /list of lines/);
  assert.match(D.shapeRefusal({digits: 4}), /string/);
  assert.match(D.shapeRefusal('04'), /A display shows/);
  assert.match(D.shapeRefusal(null), /A display shows/);
});

test('each kind takes what it can show and refuses the rest with a sentence', () => {
  assert.equal(D.contentRefusal(lcd, {text: ['hi']}), null);
  assert.equal(D.contentRefusal(lcd, {image: png(4, 3)}), null);
  assert.match(D.contentRefusal(lcd, {digits: '12'}, 'lcd on PDU'), /lcd on PDU is a pixel display, which takes text or an image and not digits/);
  assert.equal(D.contentRefusal(grid, {text: ['hi']}), null);
  assert.match(D.contentRefusal(grid, {image: png(4, 3)}, 'grid'), /grid is a character display, which takes text and not an image/);
  assert.equal(D.contentRefusal(seg, {digits: '04'}), null);
  assert.match(D.contentRefusal(seg, {text: ['04']}, 'status'), /status is a segment display, which takes digits and not text/);
  assert.match(D.contentRefusal(seg, {digits: '0x'}, 'status'), /cannot show "x": its digits are 0 1 2/);
  assert.equal(D.contentRefusal(seg, {digits: 'A '}), null, 'a letter in either case, a space for a blank');
});

test('text is cut to the columns and the rows and says so', () => {
  const t = D.layoutText(grid, ['12345678', '123456789012', 'three']);
  assert.deepEqual(t.lines, ['12345678', '12345678']);
  assert.deepEqual([t.columns, t.rows, t.clippedLines, t.clippedColumns], [8, 2, 1, 1]);
  assert.deepEqual(D.contentNotes(grid, {text: ['12345678', '123456789012', 'three']}, 'grid'),
    ['grid has 2 rows, so 1 line of the text is cut.', 'grid has 8 columns, so 1 line is cut to fit.']);
  assert.deepEqual(D.contentNotes(grid, {text: ['fits', 'too']}, 'grid'), []);
  // the biggest font that fits both ways: 40 mm over 8 columns, 10 mm over 2 rows
  const keep = 1 - 2 * D.INSET;
  assert.ok(Math.abs(t.fontSize - Math.min(40 * keep / (8 * D.ADVANCE), 10 * keep / (2 * D.LINE))) < 1e-9);
  assert.equal(D.layoutText(grid, ['tab\there']).lines[0], 'tab here');
});

test('a pixel display has its columns, the longest line seen, and as many rows as its window is tall enough for', () => {
  const t = D.layoutText(lcd, ['x'.repeat(19), 'y'.repeat(20)]);
  assert.equal(t.columns, 19);
  assert.ok(Math.abs(t.fontSize - 31.1 * (1 - 2 * D.INSET) / (19 * D.ADVANCE)) < 1e-9);
  assert.equal(t.rows, Math.floor(30.9 * (1 - 2 * D.INSET) / (t.fontSize * D.LINE)));
  assert.equal(t.lines[1].length, 19);
  assert.deepEqual(D.contentNotes(lcd, {text: ['x'.repeat(19), 'y'.repeat(20)]}, 'lcd'),
    ['lcd has 19 columns (the longest line seen on it), so 1 line is cut to fit.']);
  assert.match(D.contentNotes(lcd, {text: Array.from({length: 40}, () => 'a')}, 'lcd')[0], /^lcd has 9 rows, so 31 lines of the text are cut\.$/);
});

test('digits are right-aligned, and cut from the right when there are too many', () => {
  assert.deepEqual(D.layoutDigits(seg, '4').cells.map(c => c.glyph), ['blank', '4']);
  assert.deepEqual(D.layoutDigits(seg, '04').cells.map(c => c.glyph), ['0', '4']);
  assert.deepEqual(D.layoutDigits(seg, 'C 7').cells.map(c => c.glyph), ['c', 'blank']);
  const long = D.layoutDigits(seg, '123');
  assert.deepEqual([long.cells.map(c => c.glyph), long.clipped], [['1', '2'], 1]);
  assert.deepEqual(D.contentNotes(seg, {digits: '123'}, 'status'), ['status has 2 digits, so the last 1 digit of "123" is cut.']);
});

// ── images ─────────────────────────────────────────────────────────────────
test('an image is fitted into the window, centred, never stretched', () => {
  const wide = D.fitImage(100, 50, [10, 20, 31.1, 30.9]);
  assert.ok(Math.abs(wide.w / wide.h - 2) < 1e-9, 'its own proportions');
  assert.ok(Math.abs(wide.w - 31.1) < 1e-9 && wide.bars === 'top and bottom');
  assert.ok(Math.abs(wide.x - 10) < 1e-9 && Math.abs(wide.y - (20 + (30.9 - wide.h) / 2)) < 1e-9);
  const tall = D.fitImage(50, 100, [10, 20, 31.1, 30.9]);
  assert.ok(Math.abs(tall.h - 30.9) < 1e-9 && tall.bars === 'sides' && tall.w < 31.1);
  const fill = D.fitImage(311, 309, [0, 0, 31.1, 30.9]);
  assert.equal(fill.bars, null);
  assert.ok(D.fitImage(2, 2, [0, 0, 30, 30]).w === 30, 'a small picture is scaled up to the window too');
  assert.deepEqual(D.contentNotes(lcd, {image: png(100, 50)}, 'lcd'), ['The image on lcd keeps its proportions, so it is fitted to the window with bars at the top and bottom.']);
  assert.deepEqual(D.contentNotes(lcd, {image: png(311, 309)}, 'lcd'), []);
});

test('the size of a picture is read from the bytes, and the type it declares is not trusted', () => {
  assert.deepEqual([D.imageInfo(png(640, 480)).w, D.imageInfo(png(640, 480)).h], [640, 480]);
  assert.deepEqual([D.imageInfo(jpeg(320, 200)).w, D.imageInfo(jpeg(320, 200)).h], [320, 200]);
  assert.deepEqual([D.imageInfo(svg('viewBox="0 0 40 20"')).w, D.imageInfo(svg('viewBox="0 0 40 20"')).h], [40, 20]);
  assert.deepEqual([D.imageInfo(svg('width="30px" height="15"')).w, D.imageInfo(svg('width="30px" height="15"')).h], [30, 15]);
  assert.match(D.imageInfo(svg('')).error, /no size/);
  assert.match(D.imageInfo(url('image/png', [1, 2, 3, 4])).error, /PNG cannot be read/);
  assert.match(D.imageInfo(url('image/jpeg', [1, 2, 3, 4])).error, /JPEG cannot be read/);
  assert.match(D.imageInfo('data:text/html;base64,PGI+').error, /data URL of an SVG, PNG, JPEG or GIF/);
  assert.match(D.imageInfo('https://example.org/a.png').error, /data URL/);
  assert.match(D.imageInfo(url('image/png', new Array(600 * 1024).fill(0))).error, /over 512 KiB/);
});

test('a GIF is cut to its first frame without being decoded', () => {
  assert.equal(imageDescriptors(GIF), 2, 'two frames to start with');
  const info = D.imageInfo(url('image/gif', GIF));
  assert.equal(info.error, undefined);
  assert.deepEqual([info.w, info.h, info.firstFrame], [3, 2, true]);
  const out = Buffer.from(info.href.split(',')[1], 'base64');
  assert.equal(imageDescriptors(out), 1, 'one image block');
  assert.equal(out.indexOf(Buffer.from('NETSCAPE2.0')), -1, 'no loop extension');
  assert.equal(out.at(-1), 0x3b);
  assert.equal(out.includes(Buffer.from(frame(20))), false, 'the second frame is gone');
  assert.equal(out.includes(Buffer.from(frame(10))), true, 'the first is as it was');
  assert.deepEqual(D.contentNotes(lcd, {image: url('image/gif', GIF)}, 'lcd').slice(-1), ['The GIF on lcd shows its first frame.']);
  assert.match(D.imageInfo(url('image/gif', [...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0, 0])).error, /GIF cannot be read/);
});

test('a library asset is a plain path in the build, and is read before it is drawn', async () => {
  assert.ok(D.isAssetPath('images/ncp-logo.png') && D.isAssetPath('a.svg') && D.isAssetPath('a/b-c_d.2.gif'));
  assert.ok(!D.isAssetPath('../x.png') && !D.isAssetPath('/etc/x.png') && !D.isAssetPath('http://x/a.png') && !D.isAssetPath('a.exe') && !D.isAssetPath('a/../b.png'));
  assert.equal(D.contentRefusal(lcd, {image: 'images/ncp-logo.png'}), null, 'the shape is accepted');
  assert.match(D.imageInfo('images/ncp-logo.png').error, /has not been loaded/);
  const {displays, failed} = await D.loadDisplayImages({a: {image: 'x/y.png'}, b: {image: 'nope.png'}, c: {text: ['t']}},
    async p => { if (p === 'nope.png') throw new Error('404'); return Uint8Array.from(Buffer.from(png(5, 4).split(',')[1], 'base64')); });
  assert.deepEqual(failed, ['b']);
  assert.equal(D.imageInfo(displays.a.image).w, 5);
  assert.deepEqual(displays.b, {image: 'nope.png'});
  assert.deepEqual(displays.c, {text: ['t']});
});

// ── the rack file ──────────────────────────────────────────────────────────
test('the rack file keeps `displays` on an item and on a part beside the rack, and drops what is no content', () => {
  const notes = [];
  const doc = {format: M.FORMAT, version: 4, id: 'd', racks: [{...R0, items: [{id: 'i1', ref: 'ncp', ru: 1,
    displays: {'status-display': {digits: '04'}, junk: {text: 'not a list'}, bad: 7}}],
    zeroU: [{id: 'z1', ref: 'pdu', at: 'left-rear', offsetMm: 0, displays: {'network-module/module/lcd': {text: ['x']}}}]}]};
  const back = M.parseDoc(JSON.stringify(doc), {notes});
  assert.deepEqual(back.racks[0].items[0].displays, {'status-display': {digits: '04'}});
  assert.equal(notes.length, 1);
  assert.match(notes[0], /junk, bad on ncp had content that is not text, digits or an image, so they were dropped/);
  assert.deepEqual(back.racks[0].zeroU[0].displays, {'network-module/module/lcd': {text: ['x']}});
  assert.equal(JSON.parse(M.serialize(back)).racks[0].items[0].displays['status-display'].digits, '04');
});

test('display.set sets, clears, and says what it cut', () => {
  const a = run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: ['OUTLET A', 'x'.repeat(25)]}});
  assert.ok(!a.error, a.error);
  assert.match(a.summary, /network-module\/module\/lcd on pdu-1 now shows text\. .*1 line is cut to fit\./);
  assert.equal(a.findings.length, 1);
  assert.equal(a.findings[0].kind, 'note');
  assert.equal(a.rack.zeroU[0].displays['network-module/module/lcd'].text.length, 2);
  // the same again is no step
  const again = run(a.rack, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: ['OUTLET A', 'x'.repeat(25)]}});
  assert.equal(again.noop, true);
  const cleared = run(a.rack, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: null});
  assert.equal('displays' in cleared.rack.zeroU[0], false, 'the last one takes the key with it');
  assert.equal(run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: null}).noop, true);
  const d = run(RACK, {op: 'display.set', id: NCP, path: 'status-display', content: {digits: '04'}});
  assert.equal(d.rack.items.find(i => i.id === NCP).displays['status-display'].digits, '04');
  assert.match(d.summary, /status-display on ncp-1 now shows "04"\./);
});

test('display.set refuses a part that is no display, with the displays it has', () => {
  assert.match(run(RACK, {op: 'display.set', id: NCP, path: 'status-display/digit-1', content: {digits: '4'}}).error,
    /status-display\/digit-1 on ncp-1 is not a display\. Its displays are status-display\./);
  assert.match(run(RACK, {op: 'display.set', id: PDU, path: 'outlet-a1', content: {text: ['x']}}).error,
    /outlet-a1 on pdu-1 is not a display\. Its displays are network-module\/module\/lcd\./);
  const covered = {...RACK, zeroU: [{...RACK.zeroU[0], swaps: {'network-module': 'eaton/g4-cover@1'}}]};
  assert.match(run(covered, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: ['x']}}).error,
    /is not a display, and pdu-1 has none that says what kind it is/);
  assert.match(run(RACK, {op: 'display.set', id: 'nope', path: 'x', content: {text: ['x']}}).error, /no longer in the rack/);
});

test('display.set refuses content the display cannot take', () => {
  assert.match(run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {digits: '04'}}).error, /pixel display, which takes text or an image and not digits/);
  assert.match(run(RACK, {op: 'display.set', id: NCP, path: 'status-display', content: {text: ['04']}}).error, /segment display, which takes digits and not text/);
  assert.match(run(RACK, {op: 'display.set', id: PANEL, path: 'grid/screen', content: {image: png(2, 2)}}).error, /character display, which takes text and not an image/);
  assert.match(run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {image: svg('')}}).error, /no size/);
  assert.match(run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: 'one'}}).error, /list of lines|needs content/);
  assert.match(run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: ['a'], digits: '1'}}).error, /does not take|one of text/);
});

test('a pictured display is kept as the file has it, and the picture is a data URL', () => {
  const p = png(64, 32);
  const r = run(RACK, {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {image: p}});
  assert.ok(!r.error, r.error);
  assert.equal(r.rack.zeroU[0].displays['network-module/module/lcd'].image, p);
  assert.match(r.summary, /now shows an image\. The image on .* keeps its proportions/);
  assert.deepEqual(RD.displaysFor(r.rack.zeroU[0], ctx), {'network-module/module/lcd': {image: p}});
});

test('what is kept and not applied is said, and not handed a drawing', () => {
  const stale = {...RACK, zeroU: [{...RACK.zeroU[0], displays: {'network-module/module/lcd': {digits: '1'}, 'gone/lcd': {text: ['x']}}}]};
  assert.deepEqual(RD.displaysFor(stale.zeroU[0], ctx), {});
  const said = RD.displayNotices(stale, ctx);
  assert.equal(said.length, 2);
  assert.match(said[0], /pixel display, which takes text or an image and not digits/);
  assert.match(said[1], /gone\/lcd on pdu-1 is not a display/);
  assert.deepEqual(RD.displaysFor(stale.zeroU[0], {}), {}, 'no facts, nothing applied');
  const cut = {...RACK, items: RACK.items.map(i => (i.id === PANEL ? {...i, displays: {'grid/screen': {text: ['x'.repeat(12)]}}} : i))};
  assert.deepEqual(RD.displayNotices(cut, ctx), ['grid/screen on panel-1 has 8 columns, so 1 line is cut to fit.']);
});

// ── the agent ──────────────────────────────────────────────────────────────
test('the displays query lists which parts are displays, and what each shows', () => {
  const set = run(RACK, [{op: 'display.set', id: NCP, path: 'status-display', content: {digits: '04'}},
                         {op: 'display.set', id: PDU, path: 'network-module/module/lcd', content: {text: ['hello']}}]).rack;
  const all = Q.displays(set, ctx);
  assert.deepEqual(all.map(d => [d.item, d.path, d.kind, d.columns, d.rows, d.shows]), [
    [NCP, 'status-display', 'segment', 2, 1, {digits: '04'}],
    [PANEL, 'grid/screen', 'character', 8, 2, null],
    [PDU, 'network-module/module/lcd', 'pixel', 19, null, {text: ['hello']}],
  ]);
  assert.deepEqual(all[0].takes, ['digits']);
  assert.match(all[2].text, /^a pixel display \(text or an image, 19 columns\)$/);
  assert.match(all[1].text, /^a character display \(text, 8 columns by 2 rows\)$/);
  assert.match(all[0].text, /^a segment display \(digits, 2 digits\)$/);
  assert.deepEqual(Q.displays(set, ctx, {item: PDU}).map(d => d.path), ['network-module/module/lcd']);
  assert.deepEqual(Q.displays(set, {}), [], 'parts not loaded: none are known');
});

test('inspect of a device lists its displays, and of a part beside the rack too', async () => {
  const set = run(RACK, {op: 'display.set', id: NCP, path: 'status-display', content: {digits: '04'}}).rack;
  const item = await Q.inspect(set, NCP, ctx);
  assert.deepEqual(item.displays.map(d => [d.path, d.kind, d.shows]), [['status-display', 'segment', {digits: '04'}]]);
  assert.equal('item' in item.displays[0], false);
  const pdu = await Q.inspect(set, PDU, ctx);
  assert.deepEqual(pdu.displays.map(d => d.path), ['network-module/module/lcd']);
});

test('display.set is in the table an agent reads, and is described briefly', () => {
  assert.ok(COMMANDS['display.set']);
  assert.deepEqual(COMMANDS['display.set'].args.required, ['id', 'path', 'content']);
});

// ── the library, as built ──────────────────────────────────────────────────
const DIST = new URL('../../../library/dist/', import.meta.url);
const built = existsSync(new URL('components.json', DIST)) && existsSync(new URL('evma8365x.configs.json', DIST));
const read = f => JSON.parse(readFileSync(new URL(f, DIST), 'utf8'));

test('the eNMC LCD is a pixel display of 19 columns in the window the drawing gives it', { skip: built ? false : 'library/dist not built - run ./build.sh' }, () => {
  const c = read('components.json').components.find(x => `${x.ns}/${x.name}` === 'eaton/g4-enmc');
  assert.deepEqual(c.displays, {lcd: {kind: 'pixel', characters: 19, at: [8.95, 52.15], size: [31.1, 30.9]}});
  const slots = read('evma8365x.configs.json');
  const byRef = ref => read('components.json').components.find(x => `${x.ns}/${x.name}@${String(x.major).replace(/^v/, '')}` === ref) ?? null;
  const pdu = {id: 'z1', ref: 'evma8365x', cfg: '', label: 'pdu', at: 'left-rear'};
  const got = RD.displaysOf(pdu, {slotsOf: () => ({bays: slots.bays, cages: slots.cages, configs: slots.configs, default: slots.default}), compByRef: byRef});
  assert.deepEqual(got.map(d => [d.path, d.kind, d.columns, d.rows]), [['network-module/module/lcd', 'pixel', 19, null]]);
});

test('the public test rack sets every display it has, and says nothing of any', { skip: built ? false : 'library/dist not built - run ./build.sh' }, () => {
  const text = readFileSync(new URL('../fixtures/displays/displays.rack.json', import.meta.url), 'utf8');
  const doc = M.parseDoc(text);
  const rack = doc.racks[0];
  const schema = JSON.parse(readFileSync(new URL('../../schemas/rack.schema.json', import.meta.url)));
  assert.deepEqual(validate(schema, JSON.parse(text)), [], 'the published schema takes the file as it is');
  const comps = read('components.json').components;
  const byRef = ref => comps.find(x => `${x.ns}/${x.name}@${String(x.major).replace(/^v/, '')}` === String(ref).split(':')[0]) ?? null;
  const slotsOf = ref => { const j = read(`${ref}.configs.json`); return {bays: j.bays, cages: j.cages, configs: j.configs, default: j.default, 'pdu-class': j['pdu-class'] ?? null}; };
  const c = {slotsOf, compByRef: byRef, chassisOf: ref => read('rack.json').devices[ref] ?? null};
  // the only thing said: the 4:3 picture does not fill the almost square window
  assert.deepEqual(RD.displayNotices(rack, c),
    ['The image on network-module/module/lcd on PDU-B keeps its proportions, so it is fitted to the window with bars at the top and bottom.']);
  const all = Q.displays(rack, c);
  assert.deepEqual(all.map(d => [d.item, d.path, d.kind, d.shows && Object.keys(d.shows)[0]]), [
    ['i1', 'status-display', 'segment', 'digits'], ['i2', 'beacon', 'segment', 'digits'],
    ['z1', 'network-module/module/lcd', 'pixel', 'text'], ['z2', 'network-module/module/lcd', 'pixel', 'image']]);
  // each is what the drawing is handed
  for (const e of [...rack.items, ...rack.zeroU]) assert.deepEqual(Object.keys(RD.displaysFor(e, c)), Object.keys(e.displays), e.label);
  assert.equal(M.parseDoc(M.serialize(doc)).racks[0].zeroU[1].displays['network-module/module/lcd'].image.startsWith('data:image/svg+xml'), true);
});

test('the NCP and the NCF status digits are a two-digit segment display', { skip: built ? false : 'library/dist not built - run ./build.sh' }, () => {
  for (const [model, id] of [['s9700-53dx', 'status-display'], ['s9705-48d', 'beacon']]) {
    const slots = read(`${model}.configs.json`);
    const dev = {id: 'i1', ref: model, cfg: '', label: model, ru: 1};
    const got = RD.displaysOf(dev, {slotsOf: () => ({bays: slots.bays, cages: slots.cages, configs: slots.configs, default: slots.default}), compByRef: () => null});
    assert.deepEqual(got.map(d => [d.path, d.kind, d.columns]), [[id, 'segment', 2]], model);
    assert.equal(D.contentRefusal(got[0], {digits: '04'}), null);
    assert.equal(D.contentRefusal(got[0], {digits: 'af'}), null);
    assert.ok(D.contentRefusal(got[0], {digits: 'g1'}));
  }
});
