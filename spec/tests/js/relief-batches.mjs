// The relief built and drawn in batches (kit 0.43.0): one raster per drawing,
// kept by what decides its pixels (rasterKey), and a face's pieces merged into
// one geometry each carried by its own matrix (mergePieces). Run under bare
// node with a stand-in image and canvas, so it checks the bookkeeping and the
// arithmetic; what a browser draws is the harness's to compare.
globalThis.location = { search: '' };
globalThis.fetch = async () => ({ ok: true, text: async () => '<svg/>' });

// what a drawing through an image costs, counted: each Image that loads is one
const loads = [];
globalThis.Blob = class { constructor(parts, opts) { this.text = parts.join(''); this.type = opts && opts.type; } };
globalThis.URL.createObjectURL = b => { loads.push(b.text); return `blob:${loads.length}`; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.Image = class {
  set src(u) {
    // a drawing that says FAIL does not load, as a broken one would not
    setTimeout(() => (loads.at(-1).includes('FAIL') ? this.onerror(new Error('bad')) : this.onload()), 0);
  }
};
const drawn = [];
class Ctx {
  constructor(cv) { this.cv = cv; this.t = [1, 0, 0, 1, 0, 0]; }
  translate(x, y) { this.t = [this.t[0], 0, 0, this.t[3], this.t[4] + x * this.t[0], this.t[5] + y * this.t[3]]; }
  scale(a, b) { this.t = [this.t[0] * a, 0, 0, this.t[3] * b, this.t[4], this.t[5]]; }
  setTransform(...t) { this.t = t; }
  getTransform() { return {a: this.t[0], d: this.t[3], e: this.t[4], f: this.t[5]}; }
  drawImage(src) { drawn.push(src); this.cv.from = src.from || src; }
}
globalThis.document = {
  createElement: () => {
    const cv = {width: 0, height: 0};
    cv.getContext = () => (cv.ctx ||= new Ctx(cv));
    return cv;
  },
};
globalThis.performance ??= { now: () => Date.now() };

const m = await import('../../../kit/relief.js');
const out = {};

// ── rasterKey: what decides the pixels ──────────────────────────────────────
const sheet = '<style>.state-on { --led-color: #22c55e; } #led-sys.state-on { fill: red; } ' +
              "[data-path] { cursor: pointer; } [data-class='port'] { stroke: 1; }</style>";
const art = (id, path, title, cls = 'port', extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg">${sheet}<!--art--><g id="${id}" data-path="${path}" ` +
  `data-class="${cls}" data-rel-pos="${path}"${extra}><title>${title}</title><rect width="1" height="1"/></g></svg>`;
out.portsAlike = m.rasterKey(art('port-1', 'port-1', 'port-1')) === m.rasterKey(art('port-2', 'port-2', 'port-2'));
// an id the sheet names is kept, so is a value a selector reads
out.namedIdKept = m.rasterKey(art('led-sys', 'a', 't')) !== m.rasterKey(art('led-fan', 'a', 't'));
out.valuedAttrKept = m.rasterKey(art('a', 'a', 't', 'port')) !== m.rasterKey(art('a', 'a', 't', 'psu'));
// an id a reference names is kept
const ref = id => `<svg>${sheet}<defs><linearGradient id="${id}"/></defs><rect fill="url(#${id})"/></svg>`;
out.referencedIdKept = m.rasterKey(ref('g1')) !== m.rasterKey(ref('g2'));
// the art itself is kept to the character
out.artKept = m.rasterKey(art('a', 'a', 't').replace('width="1"', 'width="2"')) !== m.rasterKey(art('a', 'a', 't'));
// a stylesheet is never read as attributes
const styled = v => `<svg><style>/* data-x="${v}" */</style><rect/></svg>`;
out.styleKept = m.rasterKey(styled(1)) !== m.rasterKey(styled(2));
// nor is a run of text
const text = v => `<svg><text>data-x="${v}"</text></svg>`;
out.textKept = m.rasterKey(text(1)) !== m.rasterKey(text(2));
// a title keeps its element (a selector may count it), and an empty one stays empty
out.titleKeptAsElement = m.rasterKey('<svg><title>x</title></svg>') !== m.rasterKey('<svg></svg>')
  && m.rasterKey('<svg><title></title></svg>') !== m.rasterKey('<svg><title>x</title></svg>');

// ── the kept rasters ────────────────────────────────────────────────────────
m.clearRasterCache();
loads.length = 0;
const a = await m.rasterize(art('port-1', 'port-1', 'port-1'), 10, 5, 4);
const b = await m.rasterize(art('port-2', 'port-2', 'port-2'), 10, 5, 4);
out.onePortDrawnOnce = loads.length;
out.ownCanvases = a !== b && a.width === 40 && a.height === 20;
out.firstTextDrawn = loads[0].includes('port-1');
// another size, or a flip, is another raster
await m.rasterize(art('port-1', 'port-1', 'port-1'), 10, 5, 8);
const f = await m.rasterize(art('port-1', 'port-1', 'port-1'), 10, 5, 4, true, false);
out.sizeAndFlipApart = loads.length;
// a flipped raster's context is left flipped, as it always was
out.flippedContext = f.getContext('2d').getTransform();
// the kept one is shared and read only; a copy is the caller's
const s1 = await m.rasterSource(art('port-1', 'port-1', 'port-1'), 10, 5, 4);
const s2 = await m.rasterSource(art('port-9', 'port-9', 'port-9'), 10, 5, 4);
out.sourceShared = s1 === s2 && s1 !== a;
// a drawing that fails is not kept: the next ask tries again
loads.length = 0;
for (let i = 0; i < 2; i++) {
  try { await m.rasterize('<svg>FAIL</svg>', 1, 1, 4); } catch { /* expected */ }
}
out.failureNotKept = loads.length;
// a budget of nothing keeps nothing
m.setRasterBudget(0);
m.clearRasterCache();
loads.length = 0;
await m.rasterize(art('x', 'x', 'x'), 1, 1, 4);
await m.rasterize(art('x', 'x', 'x'), 1, 1, 4);
out.budgetZero = loads.length;
// and a budget is in pixels, oldest out first
m.setRasterBudget(40 * 20 + 1);
m.clearRasterCache();
loads.length = 0;
await m.rasterSource('<svg>A</svg>', 10, 5, 4);
await m.rasterSource('<svg>B</svg>', 10, 5, 4);
await m.rasterSource('<svg>B</svg>', 10, 5, 4);
await m.rasterSource('<svg>A</svg>', 10, 5, 4);
out.budgetEvicts = {loads: loads.length, kept: m.rasterStats().kept};
m.setRasterBudget(32e6);
const st = m.rasterStats();
out.statsShape = ['asked', 'drawn', 'ms', 'kept', 'px'].every(k => typeof st[k] === 'number');

// ── mergePieces ─────────────────────────────────────────────────────────────
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// a quad: four vertices facing +z, two triangles
const quad = {pos: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], nrm: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
              uv: [0, 0, 1, 0, 1, 1, 0, 1], index: [0, 1, 2, 0, 2, 3], start: 0, count: 6};
const r6 = v => v.map(x => Math.round(x * 1e6) / 1e6 + 0);
const same = m.mergePieces([{...quad, matrix: I}]);
out.identity = {pos: same.pos, nrm: same.nrm, uv: same.uv, index: same.index};
// moved by (5, 0, 2), and a second copy after it: its indices follow the first's vertices
const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 2, 1];
const two = m.mergePieces([{...quad, matrix: I}, {...quad, matrix: T}]);
out.twoCopies = {vertices: two.pos.length / 3, index: two.index, moved: two.pos.slice(12, 15)};
// turned a quarter about x (as a cylinder is laid down): +z faces -y
const c = Math.cos(Math.PI / 2), s = Math.sin(Math.PI / 2);
const RX = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
out.turnedNormal = r6(m.mergePieces([{...quad, matrix: RX}]).nrm.slice(0, 3));
// scaled unevenly: a normal goes by the inverse transpose, then unit length
const SK = [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const slope = {pos: [0, 0, 0, 1, 0, 1, 0, 1, 0], nrm: [Math.SQRT1_2, 0, -Math.SQRT1_2, Math.SQRT1_2, 0, -Math.SQRT1_2,
               Math.SQRT1_2, 0, -Math.SQRT1_2], uv: [0, 0, 0, 0, 0, 0], index: null, start: 0, count: 3};
out.scaledNormal = r6(m.mergePieces([{...slope, matrix: SK}]).nrm.slice(0, 3));
// mirrored in x: the winding turns over and the normal still faces out
const MX = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mir = m.mergePieces([{...quad, matrix: MX}]);
out.mirrored = {index: mir.index, nrm: r6(mir.nrm.slice(0, 3))};
// a range keeps only the vertices it uses
const half = m.mergePieces([{...quad, matrix: I, start: 3, count: 3}]);
out.range = {vertices: half.pos.length / 3, index: half.index};
// without normals or uvs, none are written
const bare = m.mergePieces([{...quad, matrix: I}], {normals: false, uvs: false});
out.bare = {nrm: bare.nrm, uv: bare.uv};

// ── rasterKey keeps the partition rasterKeyText makes (kit 0.45.0) ──────────
// A face's `<style>` and `<defs>` come first, then `<!--art-->` and the node's
// own art. The key rewrites that prefix once; it must still tell apart exactly
// the texts the whole-text rewrite tells apart, including an id of the prefix
// that only the art refers to.
const face = (defs, style) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9">${style}<defs>${defs}</defs>`;
const faceA = face('<linearGradient id="g1"/><linearGradient id="g2"/><rect id="unused" data-k="1"/>', sheet);
const faceB = face('<linearGradient id="g1"/><linearGradient id="g2"/><rect id="other" data-k="2"/>', sheet);
const faceC = face('<linearGradient id="g1"/>', sheet.replace('red', 'blue'));
const node = (p, body) => `${p}<!--art--><g>${body}</g></svg>`;
const bodies = ['<rect id="n1" data-path="a"/>', '<rect id="n2" data-path="b"/>', '<rect fill="url(#g1)"/>',
                '<rect fill="url(#g2)"/>', '<use href="#g1"/>', '<rect fill="url(#nowhere)"/>', '<title>x</title><rect/>',
                '<title>y</title><rect/>', '<rect id="led-sys"/>', '<style>.a{}</style><rect/>', '<rect/>'];
const texts = [];
for (const p of [faceA, faceB, faceC]) for (const b of bodies) texts.push(node(p, b));
texts.push('<svg>no marker</svg>', '<svg>no marker</svg>', '', node('<svg><style>', 'x'), node(sheet + '<g ', 'x'));
const ks = texts.map(t => m.rasterKey(t)), fs = texts.map(t => m.rasterKeyText(t));
let partition = true;
for (let i = 0; i < texts.length; i++)
  for (let j = i; j < texts.length; j++) if ((ks[i] === ks[j]) !== (fs[i] === fs[j])) partition = false;
out.keyPartition = partition;
out.keyIsShort = ks[0].length < fs[0].length / 2 + 40;
out.keyStable = m.rasterKey(texts[2]) === ks[2];
// a face's raster is the kept one, not a copy of it
m.setRasterBudget(32e6);
m.clearRasterCache();
globalThis.fetch = async () => ({ ok: true, text: async () => node(faceA, bodies[0]) });
const scope = m.createReliefScope({PXMM: 4});
const sc1 = await m.svgCanvas('x.svg', 10, 5, false, false, scope),
      sc2 = await m.svgCanvas('x.svg', 10, 5, false, false, scope);
out.svgCanvasShared = sc1 === sc2;

console.log(JSON.stringify(out));
