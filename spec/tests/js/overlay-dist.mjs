// A list of dist roots in the kit's readers (overlay library, docs/building-an-overlay.md).
// The public dist is what ./build.sh made; the overlay dist is what
// `build.sh --overlay-library` made from spec/tests/fixtures/overlay-example,
// the made-up `overlay-switch`. Both are read through fetch from disk, so the
// kit's own code answers.
//
// env: PUBLIC_DIST, OVERLAY_DIST (directories).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = process.env.PUBLIC_DIST, OVERLAY = process.env.OVERLAY_DIST;
const BASES = {'http://kit.test/public/': PUBLIC, 'http://kit.test/overlay/': OVERLAY};
const roots = Object.keys(BASES);
const [PUB, OVL] = roots;
// roots a test adds: base URL -> {file: text}
const synthetic = {};

globalThis.location = {href: 'http://kit.test/', search: ''};
globalThis.fetch = async url => {
  url = String(url);
  const miss = {ok: false, status: 404, text: async () => '', json: async () => { throw new Error(`404 ${url}`); }};
  for (const [base, files] of Object.entries(synthetic))
    if (url.startsWith(base)) {
      const t = files[url.slice(base.length)];
      return t === undefined ? miss : {ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t)};
    }
  for (const [base, dir] of Object.entries(BASES))
    if (url.startsWith(base)) {
      const f = join(dir, url.slice(base.length));
      if (!existsSync(f)) return miss;
      const t = readFileSync(f, 'utf8');
      return {ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t)};
    }
  return miss;
};

const { loadSlots, loadCatalog } = await import('../../../kit/rack/catalog.js');
const { distResolver, readIndex } = await import('../../../kit/dist.js');
const { clearDistCache } = await import('../../../kit/dist.js');

const read = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const publicDevice = read(PUBLIC, 'devices.json').devices.find(d => existsSync(join(PUBLIC, `${d.name}.configs.json`))).name;
const publicPart = read(PUBLIC, 'components.json').components.find(c => c.kind !== 'kit');
const OVERLAY_DEVICE = 'overlay-switch';

test('loadSlots with a list reads each device from the root that holds it', async () => {
  clearDistCache();
  const s = await loadSlots(roots, [OVERLAY_DEVICE, publicDevice]);
  assert.ok(s.slotsOf(OVERLAY_DEVICE), 'the overlay device is not loaded');
  assert.ok(s.slotsOf(publicDevice), 'the public device is not loaded beside it');
  assert.equal(s.slotsOf(OVERLAY_DEVICE).default, 'base');
  // the overlay device seats a public part: the public components.json answers for it
  assert.ok(s.compByRef('std/sfp@1'), 'a public part is unknown to the merged lookup');
  assert.equal(s.slotsOf('no-such-device'), null);
});

test('loadSlots with one root is what it was', async () => {
  clearDistCache();
  const s = await loadSlots(PUB, [publicDevice]);
  assert.ok(s.slotsOf(publicDevice));
  assert.equal(s.slotsOf(OVERLAY_DEVICE), null);
  const one = await loadSlots([PUB], [publicDevice]);
  assert.deepEqual(one.slotsOf(publicDevice), s.slotsOf(publicDevice));
});

test('a component id in two roots is an error naming both, never a replacement', async () => {
  clearDistCache();
  const dup = 'http://kit.test/dup/';
  synthetic[dup] = {'components.json': JSON.stringify({components: [publicPart]})};
  await assert.rejects(loadSlots([PUB, dup], []), err => {
    assert.match(err.message, new RegExp(`${publicPart.ns}/${publicPart.name}@${String(publicPart.major).replace(/^v/, '')}`));
    assert.ok(err.message.includes(PUB) && err.message.includes(dup), err.message);
    return true;
  });
  delete synthetic[dup];
});

test('a device id in two roots is an error naming both', async () => {
  clearDistCache();
  const dup = 'http://kit.test/dup/';
  synthetic[dup] = {'components.json': JSON.stringify({components: []}),
                    [`${publicDevice}.configs.json`]: JSON.stringify({device: publicDevice, configs: [], default: 'x'})};
  await assert.rejects(loadSlots([PUB, dup], [publicDevice]), err => {
    assert.ok(err.message.includes(publicDevice) && err.message.includes(PUB) && err.message.includes(dup), err.message);
    return true;
  });
  delete synthetic[dup];
});

test('loadCatalog with a list adds the overlay device to the public ones', async () => {
  clearDistCache();
  const c = await loadCatalog(roots);
  assert.ok(c.chassisOf(OVERLAY_DEVICE), 'the overlay device is not in the catalogue');
  assert.ok(c.chassisOf(publicDevice));
  assert.equal(c.chassisOf(OVERLAY_DEVICE).ru, 1);
  assert.equal(c.entries.length, Object.keys(read(PUBLIC, 'rack.json').devices).length + 1);
});

test('loadCatalog refuses a device id in two roots, naming both', async () => {
  clearDistCache();
  const dup = 'http://kit.test/dup/';
  synthetic[dup] = {'rack.json': JSON.stringify({format: 1, devices: {[publicDevice]: {ru: 1}}})};
  await assert.rejects(loadCatalog([PUB, dup]), err => {
    assert.ok(err.message.includes(publicDevice) && err.message.includes(PUB) && err.message.includes(dup), err.message);
    return true;
  });
  delete synthetic[dup];
});

test('a layered resolver sends each file to the root that holds it, and merges the indexes', async () => {
  clearDistCache();
  const distAt = distResolver(roots, '../dist');
  await distAt.ready;
  // what the 2D shell and the 3D viewer fetch for a device and for a part
  assert.equal(distAt(`${OVERLAY_DEVICE}.configs.json`), `${OVL}${OVERLAY_DEVICE}.configs.json`);
  assert.equal(distAt(`${OVERLAY_DEVICE}.base.front.svg`), `${OVL}${OVERLAY_DEVICE}.base.front.svg`);
  assert.equal(distAt(`${publicDevice}.configs.json`), `${PUB}${publicDevice}.configs.json`);
  const skin = `components/${publicPart.ns}--${publicPart.name}--${publicPart.major}--x.svg`;
  assert.equal(distAt(skin), `${PUB}${skin}`);
  const devices = (await readIndex(distAt, 'devices.json')).devices.map(d => d.name);
  assert.ok(devices.includes(OVERLAY_DEVICE) && devices.includes(publicDevice));
  const comps = (await readIndex(distAt, 'components.json')).components;
  assert.equal(comps.length, read(PUBLIC, 'components.json').components.length);
});

test('a layered resolver refuses an id in two roots, naming both', async () => {
  clearDistCache();
  const dup = 'http://kit.test/dup/';
  synthetic[dup] = {'devices.json': JSON.stringify({devices: [{name: publicDevice, ns: 'x'}]}),
                    'components.json': JSON.stringify({components: []})};
  const distAt = distResolver([PUB, dup], '../dist');
  await assert.rejects(distAt.ready, err => {
    assert.ok(err.message.includes(publicDevice) && err.message.includes(PUB) && err.message.includes(dup), err.message);
    return true;
  });
  delete synthetic[dup];
});

test('a single root stays a plain resolver', () => {
  const distAt = distResolver('http://kit.test/public', '../dist');
  assert.equal(distAt('devices.json'), 'http://kit.test/public/devices.json');
  assert.equal(distAt.ready, undefined);
});
