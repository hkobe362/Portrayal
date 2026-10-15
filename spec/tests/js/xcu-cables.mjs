// spec/tests/js/xcu-cables.mjs
// THE FIBRAIN XCU10's ADAPTERS ARE COUPLERS WITH A CABLE END ON EACH FACE (P-0047),
// against the rack kit, built from the real components.json, rack.json and
// configs.json under PORTRAYAL_DIST (library/dist).
//
// The public test rack is spec/tests/fixtures/xcu-couplers/xcu-couplers.rack.json
// (not under racks/, whose files the half-unit and speed tests read whole): a
// four-post frame, an XCU10 in each of two configurations on the REAR rails
// (xcu10-51id with SC/APC holders; xcu10-21ic with a 12-port LC holder, named
// by its first major, in slot 1), and two switches with SC optics standing in
// for an OLT's PON ports (the library holds no OLT; generic/sfp-sc@1 is the
// shape of a PON line-terminal optic).
//
// Held here: each adapter of both configurations has an end on the face toward
// the aisle and one on the face into the rack, paired so a link passes through;
// a cable to each is accepted at add time, routes, and reads as one path; a
// made-up adapter, the wrong face and an adapter of the wrong family are
// refused; the far ends are offered as free ports; and the panel's solid is its
// shell, not a block to the rack's depth, so a cable reaches the inside.
//
// Run by test_xcu_cables.py, which names the build in PORTRAYAL_DIST.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as R from '../../../kit/rack/route.js';
import * as P from '../../../kit/rack/ports.js';
import * as Q from '../../../kit/rack/queries.js';
import * as S from '../../../kit/rack/solids.js';
import * as CR from '../../../kit/rack/cable-rules.js';
import {apply} from '../../../kit/rack/commands.js';
import {redirectsOf} from '../../../kit/redirects.js';
import {fibreOf, farPath} from '../../../kit/optical.js';

const DIST = process.env.PORTRAYAL_DIST;
assert.ok(DIST, 'PORTRAYAL_DIST names the build directory (library/dist)');
const ROOT = new URL('../../../', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(`${DIST}/${name}`, 'utf8'));
const components = read('components.json').components;
const comps = new Map(components.map(c => [`${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`, c]));
const compByRef = ref => (ref == null ? null : comps.get(String(ref).split(':')[0]) ?? null);
const redirects = redirectsOf(components);
const devices = read('rack.json').devices;
const slotsOf = ref => {
  if (!devices[ref]) return null;
  const c = read(`${ref}.configs.json`);
  return {default: c.default, 'pdu-class': c['pdu-class'], bays: c.bays, cages: c.cages, configs: c.configs};
};
const chassisOf = ref => devices[ref] ?? null;
const ctx = {chassisOf, slotsOf, compByRef, redirects};

const DOC = M.parseDoc(fs.readFileSync(new URL('spec/tests/fixtures/xcu-couplers/xcu-couplers.rack.json', ROOT), 'utf8'));
const FIXED = DOC.racks[0];
const BARE = {...FIXED, cables: []};
const byLabel = label => FIXED.items.find(i => i.label === label);
const [SC, LC] = [byLabel('xcu-sc'), byLabel('xcu-lc')];
const [OLT_A, OLT_B] = [byLabel('olt-a'), byLabel('olt-b')];
const SLOT = n => `drawer/module/slot-${n}/module`;
const end = (item, path, view = 'front') => ({item: item.id, path, view});
const add = (rack, a, b, extra = {}) => apply(rack, {op: 'cable.add', a, b, media: 'os2', purpose: 'uplink', ...extra}, ctx);

// ── what is in the slots ─────────────────────────────────────────────────
// [{slot, ref, comp}] for each slot of a config, as the item seats it
function holders(item) {
  const env = P.shownEnv(item, slotsOf(item.ref), compByRef, redirects);
  return [1, 2, 3, 4].map(n => {
    const slot = `drawer/module/slot-${n}`;
    const ref = String(item.swaps?.[`drawer/module/slot-${n}`] ?? env.built(slot)).split(':')[0];
    const followed = redirects.follow(ref);
    return {slot, ref: followed, comp: compByRef(followed)};
  });
}

test('the fixture is the rack the brief names: a four-post frame, an XCU of each config on the rear rails', () => {
  assert.equal(FIXED.frame.kind, 'four-post');
  assert.deepEqual([SC, LC].map(i => [i.ref, i.cfg, i.face]), [['xcu', 'xcu10-51id', 'rear'], ['xcu', 'xcu10-21ic', 'rear']]);
  assert.deepEqual([OLT_A, OLT_B].map(i => i.swaps['port-1']), ['generic/sfp-sc@1', 'generic/sfp-sc@1']);
  assert.equal(compByRef('generic/sfp-sc@1').class, 'transceiver');
});

for (const item of [SC, LC]) {
  test(`${item.cfg}: every adapter of every holder has an end on each face, and the two are one sleeve`, () => {
    let pairs = 0;
    for (const {slot, ref, comp} of holders(item)) {
      assert.equal(comp?.class, 'adapter-panel', `${slot} holds ${ref}`);
      const rear = compByRef(String(comp.faces.rear?.ref ?? comp.faces.rear).split(':')[0]);
      assert.ok(rear?.parts?.length, `${ref} has a rear face with adapters`);
      const ends = comp.optical.ends;
      for (const [endpoint, e] of Object.entries(ends)) {
        if (endpoint.startsWith('rear:')) continue;
        const [, part, n] = endpoint.match(/^(.+)\.(\d+)$/);
        const far = String(e.to).match(/^rear:(.+)\.(\d+)$/);
        assert.ok(far, `${ref} ${endpoint} goes to a rear end`);
        // the end toward the aisle: a port on the front panel
        const front = P.seatedPort(item, end(item, `${slot}/module/${part}`), ctx);
        assert.equal(front?.port, true, `${slot} ${part}`);
        assert.equal(front.back, false);
        assert.equal(front.onView, 'front');
        // the end into the rack: a port on the rear panel, the back of the same holder
        const back = P.seatedPort(item, end(item, `${slot}/module/${far[1]}`, 'rear'), ctx);
        assert.equal(back?.port, true, `${slot} ${far[1]}`);
        assert.equal(back.back, true);
        assert.equal(back.onView, 'rear');
        assert.equal(front.holder.ref, back.holder.ref);
        // and the pairing is mutual: the rear end goes back to this front end
        assert.equal(ends[`rear:${far[1]}.${far[2]}`]?.to, endpoint, `${ref} ${far[1]}.${far[2]} pairs back`);
        pairs++;
      }
    }
    assert.ok(pairs >= (item.cfg === 'xcu10-51id' ? 48 : 24), `${pairs} adapters`);
  });
}

test('the far ends are not on the aisle face, and the near ends are not on the inner one', () => {
  assert.notEqual(P.seatedPort(SC, end(SC, `${SLOT(1)}/b01`), ctx)?.port, true, 'b01 is not on the front');
  assert.notEqual(P.seatedPort(SC, end(SC, `${SLOT(1)}/sc01`, 'rear'), ctx)?.port, true, 'sc01 is not on the rear');
});

// ── a cable to each end of the same adapter ──────────────────────────────
const X = {};
const rc = {chassisOf, guidesOf: () => [], bendOf: () => 1e12, portX: e => X[`${e.item}|${e.view}|${e.path}`] ?? 0};

test('a cable to the outer end and one to the inner end of the same adapter are both accepted', () => {
  const outer = add(BARE, end(OLT_A, 'port-1'), end(SC, `${SLOT(1)}/sc01`));
  assert.equal(outer.error, undefined);
  const both = add(outer.rack, end(OLT_B, 'port-1'), end(SC, `${SLOT(1)}/b01`, 'rear'));
  assert.equal(both.error, undefined);
  assert.equal(both.rack.cables.length, 2);
  // a dry run runs the same code
  const dry = apply(both.rack, {op: 'cable.add', a: end(OLT_A, 'port-2'), b: end(SC, `${SLOT(1)}/sc02`, 'front'), media: 'os2'}, ctx);
  assert.equal(dry.error, undefined);
  // and the LC config, with the holder named by its first major
  const lc = add(add(BARE, end(OLT_A, 'port-2'), end(LC, `${SLOT(1)}/lc01`)).rack, end(OLT_B, 'port-2'), end(LC, `${SLOT(1)}/b01`, 'rear'));
  assert.equal(lc.error, undefined);
});

test('each end lands as a fibre port, the inner one on the back of the holder', () => {
  const page = {facts: {item: true, drawing: true, port: false, cage: false, occupied: false, holder: null}, info: null, reason: 'no port'};
  for (const [item, outer, inner] of [[SC, 'sc01', 'b01'], [LC, 'lc01', 'b01']]) {
    const near = P.settleEnd(FIXED, end(item, `${SLOT(1)}/${outer}`), page, ctx);
    const far = P.settleEnd(FIXED, end(item, `${SLOT(1)}/${inner}`, 'rear'), page, ctx);
    assert.equal(near.facts.port, true, outer);
    assert.equal(far.facts.port, true, inner);
    assert.equal(far.facts.back, true);
    assert.equal(near.info.family, 'fiber');
    assert.equal(far.info.family, 'fiber');
    assert.equal(far.reason, null);
  }
});

test('the fixture rack\'s four cables settle with no loose end, and each routes', () => {
  const ends = P.settleEnds(FIXED, new Map(), ctx);
  // (the switches' cages are the page's to read; the catalogue answers for the four ends on the panels)
  assert.equal(ends.size, 4);
  for (const c of FIXED.cables) for (const e of [c.a, c.b].filter(x => x.item === SC.id || x.item === LC.id)) {
    const got = ends.get(CR.endKey(e));
    assert.ok(got, `${c.id} ${e.path} is answered for`);
    assert.equal(got.reason ?? null, null, `${c.id} ${e.path}: ${got.reason}`);
    assert.equal(got.facts.port, true, `${c.id} ${e.path}`);
  }
  for (const c of FIXED.cables) {
    const route = R.autoRoute(FIXED, c, rc);
    assert.ok(Array.isArray(route), `${c.id} has a route`);
    const path = R.routePath({...FIXED, cables: FIXED.cables.map(x => (x.id === c.id ? {...x, route} : x))}, {...c, route}, rc);
    assert.ok(path.points?.length >= 2, `${c.id} has a path`);
    assert.ok(R.pathLength(path).measured > 0, `${c.id} measures ${R.pathLength(path).measured}`);
    assert.deepEqual(path.crossings ?? [], [], `${c.id} crosses nothing`);
  }
});

test('the two cables on one adapter read as one path through the panel', () => {
  // the explorer's reading of a path: front sc01.1 goes to the rear end b01.1 of the same module
  const entry = compByRef(holders(SC)[0].ref);
  const front = fibreOf(`${SLOT(1)}/sc01/1`, entry, compByRef);
  assert.ok(front, 'the front end is a fibre of the holder');
  assert.equal(front.module, SLOT(1));
  assert.equal(farPath(front.module, entry, front.endpoint), `${SLOT(1)}/b01/1`);
  const back = fibreOf(`${SLOT(1)}/b01/1`, entry, compByRef);
  assert.equal(back.endpoint, 'rear:b01.1');
  assert.equal(farPath(back.module, entry, back.endpoint), `${SLOT(1)}/sc01/1`);
  // the rack holds the two cables on those two ends, and nothing else on either
  const onSleeve = FIXED.cables.filter(c => [c.a, c.b].some(e => e.item === SC.id && /\/(sc01|b01)$/.test(e.path)));
  assert.deepEqual(onSleeve.map(c => c.id).sort(), ['c1', 'c2']);
  assert.deepEqual(onSleeve.flatMap(c => [c.a, c.b]).filter(e => e.item === SC.id).map(e => `${e.path.split('/').pop()}:${e.view}`).sort(),
                   ['b01:rear', 'sc01:front']);
  // a second cable on an end already cabled is refused by the rack
  const twice = add(FIXED, end(OLT_A, 'port-2'), end(SC, `${SLOT(1)}/b01`, 'rear'));
  assert.match(twice.error ?? '', /already|in use|has a cable/i);
});

// ── what is refused ──────────────────────────────────────────────────────
test('a made-up adapter, the wrong face and the wrong family are refused when the cable is added', () => {
  const refused = [
    [SC, `${SLOT(1)}/sc99`, 'front', /has no port sc99/],
    [SC, `${SLOT(1)}/b99`, 'rear', /has no port b99/],
    [SC, `${SLOT(1)}/b01`, 'front', /whose port b01 is on the rear panel; give view "rear"/],
    [SC, `${SLOT(1)}/sc01`, 'rear', /whose port sc01 is on the front panel; give view "front"/],
    [SC, `${SLOT(1)}/lc01`, 'front', /has no port lc01/],
    [LC, `${SLOT(2)}/lc07`, 'front', /has no port lc07/],
  ];
  for (const [item, path, view, why] of refused) {
    const got = add(BARE, end(OLT_A, 'port-1'), end(item, path, view));
    assert.match(got.error ?? '', why, `${path} ${view}`);
    assert.equal(got.rack, undefined);
  }
  // the 12-port LC holder in slot 1 has a lc12; a 6-port holder in slot 2 has no lc07
  assert.equal(add(BARE, end(OLT_A, 'port-1'), end(LC, `${SLOT(1)}/lc12`)).error, undefined);
});

test('cable.update refuses the same, and an end moved onto the inner face is accepted', () => {
  const base = add(BARE, end(OLT_A, 'port-1'), end(SC, `${SLOT(1)}/sc01`)).rack;
  const id = base.cables[0].id;
  assert.match(apply(base, {op: 'cable.update', id, b: end(SC, `${SLOT(1)}/b99`, 'rear')}, ctx).error ?? '', /has no port b99/);
  const moved = apply(base, {op: 'cable.update', id, b: end(SC, `${SLOT(1)}/b01`, 'rear')}, ctx);
  assert.equal(moved.error, undefined);
  assert.equal(moved.rack.cables[0].b.view, 'rear');
});

test('a bay of the drawer that holds a blind cover offers no port, and is not refused as made up', () => {
  const bare = {...BARE, items: BARE.items.map(i => (i.id === SC.id ? {...i, cfg: 'base'} : i))};
  const got = add(bare, end(OLT_A, 'port-1'), end(bare.items.find(i => i.id === SC.id), `${SLOT(1)}/sc01`));
  // the catalogue does not answer for it, so the end is kept as given and the page's drawing decides
  assert.equal(got.error, undefined);
});

// ── the free ports ───────────────────────────────────────────────────────
test('the free ports of an XCU offer the inner face of every adapter, with its view', async () => {
  const portsOf = async () => [];
  for (const [item, n] of [[SC, 48], [LC, 24 + 12 - 6]]) {
    const free = await Q.freePorts(BARE, item.id, {...ctx, portsOf});
    const rear = free.filter(p => p.view === 'rear');
    assert.ok(rear.length >= n - 12 && rear.every(p => /\/module\/b\d+$/.test(p.path)), `${item.cfg}: ${rear.length} inner ends`);
    if (item === SC) assert.equal(rear.length, 48);
    assert.ok(rear.some(p => p.path === `${SLOT(1)}/b01`));
  }
  // one that has a cable is not offered
  const cabled = add(BARE, end(OLT_A, 'port-1'), end(SC, `${SLOT(1)}/b01`, 'rear')).rack;
  const free = await Q.freePorts(cabled, SC.id, {...ctx, portsOf});
  assert.ok(!free.some(p => p.path === `${SLOT(1)}/b01` && p.view === 'rear'));
  assert.equal(free.filter(p => p.view === 'rear').length, 47);
});

// ── the body ─────────────────────────────────────────────────────────────
test('the panel\'s solid is its shell: a top, a floor and two sides, not a block to 284 mm', () => {
  const xcu = devices.xcu;
  assert.equal(xcu.shell, 'sheet');
  assert.ok(Array.isArray(xcu.solids) && xcu.solids.length === 4, JSON.stringify(xcu.solids?.map(s => s.part)));
  assert.deepEqual(xcu.solids.map(s => s.part).sort(), ['interior/floor', 'shell-top/cover', 'side-left/wall', 'side-right/wall']);
  const volume = xcu.solids.reduce((v, s) => v + s.box.w * s.box.h * s.box.d, 0);
  const envelope = xcu.w * xcu.h * xcu.d;
  assert.ok(volume < envelope * 0.2, `${(100 * volume / envelope).toFixed(1)}% of the envelope`);
  // nothing across the back or the front: every plate is a sheet laid along the depth
  assert.ok(!xcu.solids.some(s => s.box.w > 100 && s.box.h > 10), 'no plate stands across the rear or the front');
  assert.ok(xcu.solids.every(s => s.box.d >= 283), 'each plate runs the depth of the well');
});

test('a point inside the shell behind the holders is reachable from behind, and from the front side it is not', () => {
  const solids = S.solidsOf(BARE, ctx).filter(s => s.item === SC.id);
  assert.equal(solids.length, 4);
  const xs = solids.flatMap(s => [s.box.x0, s.box.x1]), zs = solids.flatMap(s => [s.box.z0, s.box.z1]);
  const mid = {x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (solids.find(s => s.part === 'interior/floor').box.y1 + solids.find(s => s.part === 'shell-top/cover').box.y0) / 2};
  // the shell runs from the rail plane toward the rear of the rack; its open end is the one away from the front panel
  const rear = Math.min(...zs), front = Math.max(...zs);
  const farEnd = {...mid, z: rear - 60}, inside = {...mid, z: (rear + front) / 2};
  assert.deepEqual(S.legCrossings(farEnd, inside, solids, {diameter: 3}), [], 'from the open end into the shell');
  const above = {...mid, y: mid.y + 40}, below = {...mid, y: mid.y - 40};
  assert.ok(S.legCrossings(above, inside, solids, {diameter: 3}).length > 0, 'from above it crosses the top sheet');
  assert.ok(S.legCrossings(below, inside, solids, {diameter: 3}).length > 0, 'from below it crosses the floor');
  // the same point against the envelope the panel had: a block
  const block = [{item: SC.id, part: 'envelope', box: {x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...solids.map(s => s.box.y0)), y1: Math.max(...solids.map(s => s.box.y1)), z0: rear, z1: front}, holes: []}];
  assert.ok(S.legCrossings(farEnd, inside, block, {diameter: 3}).length > 0, 'a block is crossed');
});

test('a cable to the inner end of an adapter does not cross the panel', () => {
  const res = add(BARE, end(OLT_B, 'port-1'), end(SC, `${SLOT(1)}/b01`, 'rear'));
  const rack = res.rack;
  const findings = R.bodyFindings(rack, rc).filter(f => f.item === SC.id);
  assert.deepEqual(findings.map(f => f.text), []);
});
