### Added
- Rack file version 4, the format and half-unit positions (#935, #970), the
  first parts of the build of `docs/rack-file-v4-design.md`. On a held
  branch: nothing here is released until the whole version is.
  `kit/rack/model.js` reads and writes `version` 4 with an identity migration
  from 3, and the schema is `spec/schemas/rack.schema.json` under
  `/schemas/v3/`. An item `ru` is a number in steps of 0.5. A reader keeps a
  key it does not know on an item, the frame, a rack and the document, as it
  already did on a cable, a zero-U entry and a bundle.
- `rack/fit`: `unitsOf(chassis)`, `spanOf(item, chassisOf)` (half-open),
  `itemBox(rack, item, chassisOf)` and `spanText(frame, item, chassisOf)`.
  `rack/model`: `uText(frame, ru, units)`. `rack/rails`: `holesIn(lo, hi)`.
  The other new exports of these modules are the kit's own and are listed as
  such in `kit/README.md`.

### Changed
- **One-way: an older page refuses a version-4 rack file.** A version-3 file
  opens unchanged and is saved as version 4.
- Fit judges half units. A 1U item is refused over the top half of a 1.5U or
  3.5U item, where it was allowed; a rack opened with such a pair keeps both
  and says so. A device of a whole number of units is refused at a half
  position. `shrinkRack` packs by the top edge and never writes a position a
  saved file cannot hold.
- `heightOf` and the `u` of `itemsWithU` return 0.5 for a half-unit device,
  where they returned 1. `freeUs` returns half positions for a device that
  may start on one. `positionOf` returns a number in steps of 0.5. `place`
  and `move` take `ru` in steps of 0.5.
- A body that is not as tall as its span is centred in it in the kit solids,
  where it stood on the bottom: 210 of 230 rack devices move by a millimetre
  or less, sixteen rise by up to 6.35 mm and four ducts drop by up to 6.7 mm.
  A routed length that touches one moves by under a millimetre, and a cord
  that sat within that of a stock break changes size.
- Exports: a NetBox device row, the cable schedule `a_u` and `b_u` and the
  draw.io unit carry a half position. A Nautobot device row is written at
  the whole unit, with a comment saying which part of it the device fills;
  the second of two devices in one unit on one face is written with no
  position and no face, and its comment says where it is. The mounting
  hardware count is 4 a unit with no floor of one unit: 2 for a half-unit
  panel, and unchanged for every other device.

### Removed
- `span` from `rack/fit`. It returned the closed whole-unit pair
  `[ru, ru + u - 1]`, which cannot say half a unit. Use `spanOf`, which
  returns the half-open `[ru, ru + units)`.
