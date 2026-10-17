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
import * as HOPS from './bundle-hops-fixture.mjs';

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

test('a strap before each leaving point: one in a short gap, two in a long one, none where no strap fits', () => {
  // ducts at 0, 300, 360, 430 and 900 mm along the trunk
  const xs = [-450, -150, -90, -20, 450];
  // c3 leaves at 300 and c4 at 360, 60 mm on: a strap before each (275, and 335 in the gap), and one after the last
  const two = along(xs, [null, null, 'guide-2', 'guide-3'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(two, xs), 'breakout'), [25, 275, 335, 385, 875]);
  // c3 at 300, c4 at 360, c5 at 430: one in each gap, 25 mm before the cable that leaves at its end
  const three = along(xs, [null, null, 'guide-2', 'guide-3', 'guide-4'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(three, xs), 'breakout'), [25, 275, 335, 405, 455, 875]);
  // read from the other end the straps are the same: the trunk reversed, the same members
  const back = {...three, bundles: [{...three.bundles[0], route: [...ALONG].reverse()}]};
  assert.deepEqual(at(got(back, xs), 'breakout').map(a => 900 - a).sort((p, q) => p - q), [25, 275, 335, 405, 455, 875]);
  // PEELS AT 0, 30 AND 60 MM (from the first of them, at 300): 25 mm before the next peel would leave a 19 mm
  // strap under its clearance of the last, so each gap takes one in its middle
  const close = [-450, -150, -120, -90, 450];
  const s30 = got(along(close, [null, null, 'guide-2', 'guide-3', 'guide-4'], ONLY_BREAKOUT), close);
  assert.deepEqual(s30.straps.map(x => [x.along_mm, x.width_mm]), [[25, 19], [275, 19], [315, 19], [345, 19], [385, 19], [875, 19]]);
  // 25 mm apart a 19 mm strap does not fit with 5 mm each side, and the narrow one does
  const tight = [-450, -150, -125, -100, 450];
  const s25 = got(along(tight, [null, null, 'guide-2', 'guide-3', 'guide-4'], ONLY_BREAKOUT), tight);
  assert.deepEqual(s25.straps.map(x => [x.along_mm, x.width_mm]), [[25, 19], [275, 19], [312.5, 12], [337.5, 12], [375, 19], [875, 19]]);
  assert.deepEqual(s25.widths, {19: 4, 12: 2});
  // 20 mm apart no strap fits between (the narrowest and its clearance take 22): the three are one group, chained
  const group = [-450, -150, -130, -110, 450];
  assert.equal(B.BREAKOUT_GROUP_MM, 22);
  assert.deepEqual(at(got(along(group, [null, null, 'guide-2', 'guide-3', 'guide-4'], ONLY_BREAKOUT), group), 'breakout'), [25, 275, 365, 875]);
  // 76 mm apart they are two groups, each strapped on both sides
  const wide = [-450, -150, -74, 100, 450];
  assert.deepEqual(at(got(along(wide, [null, null, 'guide-2', 'guide-3'], ONLY_BREAKOUT), wide), 'breakout'), [25, 275, 325, 351, 401, 875]);
  // the gap at the end of the trunk is a gap like any other: the trunk ends 40 mm after the last peel, and a
  // strap fits in that, 25 mm before the end
  const tail = [-450, -150, 0, 410, 450];
  const short = along(tail, [null, null, 'guide-4', 'guide-4'], ONLY_BREAKOUT);
  assert.deepEqual(at(got(short, tail), 'breakout'), [25, 835, 875], 'before the peel at 860, and one in the 40 mm after it');
  // where none fits there is none: 20 mm after the last peel is less than the narrowest strap and its clearance
  const stub = [-450, -150, 0, 430, 450];
  assert.deepEqual(at(got(along(stub, [null, null, 'guide-4', 'guide-4'], ONLY_BREAKOUT), stub), 'breakout'), [25, 855]);
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
  assert.deepEqual(B.anchorsOf(r, {route: F.ctxOf(r)}).find(x => x.tie === 8), {item: 'i4', via: 'tray', tie: 8, width_mm: 19, bundles: ['b1'], cables: []});
  assert.equal(a.width_mm, 19);
});

test('a single cable is anchored too: each tie slot it uses on the held face, and the nearest on the resting face', () => {
  const r = onTray(1);
  const ctx = {route: F.ctxOf(r)};
  // on the resting face: one strap, at the slot nearest the middle of its stretch on the tray
  const rest = B.anchorsOf({...r, cables: [r.cables[0]]}, ctx);
  assert.deepEqual(rest, [{item: 'i4', via: 'tray', tie: 10, width_mm: 19, bundles: [], cables: ['c1']}]);
  // on the held face: one a tie slot it uses, as the cable lay note counts
  const held = {route: {...F.ctxOf(r), trayFaceOf: (cable, w) => (w.via === 'tray' ? 'underside' : null)}};
  assert.deepEqual(B.anchorsOf({...r, cables: [r.cables[0]]}, held).map(x => [x.tie, x.cables]), [[4, ['c1']], [5, ['c1']], [8, ['c1']], [9, ['c1']]]);
  // straps: {anchors: false} on the cable turns its own off
  assert.deepEqual(B.anchorsOf({...r, cables: [{...r.cables[0], straps: {anchors: false}}]}, ctx), []);
  // ONE STRAP AT A SLOT SERVES EVERY CABLE THERE: the count is by slot, never by cable.
  // On the reference rack three cords come to rest on the tray, at one slot
  // (two until c8 took ring 4, #987).
  const owner = F.rack();
  const all = B.anchorsOf(owner, {route: F.ctxOf(owner)});
  assert.deepEqual(all, [{item: 'i4', via: 'tray', tie: 14, width_mm: 19, bundles: [], cables: ['c7', 'c8', 'c14']}]);
  assert.deepEqual(B.strapTotals(owner, {route: F.ctxOf(owner)}), {spacing: 0, breakout: 0, anchor: 1, total: 1, widths: {19: 1}});
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
  assert.equal(row.description, '3 along 1 bundle, one every 12 in; 4 where a cable joins or leaves a bundle; 7 of 19 mm wide; length to suit');
  assert.deepEqual([e.strap_widths, e.anchor_widths], [{19: 7}, {}]);
  // with the anchors of the rack handed in, each slot is one more, whatever passes it
  const slots = [{item: 'i4', via: 'tray', tie: 14, width_mm: 19, bundles: [], cables: ['c7', 'c14']}, {item: 'i4', via: 'tray', tie: 8, width_mm: 25, bundles: ['b1'], cables: ['c2']}];
  const [withSlots] = X.strapBomRows([e], {anchors: slots});
  assert.equal(withSlots.qty, 9);
  assert.match(withSlots.description, /; 2 at tray tie slots; 1 of 25 mm, 8 of 19 mm wide; length to suit$/);
  // a rack with no bundle and one tied cord still buys its strap
  assert.deepEqual(X.strapBomRows([], {anchors: slots.slice(0, 1)}).map(x => [x.qty, x.description]), [[1, '1 at tray tie slots; 1 of 19 mm wide; length to suit']]);
  assert.deepEqual(X.strapBomRows([], {anchors: []}), []);
  // strapTotals is the same sum for the rack
  assert.deepEqual(B.strapTotals(r, ctx), {spacing: 3, breakout: 4, anchor: 0, total: 7, widths: {19: 7}});
  // and inspect gives the kinds beside the count
  return Q.inspect(r, 'b1', {chassisOf, route: ctx.route}).then(info => {
    assert.deepEqual(info.straps, {every: {value: 12, unit: 'in'}, count: 7, kinds: {spacing: 3, breakout: 4, anchor: 0}});
  });
});

// ── close pitch (decided 2026-10-11) ─────────────────────────────────────

test('eleven cables down one lane, joining a unit apart: every cable has a strap before it leaves', () => {
  // twelve switches at U31 to U42, a cord from each of the lower eleven up the left-front lane to the top one:
  // the peel points are 44.45 mm apart. With the grouping of before (75 mm) the whole trunk was one group and
  // had no breakout strap at all.
  const only = r => ({...r, bundles: [{...r.bundles[0], straps: ONLY_BREAKOUT}]});
  const count = (r, pick = () => true) => {
    const b = {...r.bundles[0], members: r.bundles[0].members.filter((m, k) => pick(k))};
    const s = B.straps({...r, bundles: [b]}, b, {route: HOPS.ctxFor(r)});
    return [s.kinds.breakout, s.straps.map(x => x.along_mm), s.widths];
  };
  const [n, where, widths] = count(only(HOPS.bundled()));
  // one in each of the ten gaps of one unit where two or more ride, 25 mm before the cable that joins at its
  // upper end, the gap under the top switch where all eleven ride among them; the first gap of the lane holds
  // one cable alone
  assert.equal(n, 10);
  assert.deepEqual(widths, {19: 10});
  // a unit apart; the one in the top gap is in its middle, since cables peel at both of its ends
  assert.ok(where.slice(0, -1).every((a, k) => !k || Math.abs(a - where[k - 1] - 44.45) < 0.11), JSON.stringify(where));
  assert.ok(where.at(-1) - where.at(-2) > 22 && where.at(-1) - where.at(-2) < 67, JSON.stringify(where));
  // written end for end, the same straps
  assert.deepEqual(count(only(HOPS.bundled({flip: true}))), [n, where, widths]);
  // every second and every third cable, so the peels are two and three units apart: one each side of each,
  // and one in the gap under the top switch, which is one unit whatever the pitch
  assert.equal(count(only(HOPS.bundled()), k => k % 2 === 0)[0], 9);
  assert.equal(count(only(HOPS.bundled()), k => k % 3 === 0)[0], 5);
  // with its default spacing straps too: a spacing strap already in a gap serves it
  const [withSpacing, , w2] = count(HOPS.bundled());
  // eight, and the two spacing straps serve the other two gaps: all ten gaps have a strap
  assert.equal(withSpacing, 8);
  assert.deepEqual(w2, {19: 10});
  // and every: null is still strapless
  const none = HOPS.bundled();
  const s0 = B.straps({...none, bundles: [{...none.bundles[0], straps: {every: null}}]}, {...none.bundles[0], straps: {every: null}}, {route: HOPS.ctxFor(none)});
  assert.deepEqual([s0.count, s0.widths], [0, {}]);
});

test('a strap carries its width: the base one, the wide one for a thick pack, each from the stock list', () => {
  assert.deepEqual(B.STRAP_WIDTHS_MM, [12, 19, 25]);
  const xs = [-450, -150, -90, -20, 450];
  const thin = got(along(xs, [null, null, 'guide-3'], {every: {value: 300, unit: 'mm'}}), xs);
  assert.ok(thin.straps.every(x => x.width_mm === 19), JSON.stringify(thin.widths));
  // twenty Cat 6 cords are a pack 30 mm across (6 mm each, packed to 0.8): 25 mm straps
  const many = along(xs, Array(20).fill(null), {every: {value: 300, unit: 'mm'}});
  const thick = got(many, xs);
  assert.ok(thick.straps.length >= 3 && thick.straps.every(x => x.width_mm === 25), JSON.stringify(thick.widths));
  assert.ok(B.bundleDiameter(Array(20).fill(6)) >= B.WIDE_PACK_MM && B.bundleDiameter(Array(3).fill(6)) < B.WIDE_PACK_MM);
  assert.ok([...thin.straps, ...thick.straps].every(x => B.STRAP_WIDTHS_MM.includes(x.width_mm)));
});

test('what a bundle now has is said truly, and a straps key that cannot be read is dropped with a notice', () => {
  const xs = [-450, -150, -90, -20, 450];
  const r = along(xs, [null, null]);
  const said = straps => run(r, {op: 'bundle.update', id: 'b1', straps}).summary;
  assert.equal(said({every: null}), 'Bundle 1 now has no straps.');
  // no spacing straps and breakout straps: "no straps, breakout straps" would not be true
  assert.equal(said({every: null, breakout: true}), 'Bundle 1 now has no spacing straps, breakout straps.');
  assert.equal(said({every: null, breakout: true, anchors: true}), 'Bundle 1 now has no spacing straps, breakout straps, anchor straps.');
  assert.equal(said({anchors: false}), 'Bundle 1 now has straps every 12 in, no anchor straps.');
  // on load
  const doc = straps => ({format: 'portrayal-rack', version: 4, id: 'd', racks: [{...r, name: 'R', bundles: [{...r.bundles[0], label: 'MGMT', straps}]}]});
  const read = straps => { const notes = []; const b = M.parseDoc(doc(straps), {notes}).racks[0].bundles[0]; return [b.straps, notes]; };
  assert.deepEqual(read({every: {value: 12, unit: 'cm'}, breakout: false}), [{breakout: false}, ['R: MGMT had every that could not be read, so it was dropped.']]);
  assert.deepEqual(read({every: 'often', anchors: 'yes'}), [undefined, ['R: MGMT had every, anchors that could not be read, so they were dropped.']]);
  assert.deepEqual(read('tight'), [undefined, ['R: MGMT had straps that could not be read, so it was dropped.']]);
  assert.deepEqual(read({every: null, breakout: true, note: 'kept'}), [{every: null, breakout: true, note: 'kept'}, []]);
});

test('the schedule names the tray, the face by role and by name, and the tie slots of a single cable', () => {
  assert.deepEqual(X.CABLE_COLUMNS.slice(-5), ['status', 'notes', 'spare', 'stored', 'straps']);
  assert.equal(X.CABLE_COLUMNS.length, 20);
  const r = onTray(1);
  const pin = face => ({route: {...F.ctxOf(r), trayFaceOf: (cable, w) => (w.via === 'tray' ? face : null)}});
  // on the resting face: the one slot nearest the middle of its stretch, counted from 1
  assert.deepEqual([...B.strapTexts(r, {route: F.ctxOf(r)})].filter(([id]) => id === 'c1'), [['c1', 'CM-01 tray, resting face (top), tie 11']]);
  // on the held face: every slot it uses; they are not one run here, so each is named
  assert.equal(B.strapTexts(r, pin('underside')).get('c1'), 'CM-01 tray, held face (underside), ties 5, 6, 9 and 10');
  // a tray turned over: the role is the same and the name of the face is the other
  const over = {...r, items: r.items.map(i => (i.id === 'i4' ? {...i, roll: 180} : i))};
  const flipped = {route: {...F.ctxOf(over), trayFaceOf: (cable, w) => (w.via === 'tray' ? 'top' : null)}};
  assert.match(B.strapTexts(over, flipped).get('c1') || '', /^CM-01 tray, held face \(top\), ties? /);
  // a run of slots reads as a run
  // (the text of a slot list is the one rule; the anchors are what it is fed)
  // straps: {anchors: false} on the cable leaves it out, as it leaves it out of the count
  assert.equal(B.strapTexts({...r, cables: [{...r.cables[0], straps: {anchors: false}}]}, pin('underside')).has('c1'), false);
  // a cable through a ring alone is strapped nowhere, and without routes nothing is known
  const owner = F.rack();
  assert.equal(B.strapTexts(owner, {route: F.ctxOf(owner)}).has('c1'), false);
  assert.equal(B.strapTexts(owner, {}).size, 0);
  // every slot the texts name is a slot the count has, and none is missed
  const slots = B.anchorsOf(owner, {route: F.ctxOf(owner)}).flatMap(x => x.cables.map(c => `${c}|${x.tie + 1}`)).sort();
  const named = [...B.strapTexts(owner, {route: F.ctxOf(owner)})].flatMap(([c, t]) => [...t.matchAll(/tie (\d+)/g)].map(m => `${c}|${m[1]}`)).sort();
  assert.deepEqual(named, slots);
  // in the file: the last cell, blank without the texts
  const rows = straps => X.cableScheduleRows(r, new Map(), r.items, null, {straps}).rows;
  assert.equal(rows(B.strapTexts(r, pin('underside')))[0].straps, 'CM-01 tray, held face (underside), ties 5, 6, 9 and 10');
  assert.deepEqual([rows(null)[0].straps, rows(new Map())[0].straps], ['', '']);
  const csv = X.toCsv(X.CABLE_COLUMNS, rows(B.strapTexts(r, pin('underside'))).slice(0, 1));
  assert.match(csv.split('\r\n')[0], /,status,notes,spare,stored,straps$/);
  assert.match(csv.split('\r\n')[1], /,"CM-01 tray, held face \(underside\), ties 5, 6, 9 and 10"$/);
});

test('an anchor strap is no wider than its tie slot is long, and a slot no strap goes through ties nothing', () => {
  const r0 = onTray();
  const r = {...r0, bundles: [{id: 'b1', number: 1, label: '', members: [{cable: 'c1'}, {cable: 'c2'}], route: [{item: 'i4', via: 'guide-4'}, TRAY]}]};
  // two cords of 20 mm are a pack over 25 mm across: its straps are the wide ones
  const fat = {route: {...F.ctxOf(r), diameterOf: () => 20}};
  const s = B.straps(r, r.bundles[0], fat);
  const [tray] = S.traysOf(r, F.ctxOf(r));
  const a = s.straps.find(x => x.kind === 'anchor');
  const long = Math.max(tray.ties[a.tie].x1 - tray.ties[a.tie].x0, tray.ties[a.tie].z1 - tray.ties[a.tie].z0);
  // the slot is 22.5 mm long, so the 25 mm strap the pack would take does not go through it: 19
  assert.deepEqual([a.tie, Math.round(long * 10) / 10, a.width_mm], [8, 22.5, 19]);
  assert.ok(s.straps.filter(x => x.kind !== 'anchor').every(x => x.width_mm === 25), 'the pack still sets the width of the others');
  assert.deepEqual(s.notes, []);
  assert.equal(B.anchorsOf(r, fat).find(x => x.tie === 8).width_mm, 19);
  // a thin pack is 19 either way
  assert.equal(B.straps(r, r.bundles[0], {route: F.ctxOf(r)}).straps.find(x => x.kind === 'anchor').width_mm, 19);
  // slots 15 mm long take the 12 mm strap; slots 10 mm long take none, and it is said
  const slots = len => ref => {
    const c = structuredClone(F.chassisOf(ref));
    const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (k === 'ties' && Array.isArray(x)) v[k] = x.map(t => ({...t, w: Math.min(t.w, len), d: Math.min(t.d, len)})); else walk(x); } };
    walk(c);
    return c;
  };
  const with_ = len => ({route: {...F.ctxOf(r), chassisOf: slots(len)}});
  assert.equal(B.straps(r, r.bundles[0], with_(15)).straps.find(x => x.kind === 'anchor').width_mm, 12);
  const none = B.straps(r, r.bundles[0], with_(10));
  assert.equal(none.kinds.anchor, 0);
  assert.equal(none.notes.length, 1);
  assert.match(none.notes[0], /^Bundle 1 is not tied at CM-01 tray: tie slot \d+ is 10 mm long, and the narrowest strap is 12 mm wide\.$/);
  assert.ok(X.bundleExports(r, with_(10))[0].notes.includes(none.notes[0]), 'and the exports carry the sentence');
  // a single cable is held to the same rule
  const lone = {...r0, cables: [r0.cables[0]]};
  assert.deepEqual(B.anchorsOf(lone, with_(15)).map(x => x.width_mm), [12]);
  assert.deepEqual(B.anchorsOf(lone, with_(10)), []);
});

test('the BOM counts each strap once by width: a bundle anchor is not counted with the slots again', () => {
  const r0 = onTray();
  const r = {...r0, bundles: [{id: 'b1', number: 1, label: '', members: [{cable: 'c1'}, {cable: 'c2'}], route: [{item: 'i4', via: 'guide-4'}, TRAY]}]};
  const ctx = {route: F.ctxOf(r)};
  const bundles = X.bundleExports(r, ctx), anchors = B.anchorsOf(r, ctx);
  assert.ok(bundles[0].strap_kinds.anchor === 1 && anchors.some(x => x.bundles.includes('b1')) && anchors.some(x => !x.bundles.length),
    'the rack has a bundle anchor and a slot of single cables');
  const widthSum = row => [...row.description.matchAll(/(\d+) of \d+ mm/g)].reduce((n, m) => n + Number(m[1]), 0);
  const [row] = X.strapBomRows(bundles, {anchors});
  assert.equal(widthSum(row), row.qty, row.description);
  assert.equal(row.qty, bundles[0].strap_kinds.spacing + bundles[0].strap_kinds.breakout + anchors.length);
  const t = B.strapTotals(r, ctx);
  assert.equal(Object.values(t.widths).reduce((a, b) => a + b, 0), t.total);
  assert.equal(t.total, row.qty);
  // without the slots, the bundle's own anchor is the one counted
  const [own] = X.strapBomRows(bundles);
  assert.equal(widthSum(own), own.qty);
});

test('a bundle with fewer than two members riding its trunk has no straps, and the count, the sentence and the BOM agree (#1021)', () => {
  const xs = [-450, -150, 0, 200, 450];
  const r = along(xs, [null, null, null]);
  const ctx = {route: routeCtx(r, xs)};
  // a member is loose when the device at one of its ends is gone and the cable is kept
  const looseFrom = ids => ({...r, cables: r.cables.map(c => (ids.includes(c.id) ? {...c, a: {...c.a, item: 'i99'}} : c))});
  const readBack = rack => ({st: B.straps(rack, rack.bundles[0], ctx), totals: B.strapTotals(rack, ctx), ex: X.bundleExports(rack, ctx)[0]});
  const whole = readBack(r);
  assert.ok(whole.st.count > 0 && whole.totals.total > 0, 'a bundle of three that ride has straps');
  // one loose of three: the other two still ride together, and are strapped
  assert.equal(readBack(looseFrom(['c3'])).st.count, whole.st.count);
  // two loose of three, and all three: fewer than two ride
  for (const ids of [['c2', 'c3'], ['c1', 'c2', 'c3']]) {
    const {st, totals, ex} = readBack(looseFrom(ids));
    assert.deepEqual([st.count, st.kinds, st.straps, st.runs], [0, {spacing: 0, breakout: 0, anchor: 0}, [], []], ids.join());
    assert.equal(totals.total, 0);
    assert.equal(ex.straps, 0);
    assert.ok(!X.bundleNote(ex).includes('2 straps') && /, 0 straps|no straps/.test(X.bundleNote(ex)), X.bundleNote(ex));
    assert.deepEqual(X.strapBomRows([ex]), []);
  }
});

test('describe says a longer trunk with fewer than two riders has no strap, and not "straps every 12 in" (#1021)', () => {
  const xs = [-450, -150, 0, 200, 450];
  const r = along(xs, [null, null, null]);
  const ctx = {chassisOf, route: routeCtx(r, xs)};
  const looseFrom = ids => ({...r, cables: r.cables.map(c => (ids.includes(c.id) ? {...c, a: {...c.a, item: 'i99'}} : c))});
  const line = rack => Q.describe(rack, ctx).split('\n').find(l => l.startsWith('b1 '));
  assert.match(line(r), /straps every 12 in/);
  assert.match(line(looseFrom(['c3'])), /straps every 12 in/);
  for (const ids of [['c2', 'c3'], ['c1', 'c2', 'c3']]) {
    const text = line(looseFrom(ids));
    assert.match(text, /no strap, since fewer than two cables ride it/, text);
    assert.doesNotMatch(text, /straps every/, text);
  }
});

