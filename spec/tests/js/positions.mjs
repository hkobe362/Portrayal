// The position control of the Explorer (kit/positions.js,
// docs/adjustable-positions-design.md section 7), mounted on a real shell over
// the stand-in page: what it draws for a device that declares an adjustment,
// what each of its parts writes through `setFields`, the sentence it shows for
// a value that is refused, the line that names the views which show the
// motion, and nothing at all for a device that declares none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { install, El } from './fake-shell-dom.mjs';

// The stand-in page keeps no text and has no `before`; the control writes
// both, so this file gives the element them. Nothing else in the page reads
// either back.
Object.defineProperty(El.prototype, 'textContent', {
  configurable: true,
  get() { return this._text ?? ''; },
  set(t) { this.replaceChildren(); this._text = String(t ?? ''); },
});
El.prototype.before = function (n) {
  const p = this.parentElement;
  if (!p) return;
  n.parentElement?.removeChild(n);
  n.parentElement = p;
  p.children.splice(p.children.indexOf(this), 0, n);
};

const DECL = {axis: 'z', carrier: 'panel', range: [20, 180], default: 60,
              stops: {front: 20, middle: 100, rear: 180}, label: 'Panel setback',
              datum: 'the front face of the panel'};
const HOLES = {axis: 'x', carrier: 'block', default: 30, stops: {inner: 30, outer: 90},
               label: 'Block offset', datum: 'the left edge of the block'};
const ADJ = at => JSON.stringify({'panel-setback': {...DECL, at}, 'block-offset': {...HOLES, at: 30}});
const M = (id, by, a = {}) => ({'data-moves-with': id, 'data-moves-by': by, ...a});
const chassis = {attrs: {'data-path': 'chassis', 'data-model': 'SLIDER'}};
const face = (src, parts, at = 60) => JSON.stringify({src, attrs: {'data-adjustments': ADJ(at)},
                                                      parts: [chassis, ...parts]});
const faces = at => ({
  front: face('front', [
    {attrs: {id: 'panel', 'data-path': 'panel', 'data-ref': 'fixture/slide-well@1:1.0.0',
             'data-depth': String(at), ...M('panel-setback', '0 0 1')}},
    {attrs: {id: 'block', 'data-path': 'block', 'data-ref': 'fixture/slide-stud@1:1.0.0',
             ...M('block-offset', '1 0 0')}}], at),
  rear: face('rear', [{attrs: {id: 'panel-back', ...M('panel-setback', '0 0 -1')}}], at),
  top: face('top', [{attrs: {id: 'panel', x: '10', y: '138.5', ...M('panel-setback', '0 -1 0')}}], at),
  right: face('right', [{attrs: {id: 'stud', 'data-path': 'stud', ...M('panel-setback', '1 0 0')}}], at),
});
const cfg = (name, views) => JSON.stringify({
  device: name, model: name.toUpperCase(), default: 'base', views, bays: {}, cages: {},
  configs: [{name: 'base', files: Object.fromEntries(views.map(v => [v, `${name}.base.${v}.svg`]))},
            {name: 'back', files: Object.fromEntries(views.map(v => [v, `${name}.back.${v}.svg`]))}]});
const VIEWS = ['front', 'rear', 'top', 'right'];
const routes = {
  'devices.json': () => JSON.stringify({devices: [
    {name: 'slider', ns: 'fixture', model: 'SLIDER'}, {name: 'plain', ns: 'fixture', model: 'PLAIN'}]}),
  'components.json': () => JSON.stringify({components: [
    {ns: 'fixture', name: 'slide-well', major: 'v1', skins: ['default']},
    {ns: 'fixture', name: 'slide-stud', major: 'v1', skins: ['default']}]}),
  'slider.configs.json': () => cfg('slider', VIEWS),
  'plain.configs.json': () => cfg('plain', ['front']),
  // a device that declares no adjustment
  'plain.base.front.svg': () => JSON.stringify({src: 'plain', parts: [chassis]}),
  // the face of a component, which a reader opens as a module
  'components/fixture--slide-well--v1--default.svg': () => JSON.stringify({src: 'well', parts: []}),
};
for (const v of VIEWS) {
  routes[`slider.base.${v}.svg`] = () => faces(60)[v];
  routes[`slider.back.${v}.svg`] = () => faces(180)[v];   // a configuration built moved
}
install(routes);
globalThis.location.search = '?device=slider&view=front';
const warned = [];
console.warn = (...a) => warned.push(a);

const { createShell } = await import('../../../kit/shell.js');
const { positionControl } = await import('../../../kit/positions.js');
const { encodeFields } = await import('../../../kit/fields.js');
const shell = createShell({dist: 'http://kit.test/dist'});
// the tree the control is put in front of, inside the aside
const aside = new El('aside');
aside.appendChild(shell.el.tree);
await shell.ready;
let threeD = true;
const control = positionControl(shell, {threeD: () => threeD});
const settle = () => new Promise(r => setTimeout(r, 0));
await settle(); await settle();

const group = id => control.el.querySelectorAll(`[data-adjustment="${id}"]`)[0];
const part = (id, name) => group(id).querySelectorAll(`[data-part="${name}"]`)[0];
const stop = (id, name) => group(id).querySelectorAll(`[data-stop="${name}"]`)[0];
const held = () => shell.state.cfgFields.panel?.['panel-setback'];
const topY = () => shell.state.faces.top.querySelectorAll('[id="panel"]')[0].getAttribute('transform');

test('it sits in front of the tree, and shows one group for each adjustment, in id order', () => {
  assert.equal(aside.children[0], control.el);
  assert.equal(control.el.getAttribute('id'), 'positions');
  assert.equal(control.el.hidden, false);
  assert.deepEqual(control.el.children.map(g => g.getAttribute('data-adjustment')),
                   ['block-offset', 'panel-setback']);
});

test('a ranged adjustment has a labelled slider over its range, in steps of 0.1 mm', () => {
  const s = part('panel-setback', 'slider');
  assert.deepEqual([s.getAttribute('type'), s.getAttribute('min'), s.getAttribute('max'), s.getAttribute('step')],
                   ['range', '20', '180', '0.1']);
  assert.equal(s.value, '60');
  // named for a screen reader by the label of the adjustment, and described by its datum
  const label = part('panel-setback', 'lbl');
  assert.equal(label.textContent, 'Panel setback');
  assert.equal(s.getAttribute('aria-labelledby'), label.getAttribute('id'));
  assert.equal(group('panel-setback').getAttribute('aria-labelledby'), label.getAttribute('id'));
  assert.equal(s.getAttribute('aria-describedby'), part('panel-setback', 'datum').getAttribute('id'));
  assert.equal(s.getAttribute('aria-valuetext'), '60 mm');
  assert.equal(part('panel-setback', 'datum').textContent, '20 to 180 mm: the front face of the panel');
  assert.equal(part('panel-setback', 'val').textContent, '60 mm');
  const n = part('panel-setback', 'number');
  assert.deepEqual([n.getAttribute('type'), n.value, n.getAttribute('aria-label')],
                   ['number', '60', 'Panel setback, mm']);
});

test('one button for each stop, in order of position, and none pressed off a stop', () => {
  const names = group('panel-setback').querySelectorAll('[data-stop]').map(b => b.getAttribute('data-stop'));
  assert.deepEqual(names, ['front', 'middle', 'rear']);
  assert.equal(stop('panel-setback', 'middle').textContent, 'middle');
  assert.equal(stop('panel-setback', 'middle').getAttribute('title'), '100 mm');
  for (const n of names) assert.equal(stop('panel-setback', n).getAttribute('aria-pressed'), 'false');
  assert.equal(stop('panel-setback', 'front').getAttribute('type'), 'button');
});

test('with stops and no range, the buttons are the whole control', () => {
  assert.equal(part('block-offset', 'slider'), undefined);
  assert.equal(part('block-offset', 'number'), undefined);
  assert.deepEqual(group('block-offset').querySelectorAll('[data-stop]').map(b => b.getAttribute('data-stop')),
                   ['inner', 'outer']);
  assert.equal(stop('block-offset', 'inner').getAttribute('aria-pressed'), 'true');
  assert.equal(part('block-offset', 'val').textContent, '30 mm (inner)');
  assert.equal(part('block-offset', 'datum').textContent, 'the left edge of the block');
  stop('block-offset', 'outer').onclick();
  assert.equal(shell.state.cfgFields.block['block-offset'], '90');
  assert.equal(stop('block-offset', 'outer').getAttribute('aria-pressed'), 'true');
  assert.equal(stop('block-offset', 'inner').getAttribute('aria-pressed'), 'false');
  part('block-offset', 'reset').onclick();
  assert.equal(shell.state.cfgFields.block, undefined);
});

test('nothing is held, and the reset has nothing to do, until a position is set', () => {
  assert.equal(held(), undefined);
  assert.equal(part('panel-setback', 'reset').disabled, true);
  assert.equal(part('panel-setback', 'msg').textContent, '');
});

test('the line for a refusal is in the page before it has anything to say', () => {
  // a live region that is hidden until its text arrives is not reliably
  // announced: the empty one is there, and no rule takes it out of the page
  const msg = part('panel-setback', 'msg');
  assert.equal(msg.textContent, '');
  assert.equal(msg.getAttribute('role'), 'status');
  assert.equal(msg.hidden, false);
  assert.equal(msg.hasAttribute('aria-hidden'), false);
  const css = document.head.children.map(n => n.textContent).find(t => t.includes('#positions'));
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => sel.includes('.msg'));
  assert.ok(rules.length >= 2, 'the rules of the line were read');
  for (const [, sel, body] of rules)
    assert.doesNotMatch(body, /display\s*:\s*none|visibility\s*:\s*hidden/, sel.trim());
  // empty, it takes no room: no text and no margin
  const empty = rules.find(([, sel]) => sel.includes('.msg:empty'));
  assert.match(empty[2], /margin-top\s*:\s*0\s*;/);
});

test('a stop button writes through setFields: the name is sent, the number is kept and every face moves', () => {
  const events = [];
  shell.on('fields', e => events.push(e.path));
  // what the button hands the shell is the NAME of the stop, not its number
  const sent = [];
  const real = shell.setFields;
  shell.setFields = (...a) => { sent.push(a); return real(...a); };
  try { stop('panel-setback', 'rear').onclick(); } finally { shell.setFields = real; }
  assert.deepEqual(sent, [['panel', {'panel-setback': 'rear'}]]);
  assert.equal(held(), '180');
  assert.deepEqual(events, ['panel']);
  assert.equal(topY(), 'translate(0 -120)');
  assert.equal(shell.state.svg.querySelectorAll('[id="panel"]')[0].getAttribute('data-depth'), '180');
  // the control says where it stands, and the link carries it
  assert.equal(part('panel-setback', 'val').textContent, '180 mm (rear)');
  assert.equal(part('panel-setback', 'slider').value, '180');
  assert.equal(part('panel-setback', 'slider').getAttribute('aria-valuetext'), '180 mm (rear)');
  assert.equal(part('panel-setback', 'number').value, '180');
  assert.equal(stop('panel-setback', 'rear').getAttribute('aria-pressed'), 'true');
  assert.equal(stop('panel-setback', 'front').getAttribute('aria-pressed'), 'false');
  assert.equal(part('panel-setback', 'reset').disabled, false);
  assert.equal(encodeFields(shell.state.cfgFields), 'panel~panel-setback~180');
});

test('the slider writes each value as it moves in 2D, and the groups are not rebuilt under it', () => {
  const s = part('panel-setback', 'slider');
  s.value = '75.3';
  s.oninput();
  assert.equal(held(), '75.3');
  assert.equal(topY(), 'translate(0 -15.3)');
  assert.equal(part('panel-setback', 'slider'), s);          // the same node: a drag survives
  assert.equal(part('panel-setback', 'val').textContent, '75.3 mm');
  s.value = '100';
  s.onchange();
  assert.equal(held(), '100');
  assert.equal(part('panel-setback', 'val').textContent, '100 mm (middle)');
  assert.equal(stop('panel-setback', 'middle').getAttribute('aria-pressed'), 'true');
});

test('the number box takes a typed value in the one spelling', () => {
  const n = part('panel-setback', 'number');
  n.value = '120.04';
  n.onchange();
  assert.equal(held(), '120');
  assert.equal(n.value, '120');
  assert.equal(part('panel-setback', 'slider').value, '120');
});

for (const [typed, reason] of [
  ['300', 'panel-setback on SLIDER takes 20 to 180 mm. 300 is outside it.'],
  ['-20', 'panel-setback on SLIDER takes a number in mm written with digits and a point only. -20 is not.'],
  ['back', 'panel-setback on SLIDER takes a number in mm, or one of: front, middle, rear.'],
]) test(`a refused value (${typed}) shows its sentence, and the drawing and the box stay`, () => {
  stop('panel-setback', 'middle').onclick();
  const n = part('panel-setback', 'number');
  n.value = typed;
  n.onchange();
  assert.equal(held(), '100');
  assert.equal(topY(), 'translate(0 -40)');
  assert.equal(n.value, '100');
  const msg = part('panel-setback', 'msg');
  assert.equal(msg.textContent, reason);
  // said to a screen reader without taking the focus
  assert.deepEqual([msg.getAttribute('role'), msg.getAttribute('aria-live')], ['status', 'polite']);
  // and it goes when the next value is taken
  stop('panel-setback', 'front').onclick();
  assert.equal(part('panel-setback', 'msg').textContent, '');
});

test('the reset puts the drawing back as built and keeps nothing', () => {
  stop('panel-setback', 'rear').onclick();
  part('panel-setback', 'reset').onclick();
  assert.equal(shell.state.cfgFields.panel, undefined);
  assert.equal(encodeFields(shell.state.cfgFields), '');
  assert.equal(topY(), null);
  assert.equal(part('panel-setback', 'val').textContent, '60 mm');
  assert.equal(part('panel-setback', 'reset').disabled, true);
  assert.equal(part('panel-setback', 'reset').title,
               'back to where the drawing was built, 60 mm');
});

test('a position set elsewhere (a link, a host) is shown', () => {
  shell.setFields('panel', {'panel-setback': 'front'});
  assert.equal(part('panel-setback', 'val').textContent, '20 mm (front)');
  assert.equal(part('panel-setback', 'slider').value, '20');
  shell.resetField('panel', 'panel-setback');
  assert.equal(part('panel-setback', 'val').textContent, '60 mm');
});

test('a view that cannot show the motion says which views do', async () => {
  // the front shows a move along the depth as nothing; the plan and the side do
  assert.equal(shell.state.view, 'front');
  assert.equal(part('panel-setback', 'note').textContent,
               'The front view does not show this. See the top or right view, or 3D.');
  // the block slides across the front, which shows it
  assert.equal(part('block-offset', 'note').textContent, '');
  threeD = false;                 // a page with no 3D to offer does not point at it
  control.refresh();
  assert.equal(part('panel-setback', 'note').textContent,
               'The front view does not show this. See the top or right view.');
  threeD = true;
  shell.state.view = 'rear';
  await shell.loadStage();
  assert.equal(part('panel-setback', 'note').textContent,
               'The rear view does not show this. See the top or right view, or 3D.');
  // no face shows the block from the rear here but the front
  assert.equal(part('block-offset', 'note').textContent,
               'The rear view does not show this. See the front view, or 3D.');
  shell.state.view = 'top';
  await shell.loadStage();
  assert.equal(part('panel-setback', 'note').textContent, '');
});

test('in 3D every face is on screen: no line, and a dragged slider is applied when let go', async () => {
  shell.state.view = 'front';
  await shell.loadStage();
  shell.emit('mode', '3d');
  assert.equal(part('panel-setback', 'note').textContent, '');
  const s = part('panel-setback', 'slider');
  s.value = '140';
  s.oninput();
  assert.equal(held(), undefined);                                 // not written while dragged
  assert.equal(part('panel-setback', 'val').textContent, '140 mm');   // and the number follows
  assert.equal(part('panel-setback', 'number').value, '140');
  s.onchange();
  assert.equal(held(), '140');
  shell.emit('mode', '2d');
  assert.equal(part('panel-setback', 'note').textContent,
               'The front view does not show this. See the top or right view, or 3D.');
  part('panel-setback', 'reset').onclick();
});

test('a configuration built moved starts the control where it was built', async () => {
  shell.el.cfg.value = 'back';
  shell.state.cfg = 'back';
  await shell.loadStage();
  await settle(); await settle();
  assert.equal(part('panel-setback', 'val').textContent, '180 mm (rear)');
  assert.equal(part('panel-setback', 'slider').value, '180');
  assert.equal(part('panel-setback', 'reset').title,
               'back to where the drawing was built, 180 mm');
  shell.state.cfg = 'base';
  await shell.loadStage();
  assert.equal(part('panel-setback', 'val').textContent, '60 mm');
});

test('a device that declares no adjustment gets no control', async () => {
  // the faces the last test asked for have arrived: nothing is on its way
  // when the device is left, which is how a reader leaves one
  await settle(); await settle();
  await shell.loadDevice('plain');
  assert.equal(control.el.hidden, true);
  assert.equal(control.el.children.length, 0);
  await shell.loadDevice('slider');
  assert.equal(control.el.hidden, false);
  assert.equal(control.el.children.length, 2);
  // AND BACK, THE LINE STILL NAMES THE VIEWS. The shell let the other faces go
  // on the way; the control asks for them again, though the device and the
  // configuration are the ones it asked about before.
  await settle(); await settle();
  assert.deepEqual(Object.keys(shell.state.faces).sort(), [...VIEWS].sort());
  assert.equal(part('panel-setback', 'note').textContent,
               'The front view does not show this. See the top or right view, or 3D.');
});

test('inside a module there is no control, and it is back on the way out', async () => {
  // the stand-in page parses no markup: the crumb answers the shell with a
  // button of its own, which is the way out of the module
  shell.el.crumb.byQuery = {};
  shell.openModule('fixture/slide-well@1');
  // the module is opened and its drawing not yet loaded: the face the shell
  // holds is still the one of the device, and the control does not read it
  assert.equal(shell.state.module, 'fixture/slide-well@1');
  assert.ok(shell.state.svg.hasAttribute('data-adjustments'));
  control.refresh();
  assert.equal(control.el.hidden, true);
  assert.equal(control.el.children.length, 0);
  await settle(); await settle();
  assert.equal(shell.state.svg.getAttribute('data-src'), 'well');
  assert.equal(control.el.hidden, true);
  shell.el.crumb.querySelector('#back').onclick();
  await settle(); await settle();
  assert.equal(shell.state.module, null);
  assert.equal(control.el.hidden, false);
  assert.equal(control.el.children.length, 2);
});
