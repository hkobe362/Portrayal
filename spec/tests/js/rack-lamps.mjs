// spec/tests/js/rack-lamps.mjs
// EVERY LAMP AND DIGIT A DRAWING DECLARES CAN BE SET IN A RACK (P-0041). The
// rack path checks a state against `configs[].states` of the device's
// `<ref>.configs.json`, which used to list a PDU's outlets and nothing the
// drawing's lamps declare, so `led-sys on NCP-04 cannot be set: it declares no
// state.` The build now lists every `data-states` on a `data-path` of the
// faces a configuration draws. This reads the real build (library/dist) for
// the library's own parts: three switches and two vertical PDUs
// (fixtures/rack-states/lamps.rack.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as ST from '../../../kit/rack/states.js';
import * as Q from '../../../kit/rack/queries.js';
import {apply} from '../../../kit/rack/commands.js';
import {configFacts} from '../../../kit/rack/catalog.js';
import {expandStates} from '../../../kit/states.js';

const DIST = new URL('../../../library/dist/', import.meta.url);
assert.ok(existsSync(new URL('rack.json', DIST)), 'no library/dist: run ./build.sh first (the suite reads the build)');
const read = f => JSON.parse(readFileSync(new URL(f, DIST), 'utf8'));
const devices = read('rack.json').devices;
const chassisOf = ref => (Object.hasOwn(devices, ref) ? devices[ref] : null);
const slotsOf = ref => {
  if (!existsSync(new URL(`${ref}.configs.json`, DIST))) return null;
  const j = read(`${ref}.configs.json`);
  return {bays: j.bays || {}, cages: j.cages || {}, configs: j.configs || [], default: j.default ?? null, 'pdu-class': j['pdu-class'] ?? null};
};
const ctx = {chassisOf, slotsOf};
const run = (rack, cmds) => apply(rack, cmds, ctx);

const doc = JSON.parse(readFileSync(new URL('../fixtures/rack-states/lamps.rack.json', import.meta.url), 'utf8'));
const read4 = M.parseDoc(doc, {notes: []});
const rack = read4.racks[0];
const entries = [...rack.items, ...rack.zeroU];
const factsOf = e => configFacts(slotsOf(e.ref), e.cfg);

// the svg text of every face a configuration draws
const facesOf = (ref, cfg) => {
  const c = read(`${ref}.configs.json`).configs.find(k => k.name === (cfg || read(`${ref}.configs.json`).default));
  return [...new Set(Object.values(c.files))].map(f => readFileSync(new URL(f, DIST), 'utf8'));
};
// the tag the drawing gives a path, or null
const tagOf = (svgs, path) => svgs.map(s => new RegExp(`<[a-z]+ [^>]*data-path="${path.replace(/[/]/g, '\\/')}"[^>]*>`).exec(s)?.[0]).find(Boolean) ?? null;

test('the fixture rack loads whole: three switches, two PDUs, cables and power cords', () => {
  assert.deepEqual(rack.items.map(i => i.ref), ['s9700-53dx', 's9705-48d', 's9601-102xc']);
  assert.deepEqual(rack.zeroU.map(z => z.ref), ['evma8365x', 'evma8365x']);
  assert.equal(rack.cables.length, 6);
});

test('every cable of the fixture ends on a part its device draws', () => {
  const byId = Object.fromEntries(entries.map(e => [e.id, e]));
  for (const c of rack.cables) for (const end of [c.a, c.b]) {
    const e = byId[end.item];
    assert.ok(tagOf(facesOf(e.ref, e.cfg), end.path), `${c.id}: ${e.label} draws no ${end.path}`);
  }
});

test('every state the fixture sets is one its part declares: nothing is refused, kept and not applied', () => {
  assert.deepEqual(ST.stateNotices(rack, ctx), []);
  for (const e of entries) {
    const facts = factsOf(e);
    assert.ok(facts, `${e.ref} has a parts list`);
    assert.deepEqual(Object.keys(ST.statesFor(e, facts)).sort(), Object.keys(e.states).sort(), `${e.label}: all applied`);
  }
});

test('each state the fixture sets is on a path of the drawing that declares it, and the drawing has a rule for it', () => {
  for (const e of entries) {
    const svgs = facesOf(e.ref, e.cfg);
    for (const [path, state] of Object.entries(e.states)) {
      const tag = tagOf(svgs, path);
      assert.ok(tag, `${e.label}: the drawing has no ${path}`);
      const declared = /data-states="([^"]*)"/.exec(tag)?.[1].split(' ') ?? [];
      assert.ok(declared.includes(state), `${e.label}: ${path} declares ${declared.join(' ')}, not ${state}`);
      // a lamp state is drawn by a `.state-<name>` rule; a digit glyph is the display's own vocabulary
      if (!/^[0-9a-f]$/.test(state)) assert.ok(svgs.some(s => s.includes(`.state-${state}`)), `${e.label}: no rule paints ${state}`);
    }
  }
});

test('the lamps the issue named are settable: a status lamp, a PSU, a port, the digits, an outlet lamp, a breaker', () => {
  const sw = factsOf(rack.items[0]);
  for (const p of ['led-sys', 'led-fan', 'led-ps0', 'psu-0/module/status-led', 'fan-0/module/status-led', 'led-port-0/lamp', 'status-display/digit-1']) assert.ok(sw.states[p], p);
  assert.deepEqual(sw.states['led-sys'], ['off', 'ok', 'boot-failed']);
  assert.ok(sw.states['status-display/digit-2'].includes('blank'));
  assert.ok(factsOf(rack.items[1]).states['beacon/digit-1'], 'the S9705 beacon digits');
  const leaf = factsOf(rack.items[2]);
  for (const p of ['led-id', 'led-sync', 'led-port-100/lane-1', 'mgmt/led-a']) assert.ok(leaf.states[p], p);
  const pdu = factsOf(rack.zeroU[0]);
  for (const p of ['outlet-a1', 'led-a1', 'led-f42', 'breaker-a/rocker', 'network-module/module/eth0/led-a']) assert.ok(pdu.states[p], p);
  assert.deepEqual(pdu.states['outlet-a1'], ['on', 'off'], 'the outlets are as they were');
});

test('state.set takes them, in the rack file, on a device and on a part beside the rack', () => {
  const sw = rack.items[0].id;
  const set = (id, path, state) => run(rack, {op: 'state.set', id, path, state});
  assert.equal(set(sw, 'led-sys', 'boot-failed').summary, 'Set led-sys on spine-1 to boot-failed.');
  assert.equal(set(sw, 'led-sys', 'ok').noop, true, 'already ok in the file');
  assert.equal(set(sw, 'led-port-7/lamp', 'on').rack.items[0].states['led-port-7/lamp'], 'on');
  assert.equal(set(sw, 'psu-1/module/status-led', 'critical').rack.items[0].states['psu-1/module/status-led'], 'critical');
  assert.equal(set('z1', 'breaker-c/rocker', 'off').rack.zeroU[0].states['breaker-c/rocker'], 'off');
  assert.equal(set('z1', 'led-a2', 'off').rack.zeroU[0].states['led-a2'], 'off');
});

test('a made-up path or state is still refused, with what the part can be', () => {
  const sw = rack.items[0].id;
  const nope = run(rack, {op: 'state.set', id: sw, path: 'led-nonsense', state: 'on'});
  assert.match(nope.error, /^led-nonsense on spine-1 cannot be set: it declares no state\. It declares: /);
  assert.match(nope.error, /led-sys, led-sys\/lamp can be off, ok or boot-failed/, 'and names real paths to ask for');
  const purple = run(rack, {op: 'state.set', id: sw, path: 'led-sys', state: 'purple'});
  assert.equal(purple.error, 'led-sys on spine-1 cannot be purple: it can be off, ok or boot-failed.');
  // the refusal is bounded: a hundred lamps are a handful of vocabularies
  assert.ok(nope.error.length < 900, nope.error.length);
});

test('inspect lists what each device can be set to, grouped by vocabulary, and what it is set to', async () => {
  const sw = await Q.inspect(rack, 'i1', ctx);
  const group = p => sw.settable.find(g => g.paths.includes(p));
  assert.deepEqual(group('led-sys').can, ['off', 'ok', 'boot-failed']);
  assert.ok(group('led-port-0/lamp').paths.length >= 50, 'one group for the port lamps');
  assert.ok(group('status-display/digit-1').can.includes('blank'));
  assert.equal(sw.states['led-sys'], 'ok');
  const pdu = await Q.inspect(rack, 'z1', ctx);
  assert.ok(pdu.settable.some(g => g.paths.includes('breaker-a/rocker')));
  assert.ok(pdu.settable.some(g => g.paths.includes('outlet-a1') && g.can.join() === 'on,off'));
  assert.equal(pdu.states['breaker-b/rocker'], 'off');
  // a device whose parts list is not loaded lists nothing, as before
  assert.equal('settable' in await Q.inspect(rack, 'i1', {chassisOf}), false);
});

test('the map handed to 2D and 3D carries the lamps, and an outlet still reaches the lamp bound to it', () => {
  const pdu = rack.zeroU[0];
  const bindings = new Map([['outlet-a2', ['led-a2']], ['outlet-b8', ['led-b8']]]);
  const handed = expandStates(ST.statesFor(pdu, {...factsOf(pdu), bindings}), bindings);
  assert.equal(handed['outlet-b8'], 'off');
  assert.equal(handed['led-b8'], 'off', 'the outlet takes its lamp with it');
  assert.equal(handed['led-a1'], 'on', 'a lamp set itself is applied');
  assert.equal(handed['breaker-b/rocker'], 'off');
  const sw = ST.statesFor(rack.items[0], factsOf(rack.items[0]));
  assert.equal(sw['led-sys'], 'ok');
  assert.equal(sw['led-port-0/lamp'], 'on');
  assert.equal(sw['psu-1/module/status-led'], 'input-lost');
});
