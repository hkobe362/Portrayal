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
- A frame takes `startU`, the number of its first unit: every label counts
  from it. Neither DCIM import takes a starting unit, so both device files
  keep positions counted from 1 and each comment gives the label on the
  rack. The NetBox rack row keeps its six columns; a rack that numbers from
  another unit, or states a width NetBox does not take, gains a `comments`
  column saying so, and a width of 10, 21 or 23 is written where 19 was. `holes.style: round` is said in `describe` and the
  sheet, and counted as square holes are, with a note.
- `setback` on a frame and on an item, in mm behind the rail: found in the
  order item, default ear position of the device, frame, flush
  (`setbackOf` in `rack/fit`); fitted against the usable depth and the other
  face; followed by the kit solids and by routed lengths. `patch` and `frame`
  take it; a larger one is checked and a smaller one never refused.
- A frame keeps `width` and `options`, a zero-U entry keeps `channel`, and
  an item keeps `heldBy`. An item held by another moves with it, is not
  checked, and is exported with no position and a comment; a held item is
  not moved by hand, and none can be placed until the catalogue describes
  what holds one. `frameNotices` in `rack/fit` says what is kept and not yet
  acted on, and the editor gives it on load.
- `<device>.configs.json` gains two keys on each configuration, beside
  `mount-points`: `slots`, each slot it offers a hanging part as
  `{interface, at}`, and `states`, what each placed part can be set to as
  `{<placement id>: [names]}`. Both are derived, both additive, and
  `contract` is still 2. `states` lists what a part itself can be set to,
  not its lamps: the EVMA8365X lists its 42 switchable outlets; the
  EVMI2130X, which switches nothing, lists none. No part in
  the library offers a slot yet. `rack/catalog` `loadSlots` keeps the
  `pdu-class` of a device, and `configFacts` and `meteringOf` read what a
  rack entry will be checked against.
- `roll` on an item: 90, 180 or 270 degrees clockwise as it is seen from the
  face it is on. `patch` takes it and refuses it where the rolled box does
  not fit. Rolled 180 an item is the same box turned over: its solids, its
  trays (the floor looks down and the rings hang) and its guides are turned
  with it, and a route takes the ring that is nearest as mounted. Rolled a
  quarter turn it takes its width in whole units up the rack, and is an
  outline with no tray or ring until its mounting is described. `rack/fit`
  gains `facePoint`, `rollPoint` and `itemUnits`. A routing context still
  gives each port and guide where an upright item would hold it; the kit
  turns it.

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
