### Added
- **An extra library on top of Portrayal's own: an overlay** (P-0043).
  `build.sh --overlay-library DIR --overlay-out DIR` lints the overlay's files,
  renders its devices against the public components plus the overlay's own,
  and writes `devices.json`, `components.json`, each device's `configs.json`
  and faces, and `rack.json` to the out folder only; `library/dist` is the
  same bytes with and without an overlay. It is how a downstream project keeps
  its own devices without forking Portrayal. An overlay adds and never
  replaces: a device name, a device folder, a part ref or a listing the public
  library already has is refused before anything is drawn, naming both files
  (`overlay.py check`). `lint.py` takes `--only-root`, and `devicelock.py`
  takes `--below`, so an overlay's devices are held to every rule and its lock
  counts the public parts they seat. The kit reads a list of dist roots
  where it read one: `loadSlots([publicDist, overlayDist], refs)`,
  `loadCatalog([...])`, and `dist: [...]` for `createShell` and
  `createViewer` (`kit/dist.js` `layeredDist` and `readIndex`), and
  `kit/index.html?overlay=<path>` loads one in the explorer. A later root adds
  devices and parts, and an id in two roots is an error naming both, never a
  replacement. `spec/tests/fixtures/overlay-example/` is one made-up device,
  `example/overlay-switch`, built only from public parts, that the tests
  build. `@portrayal/kit` takes the next minor version at merge time.
