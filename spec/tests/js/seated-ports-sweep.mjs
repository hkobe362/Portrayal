// spec/tests/js/seated-ports-sweep.mjs
// rack/ports.js `seatedPort` against every face the build drew, both ways, as
// one line of JSON for test_seated_ports_sweep.py. Run: node <this> <dist>.
//
//   drawn -> kit   every port the build drew under a bay: the kit says yes, or
//                  says nothing (null, the drawing decides). It never says no.
//   kit -> drawn   every port the kit says yes to: the build drew it on that
//                  panel. The candidates are every part of what each bay could
//                  hold in the configuration - what it lists, and the bay's own
//                  default where it lists nothing - and of that part's back.
//
// One kind of yes has no drawing and is right: the back of a part in a host
// that draws no back for that bay (an enclosure with a closed rear). The port
// is the part's all the same. Those are counted apart, as `closed`.
import fs from 'node:fs';
import {seatedPort} from '../../../kit/rack/ports.js';

const D = process.argv[2];
const read = name => JSON.parse(fs.readFileSync(`${D}/${name}`, 'utf8'));
const comps = new Map(read('components.json').components.map(c => [`${c.ns}/${c.name}@${String(c.major).replace(/^v/, '')}`, c]));
const compByRef = ref => (ref == null ? null : comps.get(String(ref).split(':')[0]) ?? null);
const faceRef = f => (typeof f === 'string' ? f : f?.ref) || null;
const attr = (tag, a) => (new RegExp(`\\s${a}="([^"]*)"`).exec(tag) || [])[1];

const out = {devices: 0, configs: 0, drawn: 0, yes: 0, unsaid: 0, denied: [], asked: 0, said: 0, shown: 0, closed: 0, closedOn: [], phantom: [], unspoken: 0};
for (const f of fs.readdirSync(D).filter(n => n.endsWith('.configs.json')).sort()) {
  const ref = f.slice(0, -'.configs.json'.length), j = read(f);
  const slots = {bays: j.bays || {}, cages: j.cages || {}, configs: j.configs || [], default: j.default ?? null};
  const ctx = {slotsOf: () => slots, compByRef};
  out.devices++;
  for (const cfg of slots.configs) {
    out.configs++;
    const item = {id: 'i1', ref, cfg: cfg.name, swaps: {}};
    const ports = {}, backs = {};
    for (const view of ['front', 'rear']) {
      const file = cfg.files?.[view];
      if (!file || !fs.existsSync(`${D}/${file}`)) continue;
      ports[view] = new Set(); backs[view] = new Set();
      const text = fs.readFileSync(`${D}/${file}`, 'utf8');
      for (const m of text.matchAll(/<g\s[^>]*data-projection="1"[^>]*>/g)) if (attr(m[0], 'data-of')) backs[view].add(attr(m[0], 'data-of'));
      for (const m of text.matchAll(/<g\s[^>]*data-class="port"[^>]*>/g)) {
        const path = attr(m[0], 'data-path') ?? attr(m[0], 'data-of');
        if (path == null || !path.includes('/module/')) continue;
        ports[view].add(path);
        out.drawn++;
        const got = seatedPort(item, {path, view}, ctx);
        if (!got) out.unsaid++;
        else if (got.port) out.yes++;
        else out.denied.push(`${ref} ${cfg.name} ${view} ${path}`);
      }
    }
    // kit -> drawn
    for (const [bayView, bays] of Object.entries(slots.bays)) for (const bay of bays || []) {
      const listed = Object.hasOwn(cfg.bays || {}, bay.id);
      const held = compByRef(listed ? cfg.bays[bay.id] : bay.default);
      if (!held) continue;
      const ids = [...(held.parts || []), ...(compByRef(faceRef(held.faces?.rear))?.parts || [])].map(q => q.id);
      for (const id of new Set(ids)) for (const view of ['front', 'rear']) {
        if (!ports[view]) continue;
        const path = `${bay.id}/module/${id}`;
        out.asked++;
        const got = seatedPort(item, {path, view}, ctx);
        if (!listed) { out.unspoken++; if (got) out.phantom.push(`${ref} ${cfg.name} ${view} ${path}: answered for a bay the configuration does not list`); continue; }
        if (!got?.port) continue;
        out.said++;
        if (ports[view].has(path)) out.shown++;
        else if (got.back && !backs[view].has(`${bay.id}/module`)) { out.closed++; if (!out.closedOn.includes(ref)) out.closedOn.push(ref); }
        else out.phantom.push(`${ref} ${cfg.name} ${view} ${path}`);
      }
      void bayView;
    }
  }
}
console.log(JSON.stringify(out));
