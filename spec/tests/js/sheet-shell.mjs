// A sheet body (spec/tests/test_sheet_shell_js.py): viewer3d asks relief.js
// whether a chassis is sheet metal, and draws nothing from its six faces when
// it is. An index written before the key existed has no `shell`, and one from
// a newer build may carry a value this kit does not know - both are a box.
globalThis.location = { search: '' };
globalThis.fetch = async () => ({ ok: true, text: async () => '<svg/>' });
globalThis.CSS = {escape: s => s};
const m = await import('../../../kit/relief.js');
console.log(JSON.stringify({
  sheet: m.sheetShell({shell: 'sheet', thickness: 1.5}),
  box: m.sheetShell({mount: 'rack'}),
  unknown: m.sheetShell({shell: 'lattice', thickness: 2}),
  missing: m.sheetShell(undefined),
  // a well in a sheet body: the tray floor, and nothing round it
  sheetWell: m.cavityShell({d: 42, sheet: true}, 44),
  sheetWellDeep: m.cavityShell({d: 60, sheet: true}, 44),
  boxWell: m.cavityShell({d: 42}, 44),
  // a passage through a sheet body, and an open bay's mouth in one: air
  sheetPassage: m.cavityShell({d: 249, sheet: true, seeThrough: true}, 250),
  sheetMouth: m.cavityShell({d: 37, sheet: true, hollow: true}, 250),
  boxPassage: m.cavityShell({d: 249, seeThrough: true}, 250),
  // a handle standing in a well starts at the well's floor
  standsOnFloor: m.standsFrom({lift: -42}),
  standsOnFace: m.standsFrom({}),
}));
