// spec/tests/js/rack-half-unit-nautobot.mjs
// NAUTOBOT AND A HALF POSITION (docs/rack-file-v4-design.md section 2.7,
// decision 7): Nautobot stores whole rack units, so of two devices in one
// unit the lower stored one is positioned and the other is kept in the rack
// with no position and a comment.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../kit/rack/model.js';
import * as F from '../../../kit/rack/fit.js';
import * as X from '../../../kit/rack/export-data.js';

const SIZES = {
  xcu: {ru: 0.5, w: 482.6, h: 22.2, d: 284, model: 'XCU10'},
  'tm-7124s': {ru: 1.5, w: 440, h: 66, d: 300, model: 'TM-7124S'},
  mx104: {ru: 3.5, w: 441, h: 155, d: 241, model: 'MX104'},
  qfx: {ru: 1, w: 440, h: 43.6, d: 520, model: 'QFX5120-48Y'},
  r2: {ru: 2, w: 440, h: 87, d: 700, model: 'R2'},
};
const chassisOf = ref => SIZES[ref] || null;
const rackOf = (heightRU = 42, numbering = 'bottom-up') =>
  ({...M.newRack(), frame: M.normalizeFrame({kind: 'four-post', heightRU, numbering})});
const put = (rack, ref, ru, extra = {}) => M.withItem(rack, {ref, cfg: '', ru, label: extra.label ?? SIZES[ref]?.model ?? ref, ...extra}).rack;
const TYPE = {manufacturer: 'Fibrain', model: 'XCU10-21IC', isFullDepth: false, guess: false};
const panels = numbering => {
  const r = {...put(put(rackOf(42, numbering), 'xcu', 12, {label: 'ODF A'}), 'xcu', 12.5, {label: 'ODF B'}), name: 'R1'};
  return {rack: r, items: F.itemsWithU(r, chassisOf), types: new Map([['i1', TYPE], ['i2', TYPE]])};
};

test('Nautobot stores whole units: the lower panel is positioned, the other kept with a comment', () => {
  const rows = n => X.deviceImportRows({...panels(n), target: 'nautobot'}).rows.map(r => [r.name, r.position, r.face, r.comments]);
  assert.deepEqual(rows('bottom-up'), [
    ['ODF B', '', '', 'In the upper half of U12, above ODF A; no position, since Nautobot stores whole rack units.'],
    ['ODF A', 12, 'front', 'Occupies the lower half of U12 (0.5U). Nautobot stores whole rack units.']]);
  // top-down: both have floor(p) 31, and the one stored at ru 12 is written there
  assert.deepEqual(rows('top-down'), [
    ['ODF B', '', '', 'In the upper half of U31, above ODF A; no position, since Nautobot stores whole rack units.'],
    ['ODF A', 31, 'front', 'Occupies the lower half of U31 (0.5U). Nautobot stores whole rack units.']]);
  assert.equal(X.deviceImportRows({...panels('bottom-up'), target: 'nautobot'}).left.length, 0, 'no device is lost');
});

test('Nautobot: a panel alone, a front and rear pair, and a whole-unit rack as before', () => {
  const T = new Map(['i1', 'i2', 'i3', 'i4'].map(id => [id, TYPE]));
  const rows = r => X.deviceImportRows({rack: {...r, name: 'R1'}, items: F.itemsWithU(r, chassisOf), types: T, target: 'nautobot'})
    .rows.map(x => [x.name, x.position, x.face, x.comments]);
  // the upper half alone is written at its unit, and says which half
  assert.deepEqual(rows(put(rackOf(), 'xcu', 12.5, {label: 'ODF B'})),
    [['ODF B', 12, 'front', 'Occupies the upper half of U12 (0.5U). Nautobot stores whole rack units.']]);
  // front and rear are two faces: both are positioned
  assert.deepEqual(rows(put(put(rackOf(), 'xcu', 12, {label: 'F'}), 'xcu', 12.5, {label: 'B', face: 'rear'})).map(x => x.slice(0, 3)),
    [['B', 12, 'rear'], ['F', 12, 'front']]);
  // a 1.5U and a 3.5U item, and whole-unit devices, whose rows carry no such comment
  const mixed = put(put(put(put(rackOf(), 'tm-7124s', 1, {label: 'agg'}), 'mx104', 10, {label: 'pe'}), 'qfx', 20, {label: 'leaf'}), 'r2', 30, {label: 'srv'});
  assert.deepEqual(rows(mixed), [
    ['srv', 30, 'front', ''], ['leaf', 20, 'front', ''],
    ['pe', 10, 'front', 'Occupies U10 to U12 and the lower half of U13 (3.5U). Nautobot stores whole rack units.'],
    ['agg', 1, 'front', 'Occupies U1 and the lower half of U2 (1.5U). Nautobot stores whole rack units.']]);
  // the overlap the old fit allowed: the 1U item in U2 is kept with no position
  const over = put(put(rackOf(), 'tm-7124s', 1, {label: 'agg'}), 'qfx', 2, {label: 'leaf'});
  assert.deepEqual(rows(over)[0], ['leaf', '', '', 'In U2, above agg; no position, since Nautobot stores whole rack units.']);
});

test('fillText says which units an item fills, lower and upper as it hangs', () => {
  const up = M.normalizeFrame({heightRU: 42}), down = M.normalizeFrame({heightRU: 42, numbering: 'top-down'});
  assert.equal(F.fillText(up, 12, 0.5), 'the lower half of U12');
  assert.equal(F.fillText(up, 12.5, 0.5), 'the upper half of U12');
  assert.equal(F.fillText(down, 12, 0.5), 'the lower half of U31');
  assert.equal(F.fillText(up, 1, 1.5), 'U1 and the lower half of U2');
  assert.equal(F.fillText(up, 12.5, 1.5), 'the upper half of U12 and U13');
  assert.equal(F.fillText(up, 10, 3.5), 'U10 to U12 and the lower half of U13');
  assert.equal(F.fillText(down, 10, 3.5), 'U31 to U33 and the lower half of U30');
  assert.equal(F.fillText(up, 2, 1), 'U2');
  assert.equal(F.fillText(up, 2, 3), 'U2 to U4');
});
