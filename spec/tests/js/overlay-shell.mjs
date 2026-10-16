// The 2D shell mounted over a list of dist roots (overlay library): the device
// picker lists the public devices and the overlay's, and each is drawn from the
// root that holds it. A drawing's text is "<root>:<file>", so the mounted
// drawing says where it came from.
//
// env: PUBLIC_DIST, OVERLAY_DIST (directories).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { install } from './fake-shell-dom.mjs';

const BASES = {'http://kit.test/public/': process.env.PUBLIC_DIST, 'http://kit.test/overlay/': process.env.OVERLAY_DIST};
install({});
globalThis.fetch = async url => {
  url = String(url);
  for (const [base, dir] of Object.entries(BASES)) {
    if (!url.startsWith(base)) continue;
    const rel = url.slice(base.length);
    const f = join(dir, rel);
    if (!existsSync(f)) break;
    const t = rel.endsWith('.svg') ? `${base.split('/').at(-2)}:${rel}` : readFileSync(f, 'utf8');
    return {ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t)};
  }
  return {ok: false, status: 404, text: async () => '', json: async () => { throw new Error(`404 ${url}`); }};
};
const { createShell } = await import('../../../kit/shell.js');

const publicDevices = JSON.parse(readFileSync(join(process.env.PUBLIC_DIST, 'devices.json'), 'utf8')).devices;
const publicDevice = publicDevices.find(d => existsSync(join(process.env.PUBLIC_DIST, `${d.name}.configs.json`))).name;

test('the shell lists and draws a public device and an overlay device from their own roots', async () => {
  const shell = createShell({dist: Object.keys(BASES), device: 'overlay-switch'});
  await shell.ready;
  assert.equal(shell.state.device, 'overlay-switch');
  const drawn = () => shell.el.svgHost.children.map(c => c.getAttribute('data-src'));
  assert.deepEqual(drawn(), ['overlay:overlay-switch.base.front.svg']);
  await shell.loadDevice(publicDevice);
  assert.equal(shell.state.device, publicDevice);
  assert.match(drawn()[0], /^public:/);
  await shell.loadDevice('overlay-switch', {view: 'rear'});
  assert.deepEqual(drawn(), ['overlay:overlay-switch.base.rear.svg']);
});
