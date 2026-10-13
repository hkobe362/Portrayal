// spec/tests/js/rack-manager-depth.mjs
// WHERE A HORIZONTAL MANAGER STANDS IN DEPTH (P-0015): the kit puts the front of
// a rack device on the rail plane unless the catalogue entry states
// `ears.default.at` (fit.js setbackOf). rack_index.py writes that from the part's
// `chassis.ears.positions`, so a dual-sided duct spans the rail and a ring
// manager stands in front of it. Reads the build's rack.json, as the Rack
// Builder does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as M from '../../../kit/rack/model.js';
import * as F from '../../../kit/rack/fit.js';

const BUILT = new URL('../../../library/dist/rack.json', import.meta.url);
const skip = existsSync(BUILT) ? false : 'library/dist not built - run ./build.sh';
const devices = skip ? {} : JSON.parse(readFileSync(BUILT, 'utf8')).devices;
const chassisOf = ref => devices[ref] || null;

// mm in front of the rail plane, and mm behind it, of a part placed on its own
function reach(ref) {
  const rack = {...M.newRack(), frame: M.normalizeFrame({kind: 'four-post', heightRU: 42})};
  const item = M.withItem(rack, {ref, cfg: '', ru: 10, label: ref}).rack.items[0];
  const setback = F.setbackOf(rack, item, chassisOf);
  return {front: -setback, behind: F.reachOf(rack, item, chassisOf)};
}
const near = (got, want) => assert.ok(Math.abs(got - want) < 0.05, `${got} is not ${want}`);

test('CMH-DFD1U, a dual-sided duct, spans the rail: 75.7 mm in front and 98.3 behind', {skip}, () => {
  const r = reach('cmh-dfd1u');
  near(r.front, 75.7);
  near(r.behind, 98.3);
});

test('CMH-5DR1U, a ring manager, stands in front of the rail: 85.5 mm in front, 12.2 behind', {skip}, () => {
  const r = reach('cmh-5dr1u');
  near(r.front, 85.5);
  near(r.behind, 12.2);
});

test('CMH-4DRB1U states no recess, so it keeps the default and stands wholly behind the rail', {skip}, () => {
  const r = reach('cmh-4drb1u');
  near(r.front, 0);
  near(r.behind, devices['cmh-4drb1u'].d);
});
