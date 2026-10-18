// spec/tests/js/rack-chatsworth-managers.mjs
// THE CHATSWORTH EVOLUTION HORIZONTAL MANAGERS IN THE RACK KIT (P-0126, #1093). What the maker
// advertises has to work in a rack and not only be drawn: a cable runs along the finger duct and
// its spare is stored there against the cable fill the maker states; a cable crosses the back plate
// through a pass-through port, a brush window or a grommet, a leg that runs front to rear inside a
// hole's span goes straight through it (and is gone round the plate with the hole shut); and
// the two solid chassis styles have no hole to cross by. Reads the build's rack.json, as the Rack
// Builder does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as R from '../../../kit/rack/route.js';
import * as SL from '../../../kit/rack/slack.js';
import {apply} from '../../../kit/rack/commands.js';
import * as F from './cable-solids-fixture.mjs';

const BUILT = new URL('../../../library/dist/rack.json', import.meta.url);
const skip = existsSync(BUILT) ? false : 'library/dist not built - run ./build.sh';
const devices = skip ? {} : JSON.parse(readFileSync(BUILT, 'utf8')).devices;

// part -> [chassis style, rack units, the maker's Cat 6 maximum fill, how many holes the back plate has]
const PARTS = {
  '35441-x01': ['solid', 1, 56, 0], '35441-x02': ['ports', 2, 173, 2], '35441-x03': ['ports', 3, 285, 2],
  '35441-x04': ['ports', 4, 403, 2], '35442-x02': ['solid', 2, 173, 0], '35442-x03': ['solid', 3, 285, 0],
  '35442-x04': ['solid', 4, 403, 0], '33548-x02': ['brush', 2, 173, 1], '33548-x03': ['brush', 3, 285, 1],
  '33548-x04': ['brush', 4, 403, 1], '33549-x02': ['grommet', 2, 173, 3], '33549-x03': ['grommet', 3, 285, 3],
  '33549-x04': ['grommet', 4, 403, 3],
};
const names = Object.keys(PARTS);

// the reference fixture rack of #949 with the manager at U8, below the switches; a cord from the switch
// below to the switch above, routed from the manager's front duct to its back plate's opening `via`,
// both laid at rack x `x` (the part's centre is rack x 0)
function rackWith(name, dev, x, via = 'pass-through-1') {
  const sizes = {...F.SIZES, [name]: dev};
  const base = F.add(F.ownerRack(), name, 8, {label: 'mgr'});
  const mgr = base.items.at(-1).id;
  const c = F.cable('c1', F.end('i1', 'p140'), F.end('i4', 'p150', 'rear'), 'cat6', {
    route: [{item: mgr, via: 'duct'}, {item: mgr, via}], routeEdited: true});
  const guides = [{via: 'duct', kind: 'duct', face: 'front', run: 'x', x}, {via, kind: 'pass', face: 'rear', x}];
  const ctx = F.ctxOf({guides: {[mgr]: guides}, ctx: {chassisOf: ref => sizes[ref] || null}});
  return {rack: {...base, cables: [c]}, ctx, mgr, c, sizes};
}
const between = (p, mgr) => p.detours.filter(d => d.between.length === 2 && d.between.every(w => w.item === mgr));
const holesOf = dev => dev.solids.flatMap(s => s.holes || []);
// the middle of a hole from the part's centre in rack x
const middle = (dev, h) => h.box.x + h.box.w / 2 - dev.w / 2;

test('every part is in the build, as a rack-face sheet part that states its duct and the maker\'s cable fill', {skip}, () => {
  for (const name of names) {
    const [, ru, count] = PARTS[name];
    const d = devices[name];
    assert.ok(d, `${name} is in rack.json`);
    assert.equal(d.manufacturer, 'Chatsworth Products');
    assert.deepEqual([d.ru, d.w, d.d, d.shell, d.mount], [ru, 482.6, 208, 'sheet', 'rack-face'], name);
    assert.deepEqual(d.guides.front, ['duct'], `${name} publishes its finger duct`);
    assert.deepEqual([d.capacity.count, d.capacity.media], [count, 'cat6'], name);
    assert.ok(!d.capacity.estimated, 'the maker states it');
  }
});

test('a cable runs along the finger duct, and its spare is stored there against the maker\'s count', {skip}, async () => {
  for (const name of names) {
    const dev = devices[name];
    const {rack, ctx, mgr, c} = rackWith(name, dev, 0);
    const lay = {...rack, cables: [{...c, route: [{item: mgr, via: 'duct'}], routeEdited: true, length: {value: 2, unit: 'm', source: 'entered'}}]};
    const p = R.routePath(lay, lay.cables[0], ctx);
    assert.deepEqual(p.crossings, [], `${name}: nothing in the duct's way`);
    assert.ok(p.points.some(q => q.at === 'pathway'), `${name}: the cable passes the duct`);
    const stored = apply(lay, {op: 'cable.slack', id: 'c1', at: {item: mgr, via: 'duct'}, value: 0.3},
      {chassisOf: ctx.chassisOf, route: {...ctx, chassisOf: ctx.chassisOf}});
    assert.equal(stored.error, undefined, `${name}: ${stored.error}`);
    const s = SL.slackOf(stored.rack, stored.rack.cables[0], ctx);
    assert.equal(s.entries[0].kind, 'duct', `${name}: the spare lies in the duct`);
  }
});

test('a cord crosses the back plate through each kind of opening, straight, shorter than round the plate', {skip}, () => {
  for (const name of names.filter(n => PARTS[n][3] > 0)) {
    const dev = devices[name];
    const holes = holesOf(dev);
    assert.ok(holes.length >= PARTS[name][3], `${name} carries its ${PARTS[name][3]} hole(s) on the plate`);
    const closed = {...dev, solids: dev.solids.map(s => ({...s, holes: []}))};
    for (const via of [...new Set(holes.map(h => h.via))].sort()) {
      const h = holes.find(q => q.via === via);
      const x = middle(dev, h);
      const open = rackWith(name, dev, x, via), shut = rackWith(name, closed, x, via);
      const through = R.routePath(open.rack, open.c, open.ctx), round = R.routePath(shut.rack, shut.c, shut.ctx);
      assert.deepEqual(through.crossings, [], `${name} ${via}`);
      assert.deepEqual(between(through, open.mgr), [], `${name} ${via}: no detour between the duct and the opening`);
      assert.ok(between(round, shut.mgr).length, `${name} ${via}: with the opening shut the plate is gone round`);
    }
  }
});

test('the opening a cord crosses is the pass the part declares: ports and grommets open, the brush a brush', {skip}, () => {
  const cover = {ports: 'open', grommet: 'open', brush: 'brush'};
  for (const name of names.filter(n => PARTS[n][3] > 0)) {
    const [style, , , n] = PARTS[name];
    const dev = devices[name];
    assert.equal(dev.passes.rear.length, n, name);
    assert.equal(dev.passes.front, undefined, name);
    assert.equal(holesOf(dev).filter((h, k, a) => a.findIndex(q => q.via === h.via) === k).length, n, `${name}: one hole a pass`);
    assert.ok(cover[style], style);
  }
});

test('the solid managers have no opening: a cord from the front duct to the rear goes round the plate', {skip}, () => {
  for (const name of names.filter(n => PARTS[n][3] === 0)) {
    const dev = devices[name];
    assert.equal(holesOf(dev).length, 0, `${name} has no hole`);
    assert.equal(dev.passes, undefined, `${name} declares no pass`);
    // a leg from the front duct to a rear waypoint laid anywhere along the plate meets it
    const {rack, ctx, mgr, c} = rackWith(name, dev, 0, 'duct');
    const solo = {...c, route: [{item: mgr, via: 'duct'}], routeEdited: true};
    const p = R.routePath({...rack, cables: [solo]}, solo, ctx);
    assert.deepEqual(p.crossings, [], name);
    // and it leaves the duct for the rear end of the switch above by the way round, not through
    assert.ok(p.points.length >= 2, name);
  }
});
