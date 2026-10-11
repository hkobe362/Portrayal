### Added
- Rack file version 4 (#935, #970, #949, #934, #939, #972), the build of
  `docs/rack-file-v4-design.md`, whose section 11 lists every one-way item
  and section 13 everything the build had to choose. It calls for a minor
  kit release. No import was tried on a running NetBox or Nautobot: each
  column was read against the import form at the commit the note cites.
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
- `states` and `readings` on an item and on a part beside the rack. The
  loader keeps a state that is a name for a part, drops any other and says
  so, and moves readings with no source or no time it can read to
  `readingsAsWritten`. `state.set` and `readings.set` write them, refused
  with what the part can be when the parts lists are loaded. The new
  `rack/states` module has `statesFor`, the map to hand a drawing with each
  outlet state carried to its lamps, `readingsFor` and `stateNotices`.
- A zero-U PDU hangs on brackets: `heldBy: {parts}` on its entry,
  `zerou.hang` to hang it or take it off, and the kit writes where it then
  stands. A bracket that moves carries what hangs on it; a held part is not
  moved by hand; one whose bracket is gone stays and is refused by fit.
  `fitsHang`, `hangNotices` and `bracketPositions` are in `rack/zero-u`.
  `zerou.update` takes `swaps` and `fields`.
- The lengths of a cable are named: path, need, stock, spare, end play and
  what is to store (`rack/route`: `needOf`, `shortTolerance`, `spareOf`,
  `END_PLAY_M`, `BREAK_TOL_M`, `UNPLACED_WARN_M`). A cable takes `slack`, a
  list of where its spare is stored, in a tray it rests on or at an end;
  `cable.slack` and `cable.slack.clear` write it, and the new `rack/slack`
  module resolves it and says it (`slackOf`, `storedText`, `slackFindings`,
  `spareLine`, `spareExports`). Spare is recorded and listed, not drawn,
  and the kit places none itself. `inspect` of a cable gives `slack` as
  `{metres, at_ends_m, said, stored, unplaced_m}` and `need` beside its
  length; `describe` gains one line for the rack.
- Straps have three kinds, and each entry `straps()` returns carries its
  `kind`: `spacing`, as before; `breakout`, one 25 mm from each point where a
  cable joins or leaves a bundle, on each side two or more still ride; and
  `anchor`, one at each tray tie slot a bundle or a single cable is tied at.
  A bundle `straps` takes `breakout` and `anchors` beside `every`, and a
  cable takes `straps: {anchors}`; `bundle.update` merges the keys given and
  `cable.update` takes the cable key. `rack/bundles` gains `strapKinds`,
  `anchorsOf`, `strapTotals` and the breakout distances. Each strap also
  carries `width_mm`, one of `STRAP_WIDTHS_MM` (12, 19 and 25): 19, 25 for
  a pack 25 mm across or more, and the narrowest that fits in a tight gap.
- `cable.lay {id, at: {item, via}, position?, face?}` pins how a cable lies
  in a pathway, as `lay` on the cable. The routes act on `face` (`top` or
  `underside` of a tray, as the part names its own), reading the file
  before a page's own pin (`layFaceOf` in `rack/route`); `position` is kept
  for when lay order is built. `inspect` of a cable shows `lay`.
- `inspect` of a device whose height is no whole number of units carries
  `notes`, with the sentence that its ear holes are not checked.
- The exports of version 4. `strapTexts` in `rack/bundles` gives the cable
  schedule its `straps` column: the tray, the face by role and by name and
  the tie slots of a single cable. `spareBomLine` in `rack/slack` is the
  one BOM note that totals the spare, and `spareExports` carries it as
  `bom`; `cableBomNotes` and `drawioCables` take `{spare}`, and a draw.io
  edge label states the spare after the length ("1 m, 0.58 m spare"), the
  length attribute staying the length. Both device imports say in the
  comment that an item is mounted upside down or rotated a quarter turn
  (`rollNote`, which `mountNotes` writes too), what a PDU hangs on
  (`hungText` in `rack/zero-u`: "0U, on 2 FS-PDUBK brackets at left-rear,
  from U4"), and, when `deviceImportRows` is handed `statesOf`, what is set
  off (`offNote`: "Outlets off: outlet-a2, outlet-a7."). The NetBox outlet
  import takes no status column, so the states are a comment in both
  files. A reading is in neither.

### Changed
- **One-way: an older page refuses a version-4 rack file.** A version-3 file
  opens unchanged and is saved as version 4. The other one-way items, each
  under its own heading below or above: positions in halves in every
  export; where a body stands in its span; the stock sizes the 10 mm
  tolerance moves; `need` written where `measured` was; the Nautobot order
  and its comments; unknown keys kept; the strap kinds, widths and count
  and the wording of the BOM strap line; the hardware count; zero-U overlap
  in millimetres; the three schedule columns; the comments of a rolled
  item, of a PDU on brackets and of what is set off; `cable.lay` and the
  face of the file read before a page's pin; and the kit names a page
  calls, `span` among them, which is removed.
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
- **Stock sizes.** A cord up to 10 mm short of full end play is still
  chosen (`BREAK_TOL_M`), so a routed cord that was within 10 mm over a
  stock size drops to it at its next measure: 41 of 2,336 cords on the
  generated sample, each by one size, and none rises. A copper cord of 7 m
  or more may rise one, since its short tolerance is now the greater of
  50 mm and 1 per cent of its length. No measured length moves.
- Beside a routed length the kit writes `need` and no longer writes
  `measured`, which a cable loses at its next measure.
  `END_ALLOWANCE_BY_MEDIA` holds what is inside the port alone (copper 9.5
  mm where it was 34.5, DAC 0 where it was 25), `endAllowance` and the
  `allowance` of a path are that figure without the 0.1 m of dressing, and
  `stockLength` takes the need, with `{values}`. `pathLength` still answers
  `measured`, now the need and the end play, and adds `need`.
- **The BOM strap count rises.** A bundle with spacing straps gains its
  breakout straps (a strap before each point where a cable leaves: one in
  each gap between cables that leave a unit apart, and one each side of a
  peel point at two units and over, unless a spacing strap already serves)
  and an anchor at each tray with tie slots its trunk lies on. A single cable lying on such a tray is tied at
  one slot, shared by every cable there: about three or four straps a lacer
  tray on a full rack, where there were none. A bundle saved with
  `every: null` still has no strap of any kind. The strap line of the BOM
  is reworded on every rack that has one: it says how many of each kind and
  of each width, and ends "length to suit". A bundle's note gives the kinds.
- **For a page that calls the kit.** `straps().count` is every kind
  together; the spacing straps alone are `straps().kinds.spacing`.
  `strapBomRows(bundles)` counts the straps of single cables only when it
  is handed `{anchors: anchorsOf(rack, ctx)}`. `END_ALLOWANCE_BY_MEDIA` and
  `endAllowance` no longer carry the 0.1 m of dressing: a page that took
  the dressing as `endAllowance` less the table now gets 0. The end play is
  `END_PLAY_M`, and `spareOf(rack, cable, ctx)` gives every length of a
  cable. `pathLength().measured` is unchanged in value.
- **The cable schedule gains three columns, a download-format change:**
  `spare`, `stored` and `straps`, appended after `notes`, so no column read
  by position moves. A reader that checks the column count has to take 20
  where there were 17.
- The slack `inspect` gives for an entered length is the spare, which is
  0.2 m more than it read: the end play is now spare and not need.
- Zero-U overlap is judged in millimetres. A part the kit placed at a whole
  unit overlaps as before; one whose `offsetMm` is between units is judged
  where it is, where it was rounded to a unit, and a frame change no longer
  moves it to one.
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
