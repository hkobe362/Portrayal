// dist.js's resolvers under node: `packageDist` over a set of npm packages
// laid out as npm_packages.py writes them, and `flatDist` over one build
// directory. fetch is stood in for by the file system: a URL under PREFIX is
// the file at the same path under PKGS (process.argv[2]).
//
// Prints one JSON line: how `latest` resolved, and for every file the kit can
// ask for - the index JSON, each device's configs.json and the file for every
// face of every configuration, every component skin and body side - which
// package the URL landed in and whether that package holds the file.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PKGS = process.argv[2];
const PREFIX = 'https://cdn.test/npm/';
const asked = [];
globalThis.location = { href: 'https://page.test/', search: '' };
globalThis.fetch = async url => {
  asked.push(url);
  const rel = url.startsWith(PREFIX) ? url.slice(PREFIX.length) : null;
  // `@portrayal/<pkg>@<version>/<path>` -> PKGS/<pkg>/<path>, when the
  // version is the one that package.json holds (or `latest`)
  const m = rel && rel.match(/^@portrayal\/([^@]+)@([^/]+)\/(.*)$/);
  const file = m && join(PKGS, m[1], m[3]);
  if (!m || !existsSync(file)) return { ok: false, status: 404 };
  const held = JSON.parse(readFileSync(join(PKGS, m[1], 'package.json'), 'utf8')).version;
  if (m[2] !== 'latest' && m[2] !== held) return { ok: false, status: 404 };
  const body = readFileSync(file, 'utf8');
  return { ok: true, json: async () => JSON.parse(body), text: async () => body };
};

const { packageDist, flatDist, distResolver, safeIndex, readRack, rackFile } = await import('../../../kit/dist.js');
const at = (name, version) => `${PREFIX}${name}@${version}/`;
const distAt = await packageDist({ at });

const wanted = ['devices.json', 'components.json', 'vendors.json'];
const pk = distAt.packages;
for (const name of Object.keys(pk.devices)) {
  wanted.push(`${name}.configs.json`, `${name}.source.json`);
  const idx = JSON.parse(readFileSync(join(PKGS, pk.devices[name].package.split('/')[1],
                                           `${name}.configs.json`), 'utf8'));
  for (const c of idx.configs) wanted.push(...Object.values(c.files || {}));
}
const comps = JSON.parse(readFileSync(join(PKGS, 'index', 'components.json'), 'utf8')).components;
for (const c of comps) {
  wanted.push(...Object.values(c.files || {}));
  wanted.push(...Object.values(c.body?.sides || {}));
}
// a rack product is read from its own package, by the ref a saved rack file
// carries: `<vendor>/<name>@<major>`
const racks = {};
for (const [key, row] of Object.entries(pk.racks || {})) {
  const ref = `${key}@${row.major}`;
  const doc = await readRack(distAt, ref);
  racks[ref] = {
    name: doc.name, version: doc.version, kind: doc.kind,
    package: distAt(rackFile(ref)).startsWith(at(row.package, row.version)),
    held: existsSync(join(PKGS, row.package.split('/')[1], rackFile(ref).split('/')[1])),
    wrongMajor: await readRack(distAt, `${key}@${row.major + 1}`).then(() => 'loaded', e => String(e.message)),
  };
}
const unresolved = [];
for (const path of new Set(wanted)) {
  const url = distAt(path);
  const m = url.slice(PREFIX.length).match(/^@portrayal\/([^@]+)@([^/]+)\/(.*)$/);
  if (!m || m[2] === 'latest' || !existsSync(join(PKGS, m[1], m[3]))) unresolved.push([path, url]);
}

// a skin lands in ITS namespace's package, and a name on every object's
// prototype is nobody's package
const aSkin = comps.flatMap(c => Object.values(c.files || {})).find(f => f.startsWith('components/'));
const skinNs = aSkin.slice('components/'.length).split('--')[0];

console.log(JSON.stringify({
  skin: [distAt(aSkin), `${at(pk.components[skinNs].package, pk.components[skinNs].version)}${aSkin.slice('components/'.length)}`],
  skinPackages: new Set(Object.values(pk.components).map(r => r.package)).size,
  inherited: [distAt('components/constructor--x--v1--default.svg'), distAt('constructor.configs.json'),
              distAt('components/__proto__--x--v1--default.svg')],
  racks,
  rackRefs: ['apc/ar203a@1', 'apc/ar203a', 'apc/ar203a@x', '../x/y@1', 'apc/ar203a@1/../x', '']
    .map(r => [r, (() => { try { return rackFile(r); } catch (e) { return String(e.message).slice(0, 24); } })()]),
  rackInherited: [distAt('racks/constructor--x.rack.json'), distAt('racks/__proto__--x.rack.json')],
  rackPackages: Object.keys(pk.racks || {}).length,
  firstAsked: asked.slice(0, 2),
  indexVersion: JSON.parse(readFileSync(join(PKGS, 'index', 'package.json'), 'utf8')).version,
  checked: new Set(wanted).size,
  unresolved: unresolved.slice(0, 10),
  flat: [flatDist('../dist')('a.svg'), flatDist('../dist/')('a.svg')],
  resolverKeepsAFunction: distResolver(distAt, 'x') === distAt,
  resolverFromString: distResolver(undefined, '../dist')('devices.json'),
  resolverFromEmpty: distResolver('', '../dist')('devices.json'),
  // a crafted `?index=` is refused before any request is made
  crafted: await (async () => {
    const before = asked.length;
    const e = await packageDist({ at, index: '0/../../../gh/someone/else@main' }).then(() => 'loaded', e => String(e.message));
    return { error: e, requests: asked.length - before };
  })(),
  indexForms: ['latest', 'next', '1.2.3', '0.1.0-rc.1', '0/../x', '1.2.3/x', '', 'Latest?']
    .map(v => [v, safeIndex(v)]),
  pinnedMissing: await packageDist({ at, index: '0.0.0-nope' }).then(() => 'loaded', e => String(e.message)),
}));
