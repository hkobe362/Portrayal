// How long the rack kit takes on a rack of a real one's size. Not a test
// file, and not run in CI: rack-speed.mjs holds the budgets. Run on its own
// it prints a table for this tree, or for another tree of the kit:
//
//   node spec/tests/js/speed-bench.mjs [--kit <dir>] [--cables 50,150,300] [--json]
//
// `<dir>` is a copy of another revision that holds its `kit`, for example
//   git archive <rev> kit | tar -x -C <dir>
// The racks are speed-fixture.mjs's, built with THIS tree's fixture and the
// other tree's model.js, so both trees are timed on the same racks.
//
// WHAT IS TIMED, for each size, on a rack whose routed lengths are saved (as
// a page saves them):
//   first read    routePath over every cable, nothing known;
//   second read   the same again, same rack and context;
//   new context   the same again with a context made anew, as a page makes
//                 one for every draw and every tool call;
//   each rack-wide call, after those, in the same context;
//   one cable moved, one switch moved: routePath over every cable of the
//                 edited rack, with a context made anew, and then every
//                 rack-wide call above on it, as one figure.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import * as F from './cable-solids-fixture.mjs';
import {speedRack, moveCable, moveDevice} from './speed-fixture.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const here = resolve(new URL('../../..', import.meta.url).pathname);
const root = arg('--kit') ? resolve(arg('--kit')) : here;
const sizes = (arg('--cables') ?? '50,150,300').split(',').map(Number);
const load = name => import(pathToFileURL(`${root}/kit/rack/${name}.js`));
const [M, R, B, S, Q, X] = await Promise.all(['model', 'route', 'bundles', 'slack', 'queries', 'export-data'].map(load));

const timed = async fn => { const t = performance.now(); const v = await fn(); return [performance.now() - t, v]; };

export async function bench(cables) {
  const made = speedRack(M, F, {cables, bundles: 4});
  const rows = [];
  const row = async (name, fn) => { const [ms, v] = await timed(fn); rows.push([name, ms]); return v; };
  let rack = made.rack;
  const all = (r, c) => r.cables.map(x => R.routePath(r, x, c));
  // the lengths a page saves, measured in a context that is then let go
  rack = R.withRoutedLengths(rack, made.ctxOf(rack));
  // nothing known of any cable: each one new, and its ends too
  rack = {...rack, cables: rack.cables.map(c => ({...c, a: {...c.a}, b: {...c.b}}))};
  const ctx = made.ctxOf(rack);
  await row('first read', () => all(rack, ctx));
  await row('second read', () => all(rack, ctx));
  const again = made.ctxOf(rack);
  await row('new context', () => all(rack, again));
  const label = id => rack.items.find(i => i.id === id)?.label ?? id;
  const bends = await row('bendFindings', () => R.bendFindings(rack, ctx, label));
  const covers = await row('coverFindings', () => R.coverFindings(rack, ctx, label));
  await row('ringFindings', () => R.ringFindings(rack, ctx, label));
  const bodies = await row('bodyFindings', () => R.bodyFindings(rack, ctx, label));
  await row('fill', () => R.fill(rack, ctx));
  await row('capacityOver', () => R.capacityOver(rack, ctx));
  await row('straps, every bundle', () => M.bundlesOf(rack).map(b => B.straps(rack, b, {route: ctx})));
  await row('anchorsOf', () => B.anchorsOf(rack, {route: ctx}));
  await row('spareOf, every cable', () => rack.cables.map(c => R.spareOf(rack, c, ctx)));
  const spare = await row('spareExports', () => S.spareExports(rack, ctx));
  const routes = new Map(rack.cables.map(c => [c.id, R.resolveRoute(rack, c, ctx)]));
  await row('cableScheduleRows', () => X.cableScheduleRows(rack, new Map(), rack.items, routes,
    {spare, bodies, bends, covers, bundles: X.bundleExports(rack, {route: ctx}), straps: B.strapTexts(rack, {route: ctx})}));
  await row('describe', () => Q.describe(rack, {chassisOf: made.chassisOf, route: ctx}));
  await row('inspect, one cable', () => Q.inspect(rack, 'c1', {chassisOf: made.chassisOf, route: ctx}));
  await row('freePorts', () => Q.freePorts(rack, made.switches[0], {portsOf: (it, view) => (view === 'front'
    ? Array.from({length: 76}, (_, n) => ({cls: 'port', path: `port-${n}`})) : []), slotsOf: () => null, compByRef: () => null}));
  // after one edit: every path, then every rack-wide call above, in a context made anew
  const after = async (name, r) => {
    const c = made.ctxOf(r), bc = {route: c};
    await row(`${name}: every path`, () => all(r, c));
    await row(`${name}: every call`, () => [R.bendFindings(r, c, label), R.coverFindings(r, c, label), R.ringFindings(r, c, label),
      R.bodyFindings(r, c, label), R.fill(r, c), R.capacityOver(r, c), M.bundlesOf(r).map(b => B.straps(r, b, bc)), B.anchorsOf(r, bc),
      r.cables.map(x => R.spareOf(r, x, c)), S.spareExports(r, c), Q.describe(r, {chassisOf: made.chassisOf, route: c})]);
  };
  await after('one cable moved', moveCable(rack, 'c1'));
  await after('one switch moved', moveDevice(rack, made.switches[6]));
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const tables = [];
  for (const n of sizes) tables.push(await bench(n));
  if (process.argv.includes('--json')) console.log(JSON.stringify({kit: root, sizes, rows: tables[0].map(([name], i) => [name, ...tables.map(t => Math.round(t[i][1] * 10) / 10)])}));
  else {
    console.log(`kit: ${root}\n`);
    console.log(`| call | ${sizes.map(n => `${n} cables`).join(' | ')} |\n|---|${sizes.map(() => '---:').join('|')}|`);
    tables[0].forEach(([name], i) => console.log(`| ${name} | ${tables.map(t => `${t[i][1] < 10 ? t[i][1].toFixed(1) : Math.round(t[i][1])} ms`).join(' | ')} |`));
  }
}
