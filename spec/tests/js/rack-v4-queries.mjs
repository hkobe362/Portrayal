// spec/tests/js/rack-v4-queries.mjs
// QUERIES AND AGENT OUTPUT OF RACK FILE VERSION 4
// (docs/rack-file-v4-design.md build part 10): the command table validates
// each argument version 4 adds; `inspect` says once that the ear holes of a
// device of a fractional height are not checked; and `cable.lay` pins the
// face a cable lies on in a tray, which the routes act on.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply, COMMANDS} from '../../../kit/rack/commands.js';
import {validate} from '../../../kit/rack/validate.js';
import * as FX from './route-direct-fixture.mjs';

const bad = (op, args) => validate(COMMANDS[op].args, args).map(e => e.keyword);

test('the command table validates each argument version 4 adds', () => {
  const AT = {item: 'i4', via: 'tray'};
  // [op, the arguments it takes, [arguments it refuses, the keyword that refuses them]...]
  const rows = [
    ['place', {ref: 'x', face: 'front', ru: 12.5}, [{ref: 'x', face: 'front', ru: 12.25}, 'multipleOf'], [{ref: 'x', face: 'front', ru: 0.5}, 'minimum']],
    ['move', {id: 'i1', ru: 3.5}, [{id: 'i1', ru: 3.2}, 'multipleOf']],
    ['patch', {id: 'i1', roll: 180}, [{id: 'i1', roll: 45}, 'enum']],
    ['patch', {id: 'i1', roll: null}],
    ['patch', {id: 'i1', setback: 25.4}, [{id: 'i1', setback: 'deep'}, 'type']],
    ['patch', {id: 'i1', setback: null}],
    ['frame', {startU: 5}, [{startU: 0}, 'minimum'], [{startU: 1.5}, 'type']],
    ['frame', {setback: 50}, [{setback: 'deep'}, 'type']],
    ['frame', {holes: {style: 'round'}}, [{holes: {style: 'oval'}}, 'enum']],
    ['zerou.update', {id: 'z1', swaps: {}}, [{id: 'z1', swaps: 3}, 'type']],
    ['zerou.update', {id: 'z1', fields: {}}, [{id: 'z1', fields: 'x'}, 'type']],
    ['zerou.hang', {id: 'z3', on: ['z1', 'z2']}, [{id: 'z3', on: 'z1'}, 'type'], [{id: 'z3'}, 'required']],
    ['zerou.hang', {id: 'z3', on: null}],
    ['state.set', {id: 'z3', path: 'outlet-a2', state: 'off'}, [{id: 'z3', path: 'outlet-a2', state: 7}, 'type'], [{id: 'z3', state: 'off'}, 'required']],
    ['state.set', {id: 'z3', path: 'outlet-a2', state: null}],
    ['readings.set', {id: 'z3', readings: {source: 's', at: '2026-10-08T14:00:00Z', values: {}}}, [{id: 'z3', readings: 4}, 'type']],
    ['readings.set', {id: 'z3', readings: null}],
    ['cable.slack', {id: 'c1', at: AT, value: 1.5, unit: 'm', form: 'coil'}, [{id: 'c1', at: AT, form: 'knot'}, 'enum'],
      [{id: 'c1', at: AT, value: 0}, 'exclusiveMinimum'], [{id: 'c1', at: AT, unit: 'cm'}, 'enum'], [{id: 'c1'}, 'required']],
    ['cable.slack', {id: 'c1', at: {end: 'a'}}, [{id: 'c1', at: {end: 'c'}}, 'enum']],
    ['cable.slack.clear', {id: 'c1'}, [{id: 'c1', at: {tray: 1}}, 'additionalProperties']],
    ['cable.lay', {id: 'c1', at: AT, face: 'underside'}, [{id: 'c1', at: AT, face: 'left'}, 'enum'], [{id: 'c1', at: {item: 'i4'}, face: 'top'}, 'required'],
      [{id: 'c1', at: AT, position: 0}, 'minimum'], [{id: 'c1', at: AT, position: 1.5}, 'type'], [{id: 'c1', at: AT, side: 'top'}, 'additionalProperties']],
    ['cable.lay', {id: 'c1', at: AT, face: null, position: null}],
    ['cable.lay', {id: 'c1', at: AT, position: 2}],
    ['bundle.update', {id: 'b1', straps: {breakout: false}}, [{id: 'b1', straps: {breakout: 'no'}}, 'type'], [{id: 'b1', straps: {tight: true}}, 'additionalProperties']],
    ['bundle.update', {id: 'b1', straps: {anchors: false, every: null}}],
    ['cable.update', {id: 'c1', straps: {anchors: false}}, [{id: 'c1', straps: {anchors: 1}}, 'type']],
    ['cable.update', {id: 'c1', straps: null}],
  ];
  for (const [op, ok, ...refused] of rows) {
    assert.ok(Object.hasOwn(COMMANDS, op), op);
    assert.deepEqual(bad(op, ok), [], `${op} takes ${JSON.stringify(ok)}`);
    for (const [args, keyword] of refused) assert.ok(bad(op, args).includes(keyword), `${op} refuses ${JSON.stringify(args)} by ${keyword}: ${bad(op, args)}`);
  }
  // every argument of every command says what it is, since an agent reads the table
  for (const [op, def] of Object.entries(COMMANDS)) for (const [k, p] of Object.entries(def.args.properties))
    assert.ok(typeof p.description === 'string' && p.description.length > 10, `${op}.${k} has a description`);
});

test('inspect says once that the ear holes of a device of a fractional height are not checked', async () => {
  const SIZES = {xcu: {ru: 0.5, w: 482.6, h: 22.2, d: 284, model: 'XCU10'}, agg: {ru: 1.5, w: 440, h: 66, d: 300, model: 'TM-7124S'},
    sw: {ru: 1, w: 440, h: 43.6, d: 500, model: 'SW-1'}, mgr: {ru: 1.5, w: 440, h: 66, d: 60, mount: 'rack-face', model: 'MGR'}};
  const chassisOf = ref => SIZES[ref] || null;
  let r = {...M.newRack({name: 'R'}), frame: M.normalizeFrame({kind: 'four-post', heightRU: 42})};
  for (const [ref, ru] of [['xcu', 12.5], ['agg', 20], ['sw', 30], ['mgr', 35]]) r = M.withItem(r, {ref, cfg: '', ru, label: ref}).rack;
  const notes = async (rack, id) => (await Q.inspect(rack, id, {chassisOf})).notes;
  assert.deepEqual(await notes(r, 'i1'), ['The ear holes of XCU10 are not stated, so its holes at U12.5 are not checked.']);
  assert.deepEqual(await notes(r, 'i2'), ['The ear holes of TM-7124S are not stated, so its holes at U20 are not checked.']);
  // a whole-unit device is checked by the fit, and a part on the rail face has no ears: neither is said
  assert.equal(await notes(r, 'i3'), undefined);
  assert.equal(await notes(r, 'i4'), undefined);
  // the unit is the label on the rack: top-down, the upper half of U12 is U31
  const down = {...r, frame: M.normalizeFrame({kind: 'four-post', heightRU: 42, numbering: 'top-down'})};
  assert.deepEqual(await notes(down, 'i1'), ['The ear holes of XCU10 are not stated, so its holes at U31 are not checked.']);
  // with no catalogue nothing is known of its height, so nothing is said
  assert.equal((await Q.inspect(r, 'i1', {})).notes, undefined);
});

// the reference rack with one cord laid along the tray of its lacer (i4)
const TRAY = {item: 'i4', via: 'tray'};
function onTray() {
  const r0 = FX.rack();
  const c = {...r0.cables[0], b: {item: 'i2', path: 'bay-2/module/lc3', view: 'front'}, route: [TRAY], routeEdited: true};
  return {...r0, cables: [c, ...r0.cables.slice(1)]};
}
const run = (rack, cmds, ctx = {}) => apply(rack, cmds, ctx);

test('cable.lay pins the face a cable lies on in a tray, and the routes act on it', async () => {
  const r = onTray(), ctx = FX.ctxOf(r);
  const res = run(r, {op: 'cable.lay', id: 'c1', at: TRAY, face: 'underside'}, {route: ctx});
  assert.equal(res.error, undefined, res.error);
  assert.deepEqual(res.rack.cables[0].lay, [{item: 'i4', via: 'tray', face: 'underside'}]);
  assert.equal(res.summary, 'Laid c1 on the underside of CM-01 tray.');
  // the route of the file is the route a page's pin gave: on the held face, at its tie slots
  const laid = R.routePath(res.rack, res.rack.cables[0], ctx);
  const pinned = R.routePath(r, r.cables[0], {...ctx, trayFaceOf: (cable, w) => (w.via === 'tray' ? 'underside' : null)});
  const up = R.routePath(r, r.cables[0], ctx);
  assert.deepEqual(laid.points, pinned.points);
  assert.notDeepEqual(laid.points, up.points);
  const rest = p => p.rests.filter(x => x.kind === 'tray').map(x => [x.face, x.role]);
  assert.deepEqual([rest(laid), rest(up)], [[['underside', 'held']], [['top', 'resting']]]);
  // the file wins over the page's pin, and `top` in the file is the face that looks up
  const top = run(res.rack, {op: 'cable.lay', id: 'c1', at: TRAY, face: 'top'}, {route: ctx}).rack;
  assert.deepEqual(rest(R.routePath(top, top.cables[0], {...ctx, trayFaceOf: () => 'underside'})), [['top', 'resting']]);
  // inspect reads it back, and its route says where the cable rests
  const seen = await Q.inspect(res.rack, 'c1', {chassisOf: FX.chassisOf, route: ctx});
  assert.deepEqual(seen.lay, [{item: 'i4', via: 'tray', face: 'underside'}]);
  assert.deepEqual(seen.route.rests.filter(x => x.kind === 'tray').map(x => [x.face, x.role]), [['underside', 'held']]);
  assert.equal('lay' in await Q.inspect(r, 'c1', {chassisOf: FX.chassisOf, route: ctx}), false);
  // saved and opened again it is as it was, and the same again is no step
  const doc = M.parseDoc(M.serialize({...M.newDoc(), racks: [res.rack]}));
  assert.deepEqual(doc.racks[0].cables[0].lay, res.rack.cables[0].lay);
  assert.equal(run(res.rack, {op: 'cable.lay', id: 'c1', at: TRAY, face: 'underside'}, {route: ctx}).noop, true);
});

test('cable.lay keeps a key left out, unpins with null, and removes an entry with neither left', () => {
  // a position is one of the cables that share the pathway (P-0018): three of them are on the tray
  const r0 = onTray(), G4 = {item: 'i4', via: 'guide-4'};
  const r = {...r0, cables: r0.cables.map((c, k) => (k < 3 ? {...c, route: [TRAY], routeEdited: true} : c))}, ctx = {route: FX.ctxOf(r)};
  const lay = rack => rack.cables[0].lay;
  const a = run(r,{op: 'cable.lay', id: 'c1', at: TRAY, face: 'underside', position: 2}, ctx).rack;
  assert.deepEqual(lay(a), [{item: 'i4', via: 'tray', position: 2, face: 'underside'}]);
  // position is kept and not acted on: the path is the one of the face alone
  const faceOnly = run(r, {op: 'cable.lay', id: 'c1', at: TRAY, face: 'underside'}, ctx).rack;
  assert.deepEqual(R.routePath(a, a.cables[0], ctx.route).points, R.routePath(faceOnly, faceOnly.cables[0], ctx.route).points);
  const b = run(a, {op: 'cable.lay', id: 'c1', at: TRAY, position: 3}, ctx);
  assert.deepEqual(lay(b.rack), [{item: 'i4', via: 'tray', position: 3, face: 'underside'}]);
  assert.equal(b.summary, 'Laid c1 on the underside, at position 3 of CM-01 tray.');
  const c = run(b.rack, {op: 'cable.lay', id: 'c1', at: TRAY, face: null}, ctx).rack;
  assert.deepEqual(lay(c), [{item: 'i4', via: 'tray', position: 3}]);
  const d = run(c, {op: 'cable.lay', id: 'c1', at: TRAY, position: null}, ctx);
  assert.equal('lay' in d.rack.cables[0], false, 'the key goes with the last entry');
  assert.equal(d.summary, 'c1 is no longer pinned in CM-01 tray.');
  assert.equal(run(d.rack, {op: 'cable.lay', id: 'c1', at: TRAY, position: null}, ctx).noop, true);
  // a second pathway is a second entry, and the first is left as it was
  // (a pathway the cable does not use takes no position)
  assert.match(run(a, {op: 'cable.lay', id: 'c1', at: G4, position: 1}, ctx).error, /^c1 does not pass through CM-01 guide-4/);
  const via4 = {...a, cables: [{...a.cables[0], route: [TRAY, G4]}, ...a.cables.slice(1)]};
  const two = run(via4, {op: 'cable.lay', id: 'c1', at: G4, position: 1}, ctx).rack;
  assert.deepEqual(lay(two), [{item: 'i4', via: 'tray', position: 2, face: 'underside'}, {item: 'i4', via: 'guide-4', position: 1}]);
  // what the file holds that is no usable entry is kept as written, and the routes pass over it
  const odd = {...r, cables: [{...r.cables[0], lay: ['x', {item: 'i4'}, {item: 'i4', via: 'tray', face: 'sideways'}]}, ...r.cables.slice(1)]};
  assert.deepEqual(R.routePath(odd, odd.cables[0], ctx.route).points, R.routePath(r, r.cables[0], ctx.route).points);
  const odd4 = {...odd, cables: [{...odd.cables[0], route: [TRAY, G4]}, ...odd.cables.slice(1)]};
  const kept = run(odd4, {op: 'cable.lay', id: 'c1', at: G4, position: 1}, ctx).rack;
  assert.deepEqual(lay(kept).slice(0, 2), ['x', {item: 'i4'}]);
  for (const l of [null, 7, 'tray', {item: 'i4', via: 'tray', face: 'underside'}])
    assert.equal(R.layFaceOf({lay: l}, TRAY), null, JSON.stringify(l));
});

test('cable.lay refuses a face on a ring, a held face the tray does not offer, and a cable or device that is gone', () => {
  const r = onTray(), ctx = {route: FX.ctxOf(r)};
  const err = (cmd, c = ctx, rack = r) => run(rack, {op: 'cable.lay', id: 'c1', ...cmd}, c).error;
  assert.equal(err({at: {item: 'i4', via: 'guide-4'}, face: 'top'}), 'CM-01 guide-4 is a ring or a duct, not a tray: a cable has no face to lie on there.');
  assert.equal(err({at: TRAY}), 'cable.lay needs a position or a face: a value to pin it, or null to unpin it.');
  assert.equal(err({at: {item: 'i99', via: 'tray'}, face: 'top'}), 'i99 is not in the rack.');
  assert.equal(run(r, {op: 'cable.lay', id: 'c99', at: TRAY, face: 'top'}, ctx).error, run(r, {op: 'cable.update', id: 'c99', label: 'x'}, ctx).error);
  // a pathway the device does not have is refused, whatever is pinned, and the sentence lists what it has
  for (const pin of [{face: 'top'}, {position: 2}])
    assert.match(err({at: {item: 'i4', via: 'no-such-via'}, ...pin}) || '', /^CM-01 has no ring, duct or tray called no-such-via\. It has: guide-1, .*tray\.$/, JSON.stringify(pin));
  // unpinning one that is gone is still allowed: the entry is in the file and has to come off
  const stale = {...r, cables: [{...r.cables[0], lay: [{item: 'i4', via: 'old-via', position: 1}]}, ...r.cables.slice(1)]};
  assert.equal('lay' in run(stale, {op: 'cable.lay', id: 'c1', at: {item: 'i4', via: 'old-via'}, position: null}, ctx).rack.cables[0], false);
  // a cable whose route does not rest on the tray cannot be said to lie on a face of it
  const off = r.cables.find(x => !(R.routePath(r, x, ctx.route).rests || []).some(y => y.kind === 'tray'));
  assert.ok(off, 'the rack has a cable that is not on the tray');
  assert.equal(run(r, {op: 'cable.lay', id: off.id, at: TRAY, face: 'underside'}, ctx).error, `CM-01 tray is not on the route of ${off.id}.`);
  assert.equal(run(r, {op: 'cable.lay', id: off.id, at: TRAY, face: 'underside'}, ctx).rack, undefined);
  // a tray that states no tie slots holds nothing to its underside
  const strip = v => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'ties' ? [] : strip(x)])) : v);
  const bare = {route: {...ctx.route, chassisOf: ref => strip(FX.chassisOf(ref))}};
  assert.equal(err({at: TRAY, face: 'underside'}, bare), 'CM-01 tray offers no held face: it states no tie slots, so nothing holds a cable to its underside.');
  assert.equal(err({at: TRAY, face: 'top'}, bare), undefined, 'the face that looks up is always offered');
  // turned over, the held face is the one the part calls its top
  const over = {...r, items: r.items.map(i => (i.id === 'i4' ? {...i, roll: 180} : i))};
  const overBare = {route: {...FX.ctxOf(over), chassisOf: ref => strip(FX.chassisOf(ref))}};
  assert.match(err({at: TRAY, face: 'top'}, overBare, over) || '', /offers no held face: .* to its top\.$/);
  // with no routes known the face is recorded as given, as cable.slack records a place
  assert.deepEqual(run(r, {op: 'cable.lay', id: 'c1', at: {item: 'i4', via: 'guide-4'}, face: 'top'}, {}).rack.cables[0].lay, [{item: 'i4', via: 'guide-4', face: 'top'}]);
});
