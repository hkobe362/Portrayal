// spec/tests/js/rack-straps.mjs
// STRAPS (docs/rack-file-v4-design.md section 3.10, build part 8): the three
// kinds a strap is (spacing, breakout, anchor), where a breakout strap goes
// beside a peel point, the tie slot an anchor is at, the `straps` keys on a
// bundle and on a cable, and what the BOM counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as B from '../../../kit/rack/bundles.js';
import * as S from '../../../kit/rack/solids.js';
import * as X from '../../../kit/rack/export-data.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply, COMMANDS} from '../../../kit/rack/commands.js';
import {withCable} from '../../../kit/rack/cable-rules.js';
import {RU} from '../../../kit/rack/rails.js';
import * as F from './route-direct-fixture.mjs';

// A switch at U10 with a manager on it (i2), a patch panel at U30 with one
// (i4). The manager's guides are ducts at the x given, so a trunk along them
// has its peel points exactly there and no strap is moved off a ring.
const VIAS = ['guide-1', 'guide-2', 'guide-3', 'guide-4', 'guide-5'];
const SIZES = {sw: {ru: 1, d: 515, model: 'SW'}, pp: {ru: 1, d: 100, model: 'PP'},
  mgr: {ru: 1, d: 110, mount: 'rack-face', model: 'MGR', guides: {front: VIAS}, default: 'x'}};
const chassisOf = ref => SIZES[ref] || null;
const routeCtx = (rack, xs) => ({chassisOf, portX: () => -150,
  guidesOf: id => (rack.items.find(i => i.id === id)?.ref === 'mgr' ? VIAS.map((via, k) => ({via, kind: 'duct', face: 'front', x: xs[k], box: {w: 40, h: 30}})) : [])});
const end = (item, path) => ({item, path, view: 'front'});
const RT = (...ws) => ws.map(w => (Array.isArray(w) ? {lane: w[0], ru: w[1]} : {item: w.split(':')[0], via: w.split(':')[1]}));
function rackWith(routes) {
  let r = M.newRack({name: 'Rack 1'});
  r = M.withItem(r, {ref: 'sw', cfg: 'x', ru: 10, label: 'sw-1'}).rack;
  r = M.withItem(r, {ref: 'mgr', cfg: 'x', ru: 10, label: 'mgr-1', on: 'i1', unit: 1}).rack;
  r = M.withItem(r, {ref: 'pp', cfg: 'x', ru: 30, label: 'pp-1'}).rack;
  r = M.withItem(r, {ref: 'mgr', cfg: 'x', ru: 30, label: 'mgr-2', on: 'i3', unit: 1}).rack;
  routes.forEach((route, k) => {
    r = withCable(r, {a: end('i1', `p${k + 1}`), b: end('i3', `q${k + 1}`), media: 'cat6'}).rack;
    r = {...r, cables: r.cables.map(c => (c.id === `c${k + 1}` ? {...c, route, routeEdited: true} : c))};
  });
  return r;
}
const run = (rack, cmds, ctx = {}) => apply(rack, cmds, {chassisOf, ...ctx});
const ALONG = RT(...VIAS.map(v => `i2:${v}`));
// a bundle along the five ducts of mgr-1, each member leaving at the duct named (or riding to the end)
function along(xs, leaves, straps) {
  const r = rackWith(leaves.map(() => ALONG));
  const members = leaves.map((v, k) => ({cable: `c${k + 1}`, ...(v ? {b: {item: 'i2', via: v}} : {})}));
  return {...r, bundles: [{id: 'b1', number: 1, label: '', members, route: ALONG, ...(straps ? {straps} : {})}]};
}
const got = (r, xs) => B.straps(r, r.bundles[0], {route: routeCtx(r, xs)});
const at = (s, kind) => s.straps.filter(x => x.kind === kind).map(x => x.along_mm);
const ONLY_BREAKOUT = {every: null, breakout: true, anchors: false};

// ── breakout straps ──────────────────────────────────────────────────────

test('a bundle of four with one cable leaving mid-trunk: a strap 25 mm each side of the peel, the same written end for end', () => {
  // up the left-front lane from U10 to U30 (889 mm), c4 leaving at U18, 355.6 mm along
  const UP1 = RT('i2:guide-1', ['left-front', 10], ['left-front', 30], 'i4:guide-1');
  const trunk = RT(['left-front', 10], ['left-front', 30]), peel = {lane: 'left-front', ru: 18};
  const r = rackWith([UP1, UP1, UP1, UP1]);
  const fwd = {...r, bundles: [{id: 'b1', number: 1, label: '', route: trunk, straps: ONLY_BREAKOUT,
    members: [{cable: 'c1'}, {cable: 'c2'}, {cable: 'c3'}, {cable: 'c4', b: peel}]}]};
  const xs = [-205, -100, 0, 100, 205];
  const s = got(fwd, xs);
  // four ride before the peel and three after: both sides, 25 mm from it; and in from each end of the trunk, where they fan out
  assert.deepEqual(at(s, 'breakout'), [25, 330.6, 380.6, 864]);
  assert.deepEqual(s.kinds, {spacing: 0, breakout: 4, anchor: 0});
  assert.ok(s.straps.every(x => x.kind === 'breakout' && Number.isInteger(x.segment)));
  // written end for end: the trunk from U30 down, the same peel, the same set of places on the lane
  const back = {...fwd, bundles: [{...fwd.bundles[0], route: [...trunk].reverse()}]};
  const mirrored = at(got(back, xs), 'breakout').map(a => Math.round((889 - a) * 10) / 10).sort((p, q) => p - q);
  assert.deepEqual(mirrored, [25, 330.6, 380.6, 864]);
  // the last two parting: three leave at U18 and one rides on alone, so the one side
  const last = {...fwd, bundles: [{...fwd.bundles[0], members: [{cable: 'c1'}, {cable: 'c2', b: peel}, {cable: 'c3', b: peel}, {cable: 'c4', b: peel}]}]};
  assert.deepEqual(at(got(last, xs), 'breakout'), [25, 330.6]);
  // with spacing straps too, each has its kind and the count is all of them
  const both = {...fwd, bundles: [{...fwd.bundles[0], straps: {every: {value: 250, unit: 'mm'}}}]};
  const sb = got(both, xs);
  assert.deepEqual(at(sb, 'spacing'), [111.1, 333.4, 555.6, 777.9]);
  // before the peel, 330.6 is 2.8 mm from the spacing strap at 333.4, which serves. After it, 380.6 has no
  // spacing strap on ITS side within 50 mm (the one at 333.4 is before the peel), so it is added
  assert.deepEqual(at(sb, 'breakout'), [25, 380.6, 864]);
  assert.deepEqual([sb.count, sb.kinds], [7, {spacing: 4, breakout: 3, anchor: 0}]);
});

test('two peels 60 mm apart share the outer straps, and peels at 0, 60 and 130 mm are one group from either end', () => {
  // ducts at 0, 300, 360, 430 and 900 mm along the trunk
  const xs = [-450, -150, -90, -20, 450];
  // c3 leaves at 300 and c4 at 360: one group, strapped before 300 and after 360, not between
  const two = along(xs, [null, null, 'guide-2', 'guide-3'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(two, xs), 'breakout'), [25, 275, 385, 875]);
  // c3 at 300, c4 at 360, c5 at 430: 360 chains to 300 and 430 to 360, though 430 is 130 from 300
  const three = along(xs, [null, null, 'guide-2', 'guide-3', 'guide-4'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(three, xs), 'breakout'), [25, 275, 455, 875]);
  // read from the other end the group is the same: the trunk reversed, the same members
  const back = {...three, bundles: [{...three.bundles[0], route: [...ALONG].reverse()}]};
  assert.deepEqual(at(got(back, xs), 'breakout').map(a => 900 - a).sort((p, q) => p - q), [25, 275, 455, 875]);
  // 76 mm apart they are two groups, each strapped on both sides
  const wide = [-450, -150, -74, 100, 450];
  assert.deepEqual(at(got(along(wide, [null, null, 'guide-2', 'guide-3'], ONLY_BREAKOUT), wide), 'breakout'), [25, 275, 325, 351, 401, 875]);
  // a side with less than 50 mm of riding gets none: the trunk ends 40 mm after the last peel
  const tail = [-450, -150, 0, 410, 450];
  const short = along(tail, [null, null, 'guide-4', 'guide-4'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(short, tail), 'breakout'), [25, 835], 'before the peel at 860, and none in the 40 mm after it');
});

test('a spacing strap 40 mm from a peel serves, and none is added on that side', () => {
  // 900 mm of trunk and straps every 300 mm: at 150, 450 and 750. c3 leaves at 490
  const xs = [-450, -200, 40, 200, 450];
  const r = along(xs, [null, null, 'guide-3'], {every: {value: 300, unit: 'mm'}});
  const s = got(r, xs);
  assert.deepEqual(at(s, 'spacing'), [150, 450, 750]);
  // before the peel a breakout strap would stand at 465, 15 mm from the one at 450: it serves.
  // After it one would stand at 515, 65 mm from it: added. And in from each end, 125 mm from the nearest.
  assert.deepEqual(at(s, 'breakout'), [25, 515, 875]);
  assert.equal(s.count, 6);
  // breakout: false turns them off and leaves the spacing straps
  const off = {...r, bundles: [{...r.bundles[0], straps: {every: {value: 300, unit: 'mm'}, breakout: false}}]};
  assert.deepEqual([at(got(off, xs), 'spacing'), at(got(off, xs), 'breakout')], [[150, 450, 750], []]);
});

// ── the keys ─────────────────────────────────────────────────────────────

test('breakout and anchors are on with a spacing or with none stated, and off where every is null', () => {
  const k = straps => B.strapKinds(straps === undefined ? {} : {straps});
  assert.deepEqual(k(undefined), {breakout: true, anchors: true});
  assert.deepEqual(k({every: {value: 12, unit: 'in'}}), {breakout: true, anchors: true});
  assert.deepEqual(k({every: null}), {breakout: false, anchors: false}, 'a bundle saved with no straps has none of any kind');
  assert.deepEqual(k({every: null, breakout: true}), {breakout: true, anchors: false}, 'breakout straps alone');
  assert.deepEqual(k({breakout: false}), {breakout: false, anchors: true});
  assert.deepEqual(k({anchors: false, every: {value: 300, unit: 'mm'}}), {breakout: true, anchors: false});
});

test('{breakout: false} alone survives a round trip and turns breakouts off; a version-3 bundle with every: null has no strap of any kind', () => {
  const xs = [-450, -150, -90, -20, 450];
  const r = along(xs, [null, null, 'guide-2'], {breakout: false});
  const doc = {...M.newDoc(), racks: [r]};
  const back = M.parseDoc(M.serialize(doc)).racks[0];
  assert.deepEqual(back.bundles[0].straps, {breakout: false});
  const s = got(back, xs);
  assert.deepEqual([s.kinds.breakout, s.kinds.spacing], [0, 3], 'the default spacing, 12 in, and no breakout strap');
  assert.deepEqual(s.every, {value: 12, unit: 'in'});
  // version 3: {every: null} meant no straps at all, and still does after the migration
  const v3 = {format: 'portrayal-rack', version: 3, id: 'd', racks: [along(xs, [null, null, 'guide-2'], {every: null})]};
  const opened = M.parseDoc(JSON.parse(JSON.stringify(v3)));
  assert.equal(opened.version, 4);
  assert.deepEqual(opened.racks[0].bundles[0].straps, {every: null});
  const none = got(opened.racks[0], xs);
  assert.deepEqual([none.count, none.kinds, none.straps], [0, {spacing: 0, breakout: 0, anchor: 0}, []]);
  // and a version-3 bundle with a spacing keeps it, and gains the breakout straps
  const spaced = M.parseDoc({...v3, racks: [along(xs, [null, null, 'guide-2'], {every: {value: 300, unit: 'mm'}})]}).racks[0];
  assert.deepEqual(got(spaced, xs).kinds, {spacing: 3, breakout: 4, anchor: 0}, 'each side of the peel at 300, and in from each end');
});

test('bundle.update merges straps by key, and null takes them back to the defaults', () => {
  const xs = [-450, -150, -90, -20, 450];
  let r = along(xs, [null, null]);
  const upd = straps => run(r, {op: 'bundle.update', id: 'b1', straps});
  r = upd({every: {value: 300, unit: 'mm'}}).rack;
  assert.deepEqual(r.bundles[0].straps, {every: {value: 300, unit: 'mm'}});
  // one key given: the others stay
  const b = upd({breakout: false});
  assert.deepEqual(b.rack.bundles[0].straps, {every: {value: 300, unit: 'mm'}, breakout: false});
  assert.equal(b.summary, 'Bundle 1 now has straps every 300 mm, no breakout straps.');
  r = b.rack;
  r = upd({anchors: false}).rack;
  assert.deepEqual(r.bundles[0].straps, {every: {value: 300, unit: 'mm'}, breakout: false, anchors: false});
  r = upd({every: null, breakout: true}).rack;
  assert.deepEqual(r.bundles[0].straps, {every: null, breakout: true, anchors: false});
  assert.equal(upd({every: null}).noop, true, 'the same value is no change');
  // null removes the object, which is the defaults; it used to throw building its sentence
  const cleared = upd(null);
  assert.equal(cleared.error, undefined);
  assert.equal('straps' in cleared.rack.bundles[0], false);
  assert.equal(cleared.summary, 'Bundle 1 now has straps every 12 in.');
  assert.equal(run(cleared.rack, {op: 'bundle.update', id: 'b1', straps: null}).noop, true);
  // the schema: no key is required, the three are the only ones, and bundle.create takes them too
  const S8 = COMMANDS['bundle.update'].args.properties.straps;
  assert.deepEqual([S8.required, Object.keys(S8.properties), S8.additionalProperties], [undefined, ['every', 'breakout', 'anchors'], false]);
  assert.deepEqual(run(r, {op: 'bundle.update', id: 'b1', straps: {tight: true}}), {error: 'bundle.update does not take straps.tight.', index: 0});
  const made = run(rackWith([ALONG, ALONG]), {op: 'bundle.create', cables: ['c1', 'c2'], route: ALONG, straps: {breakout: false}});
  assert.deepEqual(made.rack.bundles[0].straps, {breakout: false});
});

// ── anchor straps ────────────────────────────────────────────────────────

const TRAY = {item: 'i4', via: 'tray'};
// the reference rack with two cords laid along the tray of its lacer (i4)
function onTray(n = 2) {
  const r0 = F.rack();
  const lay = (c, path) => ({...c, b: {item: 'i2', path, view: 'front'}, route: [TRAY], routeEdited: true});
  const laid = [lay(r0.cables[0], 'bay-2/module/lc3'), lay(r0.cables[1], 'bay-2/module/lc4')].slice(0, n);
  return {...r0, cables: [...laid, ...r0.cables.slice(n)]};
}

test('a trunk over the FHD-CMP5DR tray gets one anchor, at the tie slot nearest the middle of its stretch', () => {
  const r0 = onTray();
  const [tray] = S.traysOf(r0, F.ctxOf(r0));
  assert.equal(tray.ties.length, 16, 'the lacer states sixteen tie slots');
  const withTrunk = route => ({...r0, bundles: [{id: 'b1', number: 1, label: '', members: [{cable: 'c1'}, {cable: 'c2'}], route}]});
  // from ring 4 (110.4 mm right of centre) onto the tray, whose middle is the centre: the stretch has its middle 55.2 right
  const r = withTrunk([{item: 'i4', via: 'guide-4'}, TRAY]);
  const s = B.straps(r, r.bundles[0], {route: F.ctxOf(r)});
  assert.deepEqual(s.kinds.anchor, 1);
  const a = s.straps.find(x => x.kind === 'anchor');
  assert.deepEqual([a.item, a.via, a.tie], ['i4', 'tray', 8]);
  const mid = t => (t.x0 + t.x1) / 2;
  assert.ok(Math.abs(mid(tray.ties[8]) - 55.2) < 0.1, `slot 8 is at ${mid(tray.ties[8])}`);
  assert.ok(tray.ties.every((t, i) => i === 8 || Math.abs(mid(t) - 55.2) >= Math.abs(mid(tray.ties[8]) - 55.2)), 'none is nearer');
  // through the tray from ring 4 to ring 2 the middle is the centre: slots 7 and 10 are as near, and the lower index is taken
  const thru = withTrunk([{item: 'i4', via: 'guide-4'}, TRAY, {item: 'i4', via: 'guide-2'}]);
  assert.equal(B.straps(thru, thru.bundles[0], {route: F.ctxOf(thru)}).straps.find(x => x.kind === 'anchor').tie, 7);
  // anchors: false turns it off; every: null alone turns every kind off
  for (const straps of [{anchors: false}, {every: null}]) {
    const off = {...r, bundles: [{...r.bundles[0], straps}]};
    assert.equal(B.straps(off, off.bundles[0], {route: F.ctxOf(off)}).kinds.anchor, 0, JSON.stringify(straps));
  }
  // the slot is counted once for the rack, with what is tied there
  assert.deepEqual(B.anchorsOf(r, {route: F.ctxOf(r)}).find(x => x.tie === 8), {item: 'i4', via: 'tray', tie: 8, bundles: ['b1'], cables: []});
});

test('a single cable is anchored too: each tie slot it uses on the held face, and the nearest on the resting face', () => {
  const r = onTray(1);
  const ctx = {route: F.ctxOf(r)};
  // on the resting face: one strap, at the slot nearest the middle of its stretch on the tray
  const rest = B.anchorsOf({...r, cables: [r.cables[0]]}, ctx);
  assert.deepEqual(rest, [{item: 'i4', via: 'tray', tie: 10, bundles: [], cables: ['c1']}]);
  // on the held face: one a tie slot it uses, as the cable lay note counts
  const held = {route: {...F.ctxOf(r), trayFaceOf: (cable, w) => (w.via === 'tray' ? 'underside' : null)}};
  assert.deepEqual(B.anchorsOf({...r, cables: [r.cables[0]]}, held).map(x => [x.tie, x.cables]), [[4, ['c1']], [5, ['c1']], [8, ['c1']], [9, ['c1']]]);
  // straps: {anchors: false} on the cable turns its own off
  assert.deepEqual(B.anchorsOf({...r, cables: [{...r.cables[0], straps: {anchors: false}}]}, ctx), []);
  // ONE STRAP AT A SLOT SERVES EVERY CABLE THERE: the count is by slot, never by cable.
  // On the reference rack two cords come to rest on the tray, at one slot.
  const owner = F.rack();
  const all = B.anchorsOf(owner, {route: F.ctxOf(owner)});
  assert.deepEqual(all, [{item: 'i4', via: 'tray', tie: 14, bundles: [], cables: ['c7', 'c14']}]);
  assert.deepEqual(B.strapTotals(owner, {route: F.ctxOf(owner)}), {spacing: 0, breakout: 0, anchor: 1, total: 1});
  // a ring states no tie point, so a cord through a ring alone is tied to nothing; and without routes there is none
  assert.equal(all.some(x => x.cables.includes('c1')), false);
  assert.deepEqual(B.anchorsOf(owner, {}), []);
  // the command: a cable takes straps {anchors}, merged, and null takes the key off
  const off = run(r, {op: 'cable.update', id: 'c1', straps: {anchors: false}});
  assert.deepEqual(off.rack.cables[0].straps, {anchors: false});
  assert.equal(run(off.rack, {op: 'cable.update', id: 'c1', straps: {anchors: false}}).noop, true);
  assert.equal('straps' in run(off.rack, {op: 'cable.update', id: 'c1', straps: null}).rack.cables[0], false);
  assert.deepEqual(run(r, {op: 'cable.update', id: 'c1', straps: {every: null}}), {error: 'cable.update does not take straps.every.', index: 0});
  assert.deepEqual(M.parseDoc(M.serialize({...M.newDoc(), racks: [off.rack]})).racks[0].cables[0].straps, {anchors: false});
});

// ── the count ────────────────────────────────────────────────────────────

test('the BOM count is the three kinds summed, anchors by slot', () => {
  // a bundle up the lane with a peel (spacing and breakout straps), on a rack whose tray ties one cord
  const UP1 = RT('i2:guide-1', ['left-front', 10], ['left-front', 30], 'i4:guide-1');
  const xs = [-205, -100, 0, 100, 205];
  let r = rackWith([UP1, UP1, UP1, UP1]);
  r = {...r, bundles: [{id: 'b1', number: 1, label: '', route: RT(['left-front', 10], ['left-front', 30]),
    members: [{cable: 'c1'}, {cable: 'c2'}, {cable: 'c3'}, {cable: 'c4', b: {lane: 'left-front', ru: 18}}]}]};
  const ctx = {route: routeCtx(r, xs)};
  const s = B.straps(r, r.bundles[0], ctx);
  assert.deepEqual(s.kinds, {spacing: 3, breakout: 4, anchor: 0});
  assert.equal(s.count, s.kinds.spacing + s.kinds.breakout + s.kinds.anchor);
  assert.equal(s.count, s.straps.length);
  const [e] = X.bundleExports(r, ctx);
  assert.deepEqual([e.straps, e.strap_kinds], [7, {spacing: 3, breakout: 4, anchor: 0}]);
  assert.equal(X.bundleNote(e).includes('7 straps (3 every 12 in, 4 where a cable leaves)'), true, X.bundleNote(e));
  const [row] = X.strapBomRows([e]);
  assert.equal(row.qty, 7);
  assert.equal(row.description, '3 along 1 bundle, one every 12 in; 4 where a cable joins or leaves a bundle; length and width to suit');
  // with the anchors of the rack handed in, each slot is one more, whatever passes it
  const slots = [{item: 'i4', via: 'tray', tie: 14, bundles: [], cables: ['c7', 'c14']}, {item: 'i4', via: 'tray', tie: 8, bundles: ['b1'], cables: ['c2']}];
  const [withSlots] = X.strapBomRows([e], {anchors: slots});
  assert.equal(withSlots.qty, 9);
  assert.match(withSlots.description, /; 2 at tray tie slots; length and width to suit$/);
  // a rack with no bundle and one tied cord still buys its strap
  assert.deepEqual(X.strapBomRows([], {anchors: slots.slice(0, 1)}).map(x => [x.qty, x.description]), [[1, '1 at tray tie slots; length and width to suit']]);
  assert.deepEqual(X.strapBomRows([], {anchors: []}), []);
  // strapTotals is the same sum for the rack
  assert.deepEqual(B.strapTotals(r, ctx), {spacing: 3, breakout: 4, anchor: 0, total: 7});
  // and inspect gives the kinds beside the count
  return Q.inspect(r, 'b1', {chassisOf, route: ctx.route}).then(info => {
    assert.deepEqual(info.straps, {every: {value: 12, unit: 'in'}, count: 7, kinds: {spacing: 3, breakout: 4, anchor: 0}});
  });
});
