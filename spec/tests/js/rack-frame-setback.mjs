// spec/tests/js/rack-frame-setback.mjs
// THE FRAME AND SETBACK (docs/rack-file-v4-design.md section 7, build part 3):
// `startU` in every label and exported position, round holes, `width` and
// `options` kept, `setback` on the frame and on an item with its order, a
// zero-U `channel` read, and a held item kept in step with its host.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as F from '../../../kit/rack/fit.js';
import * as Q from '../../../kit/rack/queries.js';
import * as R from '../../../kit/rack/route.js';
import * as S from '../../../kit/rack/solids.js';
import * as X from '../../../kit/rack/export-data.js';
import {apply, COMMANDS, NO_HOSTS} from '../../../kit/rack/commands.js';
import {createRackEditor} from '../../../kit/rack/editor.js';

const SIZES = {
  sw: {ru: 1, w: 440, h: 43.6, d: 500, model: 'SW-1'},
  deep: {ru: 2, w: 440, h: 87, d: 700, model: 'DEEP-2'},
  short: {ru: 1, w: 440, h: 43.6, d: 200, model: 'SHORT-1'},
  eared: {ru: 1, w: 440, h: 43.6, d: 300, model: 'EARED', ears: {default: {name: 'mid', at: -40}}},
  flush: {ru: 1, w: 440, h: 43.6, d: 300, model: 'FLUSH', ears: {default: {name: 'flush'}}},
  named: {ru: 1, w: 440, h: 43.6, d: 300, model: 'NAMED', ears: {default: {name: 'recessed'}}},
  mgr: {ru: 1, w: 482.6, h: 44, d: 110, mount: 'rack-face', model: 'MGR'},
  shelf: {ru: 2, w: 440, h: 88, d: 300, model: 'DINRAIL2U'},
  din: {ru: 1, w: 60, h: 90, d: 60, mount: 'din-rail', model: 'DIN-SW'},
  duct: {ru: 42, w: 100, h: 1866.9, d: 100, mount: 'rack-side', model: 'DUCT'},
};
const chassisOf = ref => SIZES[ref] || null;
const ctx = {chassisOf};
const rackOf = (frame = {}) => ({...M.newRack(), frame: M.normalizeFrame({kind: 'four-post', heightRU: 42, ...frame})});
const put = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: '', ru, label: extra.label ?? SIZES[ref]?.model ?? ref, ...extra}).rack;
const withKeys = (rack, id, keys) => ({...rack, items: rack.items.map(i => (i.id === id ? {...i, ...keys} : i))});
const run = (rack, cmds) => apply(rack, cmds, ctx);

// ── startU ───────────────────────────────────────────────────────────────

test('startU: labels and positions count from it, both ways, and it is written only when set', () => {
  const up = M.normalizeFrame({heightRU: 42, startU: 5}), down = M.normalizeFrame({heightRU: 42, numbering: 'top-down', startU: 5});
  assert.equal(up.startU, 5);
  assert.equal('startU' in M.normalizeFrame({heightRU: 42}), false);
  for (const bad of [0, -1, 2.5, '5', null]) assert.equal('startU' in M.normalizeFrame({heightRU: 42, startU: bad}), false, String(bad));
  assert.deepEqual([M.uLabel(up, 1), M.uLabel(up, 42), M.uLabel(down, 1), M.uLabel(down, 42)], [5, 46, 46, 5]);
  assert.deepEqual([M.positionOf(up, 12, 1), M.positionOf(up, 12.5, 0.5), M.positionOf(up, 12, 2)], [16, 16.5, 16]);
  assert.deepEqual([M.positionOf(down, 12, 1), M.positionOf(down, 12, 0.5), M.positionOf(down, 12.5, 0.5), M.positionOf(down, 41, 2)],
    [35, 35.5, 35, 5]);
  assert.equal(M.uText(up, 12.5, 0.5), 'U16.5');
  assert.equal(F.unitsText(up, 13, 2), 'U17-U18');
  assert.equal(F.unitsText(down, 13, 1.5), 'the lower half of U33 to U34');
  // with none, every label is the one of before
  const plain = M.normalizeFrame({heightRU: 42});
  assert.deepEqual([M.uLabel(plain, 7), M.positionOf(plain, 7, 2), M.firstU(plain)], [7, 7, 1]);
});

test('startU reaches the commands, describe, the sheet and both DCIM files', () => {
  let r = {...rackOf(), name: 'R1'};
  const set = run(r, {op: 'frame', startU: 5});
  assert.equal(set.error, undefined);
  assert.equal(set.rack.frame.startU, 5);
  assert.deepEqual(run(r, {op: 'frame', startU: 0}), {error: 'frame needs startU, a whole number from 1.', index: 0});
  r = set.rack;
  const placed = run(r, {op: 'place', ref: 'sw', face: 'front', ru: 12, label: 'leaf'});
  assert.equal(placed.summary, 'Placed leaf at U16 on the front.', 'ru is stored from 1; the label counts from 5');
  assert.equal(placed.rack.items[0].ru, 12);
  r = placed.rack;
  assert.match(Q.describe(r, ctx), /42U four-post, square holes, numbered bottom-up from U5\./);
  assert.ok(Q.describe(r, ctx).split('\n').some(l => l.startsWith('i1 leaf U16 front')));
  assert.equal(X.titleLines(r, new Date(2026, 9, 11))[1], 'Four-post frame, 42U, U5 at the bottom');
  assert.equal(X.titleLines(rackOf(), new Date(2026, 9, 11))[1], 'Four-post frame, 42U, U1 at the bottom');
  // NEITHER IMPORT TAKES A STARTING UNIT. NetBox's RackImportForm lists no
  // such field and refuses a header it does not list, so the rack row keeps
  // its six columns and says it in `comments`; both device files count from 1
  // and each comment gives the label on the rack.
  const rackRow = X.rackImportRows({rack: r});
  assert.deepEqual(rackRow.columns, ['site', 'name', 'status', 'width', 'u_height', 'desc_units', 'comments']);
  assert.equal(rackRow.columns.includes('starting_unit'), false);
  assert.deepEqual(rackRow.rows[0], {site: '', name: 'R1', status: 'planned', width: 19, u_height: 42, desc_units: 'false',
    comments: 'Its units are numbered from 5 on the rack. The NetBox rack import takes no starting unit, so this rack and the positions in the devices file count from 1.'});
  // a rack that numbers from 1 is the six columns it always was, to the byte
  assert.equal(X.toCsv(...Object.values(X.rackImportRows({rack: {...rackOf(), name: 'R1'}}))),
    'site,name,status,width,u_height,desc_units\r\n,R1,planned,19,42,false\r\n');
  const types = new Map([['i1', {manufacturer: 'A', model: 'SW-1', isFullDepth: true, guess: false}]]);
  const items = F.itemsWithU(r, chassisOf);
  assert.deepEqual(X.deviceImportRows({rack: r, items, types}).rows.map(x => [x.position, x.comments]),
    [[12, 'U16 on the rack. The rack numbers its units from 5, and a unit named here is its label; the NetBox import counts from 1.']]);
  assert.deepEqual(X.deviceImportRows({rack: r, items, types, target: 'nautobot'}).rows.map(x => [x.position, x.comments]),
    [[12, 'U16 on the rack. The rack numbers its units from 5, and a unit named here is its label; the Nautobot import counts from 1.']]);
  // top-down, from 5: the unit stored at 12 is labelled 35, and is 31 counted from 1
  const down = {...r, frame: M.normalizeFrame({...r.frame, numbering: 'top-down'})};
  assert.deepEqual(X.deviceImportRows({rack: down, items, types}).rows.map(x => x.position), [31]);
  assert.deepEqual(X.deviceImportRows({rack: down, items, types, target: 'nautobot'}).rows.map(x => x.position), [31]);
  assert.match(X.deviceImportRows({rack: down, items, types}).rows[0].comments, /^U35 on the rack\. /);
  // a half kept with no position names the label of its unit, and says how the rack is numbered
  const sizes = ref => (ref === 'half' ? {ru: 0.5, w: 440, h: 22, d: 200} : chassisOf(ref));
  let two = {...rackOf({startU: 5}), name: 'R1'};
  two = M.withItem(M.withItem(two, {ref: 'half', cfg: '', ru: 12, label: 'low'}).rack, {ref: 'half', cfg: '', ru: 12.5, label: 'high'}).rack;
  const both = new Map(['i1', 'i2'].map(id => [id, types.get('i1')]));
  const high = X.deviceImportRows({rack: two, items: F.itemsWithU(two, sizes), types: both, target: 'nautobot'}).rows.find(x => x.name === 'high');
  assert.deepEqual([high.position, high.comments], ['', 'In the upper half of U16, above low; no position, since Nautobot stores whole rack units. ' +
    'The rack numbers its units from 5, and a unit named here is its label; the Nautobot import counts from 1.']);
  // the sentences of fit name a unit as the rack labels it, counted from the bottom
  assert.deepEqual(F.fits(r, {ref: 'sw', ru: 0, face: 'front'}, chassisOf), {ok: false, reason: 'Below U5.'});
  assert.deepEqual(F.fits(r, {ref: 'deep', ru: 42, face: 'front'}, chassisOf), {ok: false, reason: '2U needed; 1U free from U46 to the top.'});
  assert.deepEqual(run(r, {op: 'place', ref: 'sw', face: 'front', ru: 43}), {error: 'U47 is past the top of this 42U rack.', index: 0});
  assert.deepEqual(F.fits(rackOf(), {ref: 'sw', ru: 0, face: 'front'}, chassisOf), {ok: false, reason: 'Below U1.'});
});

// ── round holes ──────────────────────────────────────────────────────────

test('round holes: kept, said, and counted as square holes are with a note', () => {
  const r = run(rackOf(), {op: 'frame', holes: {style: 'round'}}).rack;
  assert.deepEqual(r.frame.holes, {style: 'round', thread: null});
  assert.match(Q.describe(r, ctx), /42U four-post, round holes, numbered bottom-up\./);
  assert.equal(X.holesText(r.frame), 'Round holes');
  assert.deepEqual(X.hardwareRows(r.frame, [1, 2]).map(x => [x.model, x.qty]), [['Cage nut, M6', 12], ['Screw, M6', 12]]);
  assert.deepEqual(X.hardwareNotes(r.frame), ['Round holes: check what fixing your rail takes.']);
  assert.deepEqual(COMMANDS.frame.args.properties.holes.properties.style.enum, ['square', 'tapped', 'round']);
  // the other two read as before
  assert.equal(X.holesText(rackOf().frame), 'Square holes (cage nuts)');
  assert.equal(X.hardwareNotes(rackOf().frame).length, 1);
});

// ── kept keys ────────────────────────────────────────────────────────────

test('a hand-written width, options, channel and item heldBy survive a round trip unchanged, each with its notice', () => {
  const frame = {kind: 'four-post', heightRU: 42, numbering: 'bottom-up', holes: {style: 'square', thread: null},
                 railDepth: 740, usableDepth: 1000, ref: null, width: 23, options: [{id: 'channels'}, 'castors']};
  const doc = {format: 'portrayal-rack', version: 4, id: 'd', racks: [{id: 'r1', name: 'R1', frame,
    items: [{id: 'i4', ref: 'shelf', cfg: '', label: 'Shelf', ru: 20, face: 'front', turned: false, swaps: {}, fields: {}},
            {id: 'i7', ref: 'din', cfg: '', label: 'DIN switch', ru: 20, face: 'front', turned: false, swaps: {}, fields: {},
             heldBy: {item: 'i4', at: 'rail', x: 35}}],
    zeroU: [{id: 'z1', ref: 'duct', cfg: '', label: 'PDU A', at: 'left-rear', offsetMm: 0, channel: 'rear-left'}], cables: []}]};
  const read = M.parseDoc(structuredClone(doc));
  assert.deepEqual(read, doc);
  assert.deepEqual(JSON.parse(M.serialize(read)), doc);
  const r = read.racks[0];
  assert.deepEqual(F.frameNotices(r, chassisOf), [
    'This rack states 23 in rails; it is drawn and fitted as 19 in.',
    'PDU A names the channel rear-left, which is not known for this frame, so it stands at left-rear.',
    'i7 is held by i4, and DINRAIL2U states no rail to hold a device, so it is not checked.']);
  assert.deepEqual(F.frameNotices(rackOf(), chassisOf), []);
  // the editor says them on load and rewrites nothing
  const ed = createRackEditor({doc: M.newDoc(), chassisOf});
  assert.deepEqual(ed.loadDoc(read).findings.map(f => f.text), F.frameNotices(r, chassisOf));
  assert.deepEqual(ed.getDoc(), doc);
  // every frame edit keeps them
  const edited = run(r, {op: 'frame', numbering: 'top-down'}).rack;
  assert.deepEqual([edited.frame.width, edited.frame.options], [23, [{id: 'channels'}, 'castors']]);
  // the width is exported when it is one the NetBox rack import takes (10, 19, 21, 23), and the options listed
  assert.equal(X.rackImportRows({rack: r}).rows[0].width, 23);
  assert.deepEqual(X.rackImportRows({rack: r}).columns, X.NETBOX_RACK_COLUMNS);
  const odd = X.rackImportRows({rack: {...r, frame: {...r.frame, width: 24}}});
  assert.deepEqual([odd.rows[0].width, odd.rows[0].comments], [19, 'Its rails are 24 in wide, which the NetBox rack import does not take; 19 is written.']);
  assert.match(Q.describe(r, ctx), /numbered bottom-up\. Options: channels, castors\./);
  // a width that is no width is dropped; the part with a channel still fits where it stands
  assert.equal('width' in M.normalizeFrame({...frame, width: 'wide'}), false);
  assert.equal(F.fitsZeroU({...r, zeroU: []}, {ref: 'duct', at: 'left-rear', ru: 1}, chassisOf).ok, true);
});

// ── setback ──────────────────────────────────────────────────────────────

test('the setback order: the item, the default ear position of the device, the rack, then flush', () => {
  const r = rackOf({setback: 20});
  const of = (ref, extra = {}) => F.setbackOf(r, {ref, ...extra}, chassisOf);
  assert.equal(of('sw', {setback: 12}), 12);
  assert.equal(of('eared', {setback: 12}), 12);
  assert.equal(of('eared'), 40, 'an ear position 40 mm behind is a setback of 40');
  assert.equal(of('flush'), 0, 'a flush position with no distance is 0');
  assert.equal(of('named'), 20, 'any other name with no distance falls through to the rack');
  assert.equal(of('sw'), 20);
  assert.equal(F.setbackOf(rackOf(), {ref: 'sw'}, chassisOf), 0, 'with nothing stated a faceplate is flush');
  assert.equal(of('mgr', {setback: 12}), 0, 'a part on the rail face has none');
  assert.equal(of('sw', {setback: -5}), -5, 'negative is proud');
  // kept only as a number
  assert.equal('setback' in M.normalizeFrame({setback: '20'}), false);
  assert.equal('setback' in M.parseDoc({format: 'portrayal-rack', version: 4, racks: [{frame: {},
    items: [{id: 'i1', ref: 'sw', ru: 1, setback: 'far'}]}]}).racks[0].items[0], false);
});

test('a setback is fitted against the usable depth and the other face; a decrease is never refused', () => {
  // usable 1000: a 700 mm device set back 301 does not fit, 300 does
  let r = put(rackOf(), 'deep', 10, {label: 'srv'});
  assert.deepEqual(run(r, {op: 'patch', id: 'i1', setback: 301}), {index: 0, error: '700 mm deep, set back 301 mm; this rack allows 1000 mm.'});
  r = run(r, {op: 'patch', id: 'i1', setback: 300}).rack;
  assert.equal(r.items[0].setback, 300);
  // the other face: rails 740 apart; a 500 mm switch on the rear of U10, with the front device 200 deep
  r = put(put(rackOf(), 'short', 10, {label: 'front'}), 'sw', 10, {face: 'rear', label: 'rear'});
  assert.equal(F.fits(r, r.items[1], chassisOf, {ignoreId: 'i2'}).ok, true, '200 + 500 is inside 740');
  assert.deepEqual(run(r, {op: 'patch', id: 'i1', setback: 41}), {index: 0, error: '200 mm deep, set back 41 mm; 240 mm free behind rear.'});
  const forty = run(r, {op: 'patch', id: 'i1', setback: 40});
  assert.equal(forty.error, undefined);
  // and the one on the rear, measured from its own rail
  assert.deepEqual(run(forty.rack, {op: 'patch', id: 'i2', setback: 1}), {index: 0, error: '500 mm deep, set back 1 mm; 500 mm free behind front.'});
  // a decrease is taken even where the item no longer fits as it stands
  const tight = {...forty.rack, frame: M.normalizeFrame({...forty.rack.frame, railDepth: 700})};
  assert.equal(F.fits(tight, tight.items[0], chassisOf, {ignoreId: 'i1'}).ok, false);
  const less = run(tight, {op: 'patch', id: 'i1', setback: 39});
  assert.equal(less.error, undefined);
  assert.equal(less.rack.items[0].setback, 39);
  const none = run(tight, {op: 'patch', id: 'i1', setback: null});
  assert.equal('setback' in none.rack.items[0], false);
  assert.equal(run(none.rack, {op: 'patch', id: 'i1', setback: null}).noop, true);
  // the rack default: a larger one is checked for every device it moves, a smaller one is not
  assert.deepEqual(run(r, {op: 'frame', setback: 30}), {index: 0, error: 'front: 200 mm deep, set back 30 mm; 210 mm free behind rear.'});
  // refused on depth alone: a rack that holds an overlap in height (as a version-3 rack could) is not refused for it
  const over = put(put(rackOf(), 'sw', 1, {label: 'a'}), 'sw', 1, {label: 'b'});
  assert.equal(F.fits(over, over.items[0], chassisOf, {ignoreId: 'i1'}).reason, 'Taken by b on the front.');
  assert.equal(run(over, {op: 'frame', setback: 30}).rack.frame.setback, 30);
  assert.equal(run(over, {op: 'patch', id: 'i1', setback: 30}).rack.items[0].setback, 30);
  // and not bypassed by a shrink in the same command: 700 deep, set back 301, is past 1000
  const tall = put(rackOf(), 'deep', 10, {label: 'srv'});
  assert.deepEqual(run(tall, {op: 'frame', heightRU: 41, setback: 301}), {index: 0, error: 'srv: 700 mm deep, set back 301 mm; this rack allows 1000 mm.'});
  assert.deepEqual(run(tall, {op: 'frame', heightRU: 5, setback: 301}), {index: 0, error: 'srv: 700 mm deep, set back 301 mm; this rack allows 1000 mm.'});
  assert.equal(run(tall, {op: 'frame', heightRU: 41, setback: 300}).rack.frame.setback, 300);
  // a part on the rail face has no setback: it is refused one, and one written by hand is not said
  const mg = put(rackOf(), 'mgr', 5, {label: 'CM'});
  assert.deepEqual(run(mg, {op: 'patch', id: 'i1', setback: 10}), {index: 0, error: 'CM bolts to the rail face, so it has no setback.'});
  assert.ok(Q.describe(withKeys(mg, 'i1', {setback: 10}), ctx).split('\n').includes('i1 CM U5 front'));
  // proud reads as fit says it
  const proud = withKeys(put(rackOf({setback: -25}), 'sw', 5, {label: 'leaf'}), 'i1', {setback: -25});
  assert.match(Q.describe(proud, ctx), /Faceplates set forward 25 mm\./);
  assert.ok(Q.describe(proud, ctx).split('\n').includes('i1 leaf U5 front, set forward 25 mm'));
  assert.ok(Q.describe(withKeys(proud, 'i1', {setback: 12}), ctx).split('\n').includes('i1 leaf U5 front, set back 12 mm'));
  const twenty = run(r, {op: 'frame', setback: 20});
  assert.equal(twenty.rack.frame.setback, 20);
  assert.equal(run(twenty.rack, {op: 'frame', setback: null}).rack.frame.setback, undefined);
  // a manager on the far rail: a device that reaches it with its setback is refused
  let m = put(put(rackOf(), 'deep', 10, {label: 'srv'}), 'mgr', 10, {face: 'rear'});
  assert.equal(F.fits(m, m.items[0], chassisOf, {ignoreId: 'i1'}).ok, true, '700 is short of the rear rail at 740');
  assert.deepEqual(run(m, {op: 'patch', id: 'i1', setback: 41}), {index: 0, error: '700 mm deep, set back 41 mm; it would reach past the rear rail into MGR.'});
  // what it leaves the other face
  assert.equal(F.availableDepth(forty.rack, forty.rack.items[1], chassisOf), 500);
  assert.equal(F.availableDepth(forty.rack, forty.rack.items[0], chassisOf), 200);
  // and whether its far panel shows at the other rail: within 50 mm of it
  assert.equal(F.reaches({ref: 'sw'}, rackOf(), chassisOf), false);
  assert.equal(F.reaches({ref: 'sw', setback: 200}, rackOf(), chassisOf), true);
});

test('the solids and a routed length follow a setback', () => {
  let r = put(put(rackOf(), 'sw', 10, {label: 'a'}), 'sw', 12, {label: 'b'});
  r = {...r, cables: [{id: 'c1', a: {item: 'i1', path: 'p', view: 'front'}, b: {item: 'i2', path: 'p', view: 'front'}, media: 'om4', route: []}]};
  const rc = {chassisOf, guidesOf: () => [], portX: () => 0};
  const back = withKeys(r, 'i2', {setback: 30});
  // the port of the item set back is 30 mm behind the front rail; its far panel 30 mm further too
  assert.equal(R.portPoint(r, r.cables[0].b, rc).z, 0);
  assert.equal(R.portPoint(back, back.cables[0].b, rc).z, -30);
  assert.equal(R.portPoint(back, {item: 'i2', path: 'p', view: 'rear'}, rc).z, -530);
  assert.equal(R.portPoint(r, {item: 'i2', path: 'p', view: 'rear'}, rc).z, -500);
  // on the rear rails its own front panel looks out of the back, 30 mm
  // forward of the rear rail at -740, and its far panel 500 mm beyond
  const rear = withKeys(back, 'i2', {face: 'rear'});
  assert.equal(R.portPoint(rear, {item: 'i2', path: 'p', view: 'front'}, rc).z, -710);
  assert.equal(R.portPoint(rear, {item: 'i2', path: 'p', view: 'rear'}, rc).z, -210);
  // the body stands with it
  const box = rack => S.solidsOf(rack, {chassisOf}).find(s => s.item === 'i2').box;
  assert.deepEqual([box(r).z0, box(r).z1], [-500, 0]);
  assert.deepEqual([box(back).z0, box(back).z1], [-530, -30]);
  // and the length: one end 30 mm further back is a longer cord
  const flat = R.pathLength(R.routePath(r, r.cables[0], rc)).measured;
  const deep = R.pathLength(R.routePath(back, back.cables[0], rc)).measured;
  assert.ok(deep > flat + 0.001, `${flat} m flush, ${deep} m with one end set back`);
  // the rack default moves both ends alike, and the length is the flush one
  const both = {...r, frame: M.normalizeFrame({...r.frame, setback: 30})};
  assert.equal(R.portPoint(both, both.cables[0].a, rc).z, -30);
  assert.ok(Math.abs(R.pathLength(R.routePath(both, both.cables[0], rc)).measured - flat) < 1e-9);
});

// ── a held item ──────────────────────────────────────────────────────────

const HELD = {heldBy: {item: 'i1', at: 'rail', x: 35}};
const shelfRack = () => withKeys(put(put(rackOf(), 'shelf', 20, {label: 'Shelf'}), 'din', 20, {label: 'DIN switch'}), 'i2', HELD);

test('placing a held item is refused with its sentence, and null frees one', () => {
  const r = put(put(rackOf(), 'shelf', 20, {label: 'Shelf'}), 'din', 20, {label: 'DIN switch'});
  assert.deepEqual(run(r, {op: 'patch', id: 'i2', heldBy: {item: 'i1', at: 'rail', x: 35}}), {error: NO_HOSTS, index: 0});
  assert.deepEqual(run(r, {op: 'place', ref: 'din', face: 'front', ru: 20, heldBy: {item: 'i1'}}), {error: 'place does not take heldBy.', index: 0});
  assert.equal(run(r, {op: 'patch', id: 'i2', heldBy: null}).noop, true, 'nothing to free');
  const freed = run(shelfRack(), {op: 'patch', id: 'i2', heldBy: null});
  assert.equal('heldBy' in freed.rack.items[1], false);
});

test('a held item: its host moved, removed and shrunk with; itself moved by hand', () => {
  const r = shelfRack();
  // it claims no unit, and is not checked
  assert.deepEqual(F.fits(r, r.items[1], chassisOf, {ignoreId: 'i2'}),
    {ok: true, unchecked: 'i2 is held by i1, and DINRAIL2U states no rail to hold a device, so it is not checked.'});
  assert.equal(F.fits(r, {ref: 'sw', ru: 22, face: 'front'}, chassisOf).ok, true);
  assert.equal(F.fits(r, r.items[0], chassisOf, {ignoreId: 'i1'}).ok, true, 'the shelf is not refused by what it holds');
  assert.ok(Q.describe(r, ctx).split('\n').some(l => /^i2 DIN switch U20 front, held by i1, not checked$/.test(l)), Q.describe(r, ctx));
  assert.ok(Q.describe(r, ctx).split('\n').some(l => /^i1 Shelf U20-U21 front, holds i2$/.test(l)));
  // the host is moved: it takes the face and the unit, and its heldBy is unchanged
  const moved = run(r, {op: 'move', id: 'i1', ru: 30, face: 'rear'});
  assert.deepEqual(moved.rack.items.map(i => [i.id, i.ru, i.face]), [['i1', 30, 'rear'], ['i2', 30, 'rear']]);
  assert.deepEqual(moved.rack.items[1].heldBy, HELD.heldBy);
  // moved by hand: refused
  assert.deepEqual(run(r, {op: 'move', id: 'i2', ru: 5}), {error: 'i2 is held by i1: move i1, or free it first.', index: 0});
  // the rack is shrunk: it takes the shift of its host
  const shrunk = run(r, {op: 'frame', heightRU: 10});
  assert.deepEqual(shrunk.rack.items.map(i => [i.id, i.ru]), [['i1', 1], ['i2', 1]]);
  // the host is removed: it stays where it was, a note says so, and fit refuses it until it is placed again
  const gone = run(r, {op: 'remove', id: 'i1'});
  assert.equal(gone.summary, 'Removed Shelf. DIN switch was held by it and stays where it was, held by nothing.');
  assert.deepEqual(gone.rack.items, [r.items[1]]);
  assert.deepEqual(F.fits(gone.rack, gone.rack.items[0], chassisOf, {ignoreId: 'i2'}),
    {ok: false, reason: 'i2 is held by i1, which is not in this rack: place it again, or free it.'});
  assert.deepEqual(F.frameNotices(gone.rack, chassisOf), ['i2 is held by i1, which is not in this rack: place it again, or free it.']);
  // a rack device standing on a shelf keeps its own unit and is fitted as any rack device
  const onShelf = withKeys(put(put(rackOf(), 'shelf', 20, {label: 'Shelf'}), 'sw', 22, {label: 'leaf'}), 'i2', HELD);
  assert.deepEqual(F.fits(onShelf, onShelf.items[1], chassisOf, {ignoreId: 'i2'}), {ok: true});
  assert.ok(Q.describe(onShelf, ctx).split('\n').includes('i2 leaf U22 front, held by i1'), 'it is checked, so it is not said to be unchecked');
  assert.equal(F.fits(onShelf, {ref: 'sw', ru: 22, face: 'front'}, chassisOf).ok, false);
  assert.deepEqual(run(onShelf, {op: 'move', id: 'i1', ru: 30}).rack.items.map(i => i.ru), [30, 22]);
});

test('a held item is exported in the rack with no position and a comment', () => {
  const r = {...shelfRack(), name: 'R1'};
  const types = new Map(['i1', 'i2'].map(id => [id, {manufacturer: 'FS', model: id, isFullDepth: false, guess: false}]));
  for (const [target, T] of [['netbox', 'NetBox'], ['nautobot', 'Nautobot']]) {
    const rows = X.deviceImportRows({rack: r, items: F.itemsWithU(r, chassisOf), types, target}).rows;
    const held = rows.find(x => x.name === 'DIN switch'), shelf = rows.find(x => x.name === 'Shelf');
    assert.deepEqual([held.position, held.face], ['', ''], target);
    assert.ok(held.comments.endsWith(`On Shelf, which holds it; ${T} has no field for that.`), held.comments);
    assert.deepEqual([shelf.position, shelf.face, shelf.comments], [20, 'front', '']);
  }
});

test('a shrink that drops a host says what it held, and no held item is left outside the rack', () => {
  // the shelf at U2 is dropped by a shrink to 3U that keeps the deeper cluster above it; what it held stays
  let r = withKeys(put(put(put(rackOf(), 'shelf', 2, {label: 'Shelf'}), 'din', 2, {label: 'DIN switch'}), 'deep', 10, {label: 'srv'}), 'i2', HELD);
  r = put(r, 'sw', 12, {label: 'leaf'});
  const s = F.shrinkRack(r, 3, chassisOf);
  assert.deepEqual(s.removed.map(i => i.id), ['i1']);
  assert.deepEqual(s.orphaned.map(i => i.id), ['i2']);
  assert.deepEqual(s.rack.items.map(i => [i.id, i.ru]), [['i2', 2], ['i3', 1], ['i4', 3]]);
  const res = run(r, {op: 'frame', heightRU: 3});
  assert.equal(res.summary, 'Moved 2 devices down and removed 1 from the bottom to fit 3U: Shelf. ' +
    'DIN switch was held by a removed device and stays in the rack, held by nothing.');
  assert.equal(F.fits(res.rack, res.rack.items[0], chassisOf, {ignoreId: 'i2'}).ok, false, 'refused until it is placed again or freed');
  // an item whose host is gone, left above the new top, comes down to the top unit
  const orphan = withKeys(put(put(rackOf(), 'din', 30, {label: 'DIN switch'}), 'sw', 2, {label: 'leaf'}), 'i1', {heldBy: {item: 'i9'}});
  const low = F.shrinkRack(orphan, 10, chassisOf);
  assert.deepEqual(low.rack.items.map(i => [i.id, i.ru]), [['i1', 10], ['i2', 2]]);
  assert.deepEqual([low.moved, low.removed, low.orphaned], [['i1'], [], []]);
  assert.doesNotThrow(() => M.parseDoc(M.serialize({...M.newDoc(), racks: [low.rack]})));
  // a held item whose host stays keeps its place beside it
  assert.deepEqual(F.shrinkRack(shelfRack(), 30, chassisOf).rack.items.map(i => i.ru), [20, 20]);
});

test('an item bolted over a device and held by one is refused by fit until one is removed, and said on load', () => {
  // a manager over the shelf that also names the shelf in heldBy
  let r = put(put(rackOf(), 'shelf', 20, {label: 'Shelf'}), 'mgr', 21, {label: 'CM', on: 'i1', unit: 2});
  r = withKeys(r, 'i2', {heldBy: {item: 'i1', at: 'rail', x: 0}});
  const text = 'i2 is on i1 and held by i1: a part is bolted over a device or held by one, not both, so remove one.';
  assert.deepEqual(F.fits(r, r.items[1], chassisOf, {ignoreId: 'i2'}), {ok: false, reason: text});
  assert.deepEqual(F.frameNotices(r, chassisOf), [text]);
  // the host moves: the part goes by its unit, as a manager does, not to the bottom of the host
  const moved = M.parseDoc(M.serialize({...M.newDoc(), racks: [r]})).racks[0];
  assert.deepEqual(moved.items[1].heldBy, {item: 'i1', at: 'rail', x: 0}, 'both keys are kept on load');
  const m = run(withKeys(r, 'i2', {}), {op: 'move', id: 'i1', ru: 30});
  assert.equal(m.error, `CM moves with it: ${text}`);
  // freed of one, it fits and follows by its unit
  const freed = run(r, {op: 'patch', id: 'i2', heldBy: null}).rack;
  assert.deepEqual(run(freed, {op: 'move', id: 'i1', ru: 30}).rack.items.map(i => i.ru), [30, 31]);
});

