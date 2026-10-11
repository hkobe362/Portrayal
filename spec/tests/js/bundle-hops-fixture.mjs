// A rack of short hops down one lane (#1012, #1013), kept in a file of its
// own so more than one test can load it. Not a test file.
//
// Twelve 1U switches at U31 to U42 and no cable manager. Eleven Cat 6 cords
// from the management port of each switch below (end a) to ports 1 to 11 of
// the top switch (end b): c1 is a one-unit hop, c2 a two-unit hop, c3 to c11
// longer. `bundled()` puts all eleven in one bundle whose route is the
// left-front lane from U31 to U42.
//
// The port positions are the ones a page reads off a compiled face: x from
// the rack's centre line, y up from the floor of U1. The management port
// stands right of the centre line, mid-face, 15.3 mm above the middle of its
// unit; the top switch's ports stand in two rows at the left, odd numbers in
// the upper row, 14.6 mm apart.
import {RU} from '../../../kit/rack/rails.js';

export const SIZES = {sw: {ru: 1, w: 438.5, h: 43.6, d: 370, kind: 'switch', model: 'SW'},
  // a horizontal manager, 1U, with five rings along x (rack-bundles.mjs)
  mgr: {ru: 1, d: 110, mount: 'rack-face', model: 'MGR', guides: {front: ['guide-1', 'guide-2', 'guide-3', 'guide-4', 'guide-5']}}};
export const chassisOf = ref => SIZES[ref] || null;

const TOP = 42, N = 11;
const mid = ru => (ru - 0.5) * RU;
const sw = (id, ru, label) => ({id, ref: 'sw', cfg: 'x', label, ru, face: 'front', turned: false, swaps: {}, fields: {}});
const end = (item, path) => ({item, path, view: 'front'});
// end for end: every cable written from the top switch down
export const rack = ({flip = false} = {}) => ({
  id: 'r1', name: 'Rack 5',
  frame: {kind: 'four-post', heightRU: 42, numbering: 'bottom-up', holes: {style: 'square', thread: null},
    railDepth: 740, usableDepth: 1000, ref: null},
  items: Array.from({length: N + 1}, (_, k) => sw(`i${k + 1}`, TOP - k, k ? `SW${k + 1}` : 'MGMT-SW1')),
  zeroU: [],
  cables: Array.from({length: N}, (_, k) => {
    const low = end(`i${k + 2}`, 'mgmt'), top = end('i1', `port-${k + 1}`);
    return {id: `c${k + 1}`, a: flip ? top : low, b: flip ? low : top, media: 'cat6', purpose: 'management', label: '', route: []};
  }),
});
export const TRUNK = [{lane: 'left-front', ru: 31}, {lane: 'left-front', ru: 42}];
export const bundled = ({flip = false, route = TRUNK} = {}) => ({...rack({flip}),
  bundles: [{id: 'b1', number: 1, label: 'MGMT', members: Array.from({length: N}, (_, k) => ({cable: `c${k + 1}`})), route}]});

// where a port is: {x, y} in rack mm
export function portAt(r, e) {
  const it = r.items.find(i => i.id === e.item);
  if (!it || it.ref !== 'sw') return null;
  if (e.path === 'mgmt') return {x: 30.85, y: mid(it.ru) + 15.3};
  const n = Number(/^port-(\d+)$/.exec(e.path)?.[1]);
  if (!(n >= 1)) return null;
  return {x: -203.57 + 14.6 * Math.floor((n - 1) / 2), y: mid(it.ru) + (n % 2 ? 0.8 : -10.7)};
}
// the route context a page would hand the kit: no guides but a manager's
// rings, a Cat 6 cord of 6 mm bent no tighter than 24 mm, an RJ45 plug
// standing 13 mm out of its jack
export const ctxFor = (r, extra = {}) => ({chassisOf,
  guidesOf: id => { const it = r.items.find(i => i.id === id);
    return it?.ref === 'mgr' ? SIZES.mgr.guides.front.map((via, i) => ({via, kind: 'ring', face: it.face, x: -205 + i * 102.5})) : []; },
  portX: e => portAt(r, e)?.x ?? null, portY: e => portAt(r, e)?.y ?? null,
  diameterOf: () => 6, bendOf: () => 24, plugReachOf: () => 13, ...extra});
