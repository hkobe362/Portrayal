### Changed
- **The DCIM cables files now hold the cables on a seated panel or cassette**
  (#1020, `kit/rack/dcim-rules.js`). A cable on a fibre port of a module in a
  bay (an adapter of a patch panel, the MTP of a cassette) was left out of
  both files, with a reason: the kit looked the port up under its part id
  (`{module}/lc01`), and a module type names it otherwise. It is now written
  under the names the module type lists. **This changes what the export
  holds; no type file is renamed or rewritten.** A duplex adapter on a front
  is two front ports, one a fibre (`bay-1/1` and `bay-1/2`); an adapter on a
  back is one rear port (`bay-1/B01-1`); a trunk connector is one rear port
  (`bay-2/MTP-1`). NetBox gets one row a cord, with both names in the name
  cell, separated by a comma. Nautobot gets one row a fibre where both ends
  have two ports, labelled `<label> (1/2)` and `<label> (2/2)`, and one row,
  to the first port, where the other end is a single port (an interface, a
  rear connector); the README names each port left without a cable. A rack
  with no cable on such a port exports the files it did, byte for byte.
- **A page passes the catalogue to get this.** `resolveEnd` takes `ports`
  (`fibrePorts(item, end, ctx)` from `rack/ports.js`), and `endResolver({
  rack, ctx, deviceOf, moduleAt, consolesOf })` builds the `resolve` that
  `cableImportRows` is handed, with it; `ctx` is the parts lists that
  function takes as `parts`. A page that calls `resolveEnd` as before gets
  the answers it got.

### Added
- **`optical.ports` in `components.json`**: for each fibre part of a module
  whose glass is projected, the front or rear ports of the module type that
  the part is, one name a position (`"lc01": {"front-ports": ["1", "2"]}`,
  `"rear:b01": {"rear-ports": ["B01-1", "B01-1"]}`). Written by the walk
  that writes the type file (`optical_ports.part_ports`), so the two cannot
  disagree. An added key: no export, lock or version moves.
- **`fibrePorts`** in `rack/ports.js` and **`endResolver`** in
  `rack/dcim-rules.js`. An answer of `resolveEnd` for a fibre port carries
  `names`, every port the end lands on.
