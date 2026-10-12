// A RACK WHOSE TRUNKS DO NOT RUN STRAIGHT (#1034), for rack-strap-path.mjs.
// Not a test file. It is the shape of a rack that showed the fault: a patch
// panel at the top with a lacer on its front and another on the rear rails
// behind it, two two-unit switches below with a lacer over and under each, a
// duct beside each front upright, and 96 cords in eight bundles of twelve.
// Four bundles run on the front, from a switch's lacer up a front lane to
// the panel's. Four run from the rear lacer down a REAR lane and then a
// FRONT lane to a lacer under a switch: between the two lanes a cord goes
// round the duct by a detour point, so its path is well off the straight
// line from one lane point to the other, and longer.
// The devices are cable-solids-fixture's (the catalogue's lacer and duct);
// the ports are placed by their number, as speed-fixture places them.
const RU = 44.45;
const SW = {ru: 2, w: 436, h: 87.7, d: 580, kind: 'switch', model: 'SW2', manufacturer: 'Acme'};
const PANEL = {ru: 1, w: 448, h: 44, d: 432.8, kind: 'patch panel', model: 'PP', manufacturer: 'Acme'};
const TOP = 45;
const portX = n => Math.round((-207.2 + 11.2 * Math.floor(n / 2)) * 10) / 10;

export function rearToFront(M, F) {
  let rack = M.newRack({name: 'Rear to front'});
  rack = {...rack, frame: {...rack.frame, heightRU: TOP, railDepth: 740}};
  const sizes = {sw2: SW, pp: PANEL, 'fhd-cmp5dr': F.CAT['fhd-cmp5dr'], 'cmv-sfd45u5w': F.CAT['cmv-sfd45u5w']};
  const add = (ref, ru, extra = {}) => { rack = M.withItem(rack, {ref, cfg: 'base', ru, label: ref, ...extra}).rack; return rack.items.at(-1).id; };
  const panel = add('pp', TOP, {label: 'PP'});
  const sw = [add('sw2', TOP - 3, {label: 'SW-1'}), add('sw2', TOP - 6, {label: 'SW-2'})];
  const ppLacer = add('fhd-cmp5dr', TOP, {on: panel, unit: 1, label: 'LACER-PP'});
  const over = sw.map((id, k) => add('fhd-cmp5dr', TOP - 2 - 3 * k, {on: id, unit: 2, label: `LACER-${k + 1}-OVER`}));
  const under = sw.map((id, k) => add('fhd-cmp5dr', TOP - 3 - 3 * k, {on: id, unit: 1, label: `LACER-${k + 1}-UNDER`}));
  const rear = add('fhd-cmp5dr', TOP, {face: 'rear', label: 'LACER-REAR'});
  rack = {...rack, zeroU: [
    {id: 'z1', ref: 'cmv-sfd45u5w', cfg: 'base', label: 'VCM-L', at: 'left-front', offsetMm: 0},
    {id: 'z2', ref: 'cmv-sfd45u5w', cfg: 'base', label: 'VCM-R', at: 'right-front', offsetMm: 0}]};
  const ring = (item, n) => ({item, via: `guide-${n}`}), lane = (name, ru) => ({lane: name, ru});
  const cables = [], bundles = [];
  // twelve cords of a bundle: `ends(k)` gives the two ends of cord k, `own` its own route, `trunk` the bundle's
  const bundle = (label, ends, own, trunk) => {
    const members = [];
    for (let k = 0; k < 12; k++) {
      const id = `c${cables.length + 1}`, [a, b] = ends(k);
      cables.push({id, a, b, media: 'os2', purpose: '', label: '', route: own, routeEdited: true});
      members.push({cable: id});
    }
    bundles.push({id: `b${bundles.length + 1}`, number: bundles.length + 1, label, members, route: trunk});
  };
  const swPort = (k, n) => ({item: sw[k], path: `port-${n}`, view: 'front'});
  const ppPort = (view, n) => ({item: panel, path: `${view === 'rear' ? 'b' : 'lc'}${n}`, view});
  // the front: switch 1 and 2, left and right, up a front lane to the panel's lacer
  [[0, 'left', 2, 1, 0], [1, 'left', 2, 1, 12], [1, 'right', 4, 5, 24], [0, 'right', 4, 5, 36]].forEach(([k, side, inner, outer, first]) => {
    const up = [ring(over[k], inner), ring(over[k], outer), lane(`${side}-front`, TOP - 2 - 3 * k), lane(`${side}-front`, TOP), ring(ppLacer, outer)];
    bundle(`front ${bundles.length + 1}`, i => [swPort(k, (side === 'left' ? 0 : 40) + i), ppPort('front', first + i)],
      [...up, ...(k ? [ring(ppLacer, inner)] : [])], [...up, ...(k ? [ring(ppLacer, inner)] : [])]);
  });
  // the rear: the panel's back, the rear lacer, down a rear lane, on down a front lane, to the lacer under a switch
  [[1, 'left', 5, 1, 2, 0], [0, 'left', 4, 1, 2, 12], [0, 'right', 2, 5, 4, 24], [1, 'right', 1, 5, 4, 36]].forEach(([k, side, from, outer, inner, first]) => {
    const down = [ring(rear, from), lane(`${side}-rear`, TOP), lane(`${side}-front`, TOP - 3 - 3 * k), ring(under[k], outer)];
    bundle(`rear ${bundles.length - 3}`, i => [ppPort('rear', first + i), swPort(k, (side === 'left' ? 16 : 56) + i)], down, [...down, ring(under[k], inner)]);
  });
  rack = {...rack, cables, bundles};
  const chassisOf = ref => (Object.hasOwn(sizes, ref) ? sizes[ref] : null);
  // The context for a rack, as a page builds it: new on every call.
  const ctxOf = (r, extra = {}) => {
    const items = new Map(r.items.map(i => [i.id, i]));
    const numOf = e => { const m = /(\d+)$/.exec(String(e?.path)); return m ? Number(m[1]) : null; };
    const xOf = e => { const it = items.get(e?.item), n = numOf(e); if (!it || n == null) return null;
      if (it.ref === 'sw2') return portX(n);
      if (it.ref !== 'pp') return null;
      const x = -200 + n * (400 / 47);
      return e.view === 'rear' ? -x : x; };
    return Object.freeze({
      chassisOf,
      // a lacer's rings as its own face shows them: one on the rear rails is seen from behind
      guidesOf: id => { const it = items.get(id); return it?.ref === 'fhd-cmp5dr' ? F.RINGS.map(g => ({...g, face: it.face, x: it.face === 'rear' ? -g.x : g.x})) : []; },
      portX: xOf,
      portY: e => { const it = items.get(e?.item), n = numOf(e); if (!it || n == null) return null;
        return it.ref === 'sw2' ? (it.ru + 1) * RU - (0.6 + (n % 2 ? 58.4 : 44.9)) : (it.ru - 0.5) * RU; },
      zeroUAperture: z => (z?.ref === 'cmv-sfd45u5w' ? {w: 93, h: 165} : null),
      ...extra});
  };
  return {rack, ctxOf, chassisOf};
}
