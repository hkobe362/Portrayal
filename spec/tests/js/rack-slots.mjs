// spec/tests/js/rack-slots.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// jdist resolves a url against location.href and fetches it: stand both in.
globalThis.location = {href: 'https://page.test/', search: ''};
const asked = [];
let files = {};
globalThis.fetch = async url => {
  asked.push(url);
  const name = url.slice('https://page.test/d/'.length);
  return Object.hasOwn(files, name) ? {ok: true, json: async () => files[name]} : {ok: false, status: 404};
};

const {loadSlots, configFacts, meteringOf} = await import('../../../kit/rack/catalog.js');
const {clearDistCache} = await import('../../../kit/dist.js');

const LEAF = {device: 'leaf', default: 'base',
  bays: {front: [], rear: [{id: 'psu-1', group: 'psus', accepts: ['common/psu-a@1'], default: 'common/psu-a@1'}]},
  cages: {front: [{id: 'port-1', group: 'sfp', interface: 'sfp', media: 'sfp', accepts: ['generic/sfp-lc@1'], default: null}]},
  configs: [{name: 'base', description: 'Base', airflow: 'front-to-back', bays: {}, occupants: {}}]};
const COMPONENTS = {components: [{ns: 'generic', name: 'sfp-lc', major: 'v1', class: 'transceiver', attrs: {media: 'fiber'}}]};
const fresh = f => { clearDistCache(); asked.length = 0; files = f; };

test('loadSlots fetches each device once and components.json once, and answers synchronously', async () => {
  fresh({'leaf.configs.json': LEAF, 'components.json': COMPONENTS});
  const s = await loadSlots('/d', ['leaf', 'leaf']);
  assert.deepEqual(asked.sort(), ['https://page.test/d/components.json', 'https://page.test/d/leaf.configs.json']);
  assert.deepEqual(s.slotsOf('leaf'), {bays: LEAF.bays, cages: LEAF.cages, configs: LEAF.configs, default: 'base', 'pdu-class': null});
  assert.equal(s.compByRef('generic/sfp-lc@1').class, 'transceiver');
  assert.equal(s.compByRef('generic/sfp-lc@1:1.2.0').class, 'transceiver');
  assert.equal(s.compByRef('generic/nope@1'), null);
  assert.equal(s.compByRef(null), null);
  assert.equal(s.slotsOf('nope'), null);
});

test('a device whose file fails is null, and the others still load', async () => {
  fresh({'leaf.configs.json': LEAF, 'components.json': COMPONENTS});
  const s = await loadSlots('/d', ['gone', 'leaf']);
  assert.equal(s.slotsOf('gone'), null);
  assert.equal(s.slotsOf('leaf').default, 'base');
});

test('a failed components.json leaves every part unknown and never throws', async () => {
  fresh({'leaf.configs.json': LEAF});
  const s = await loadSlots('/d', ['leaf']);
  assert.equal(s.compByRef('generic/sfp-lc@1'), null);
  assert.equal(s.slotsOf('leaf').default, 'base');
});

test('a ref that is not a device name is never fetched', async () => {
  fresh({'components.json': COMPONENTS});
  const s = await loadSlots('/d', ['../secret', 'a/b', 'constructor.x', '', 7]);
  assert.deepEqual(asked, ['https://page.test/d/components.json']);
  assert.equal(s.slotsOf('../secret'), null);
  assert.equal(s.slotsOf('constructor'), null);
});

test('a function dist is asked for each path', async () => {
  fresh({'leaf.configs.json': LEAF, 'components.json': COMPONENTS});
  const paths = [];
  await loadSlots(p => { paths.push(p); return `https://page.test/d/${p}`; }, ['leaf']);
  assert.deepEqual(paths.sort(), ['components.json', 'leaf.configs.json']);
});

// THE FACTS OF A PDU AND OF A BRACKET (rack file version 4, part 4): the
// class at the top of configs.json, and `states`, `slots` and `mount-points`
// of each configuration, as render.py writes them.
const PDU = {device: 'pdu', default: 'base', 'pdu-class': 'managed', bays: {}, cages: {},
  configs: [{name: 'base', 'mount-points': [{mates: 'pdu-button', at: 124}, {mates: 'pdu-button', at: 1679.8}], slots: [],
             states: {'outlet-a1': ['on', 'off'], 'led-a1': ['on', 'off']}}]};
const BRACKET = {device: 'bracket', default: 'front', 'pdu-class': null, bays: {}, cages: {},
  configs: [{name: 'front', 'mount-points': [], slots: [{interface: 'pdu-button', at: 26}], states: {}},
            {name: 'side', 'mount-points': [], slots: [{interface: 'pdu-button', at: 26}, {interface: 'pdu-button', at: 51}], states: {}}]};

test('loadSlots keeps the class of a PDU, and configFacts reads what an entry is checked against', async () => {
  fresh({'pdu.configs.json': PDU, 'bracket.configs.json': BRACKET, 'leaf.configs.json': LEAF, 'components.json': COMPONENTS});
  const s = await loadSlots('/d', ['pdu', 'bracket', 'leaf']);
  assert.equal(s.slotsOf('pdu')['pdu-class'], 'managed');
  assert.deepEqual(configFacts(s.slotsOf('pdu'), ''), {config: 'base', pduClass: 'managed', metering: 'outlet',
    states: PDU.configs[0].states, slots: [], mountPoints: PDU.configs[0]['mount-points']});
  // a bracket is judged by the configuration its entry names: each mounting option has its own slots
  assert.deepEqual(configFacts(s.slotsOf('bracket'), 'side').slots, BRACKET.configs[1].slots);
  assert.deepEqual(configFacts(s.slotsOf('bracket'), '').slots, BRACKET.configs[0].slots);
  assert.equal(configFacts(s.slotsOf('bracket'), 'side').metering, null);
  // a file written before these keys reads as declaring none
  assert.deepEqual(configFacts(s.slotsOf('leaf'), 'base'), {config: 'base', pduClass: null, metering: null, states: {}, slots: [], mountPoints: []});
  assert.equal(configFacts(s.slotsOf('leaf'), 'nope'), null);
  assert.equal(configFacts(null, 'base'), null);
});

test('what a PDU meters follows from its class: the eight names, and nothing for any other', () => {
  assert.deepEqual(['basic', 'switched', 'metered-input', 'switched-metered-input', 'metered-branch', 'switched-metered-branch',
    'metered-outlet', 'managed'].map(meteringOf), ['none', 'none', 'input', 'input', 'branch', 'branch', 'outlet', 'outlet']);
  assert.deepEqual([null, undefined, 'constructor', 'smart'].map(meteringOf), [null, null, null, null]);
});

