# Rack file version 4: one version for everything held back

Status: proposed 2026-10-11, nothing built. Issues #935 (the scope, decided
2026-10-10), #970, #949 (step 4), #934, #939, #972, with #983, #986, #1007,
#966 and #908 read beside them. Each section ends in a recommendation; the
questions that need a person are gathered in section 10, and everything else
is settled here and says so.

Builds on the rack file as it stands (`kit/rack/model.js`, `VERSION` 3,
`spec/schemas/rack.schema.json` under `/schemas/v2/`), and on four notes that
each left keys waiting for this version:
[rack-products-design.md](rack-products-design.md) section 9,
[cable-lay-design.md](cable-lay-design.md) sections 5 and 7,
[pdu-model-design.md](pdu-model-design.md) sections 3 and 6, and
[adjustable-positions-design.md](adjustable-positions-design.md) section 8.
[format-stability.md](format-stability.md) has the rules a version follows.

Three words are used one way throughout. **Read** means read in a file of this
repository or in an upstream file at a named commit. **Measured** means run or
computed for this note. **Inferred** means reasoned from those, and not checked
against hardware.

## 1. What version 4 is, and is not

Decided 2026-10-10: rack file version 4 is **one version, from one design pass
and one build pull request**, not a bump per feature. A rack file version is a
one-way door (an older page refuses the file), so every key that needs the
door goes through it together.

**It is** the keys below, a schema published under `/schemas/v3/` (the next
unused label; a label is never reused), an identity migration from 3, and a
reader that acts on each key or holds it safely.

**It is not** a new document shape. A version-3 file is a valid version-4
file, byte for byte apart from the number. Rows of racks, a room, and anything
that needs a second rack in one drawing stay out (section 12).

**Adjustable positions (#950) need no rack key.** A position is a field value,
and a rack item already carries `fields`. Version 4 only gives a zero-U entry
its own `fields` (section 4), which lets an adjustable zero-U part be set the
same way.

### 1.1 Every key of version 4

| key | on | from | what version 4 does with it |
|---|---|---|---|
| `ru` in steps of 0.5 | item | section 2 | read, fitted, drawn, exported |
| `roll` (`90`, `180`, `270`) | item | section 6 | read, fitted by the rolled box; `180` drawn and routed; quarter turns drawn as an outline until #550 |
| `states`, `readings` | item, zero-U entry | section 4 | read, checked against the catalogue, applied, exported |
| `swaps`, `fields` | zero-U entry | section 4 | read and applied, as on an item |
| `heldBy` `{parts}` | zero-U entry | section 5 | read, fitted, exported |
| `slack` | cable | section 3 | read, placed, measured, exported |
| `lay` | cable | section 3.7 | `face` is acted on; `position` is kept, and read when lay order is built |
| `straps` (`breakout`, `anchors`) | bundle, cable | section 3.8 | defined in the schema; needs no bump of its own |
| `heldBy` `{item, at, x, z, turn}` | item | rack products, 7.2 | read and kept; fit refuses what it cannot yet judge (section 7) |
| `setback` | frame, item | rack products, 8 | read, fitted, used by routes |
| `channel` | zero-U entry | rack products, 3 | read; overlap judged per channel |
| `width`, `startU`, `holes.style: round`, `options` | frame | rack products, 9 | read and kept; `startU` moves labels and exported positions |

The last four rows are the rack products keys. The 2026-10-10 scope names
five features and does not repeat them, but the decision of 2026-10-09 put
them in version 4 and the setback record on #908 says they ship with it. This
note reads the two together: they ride. It is listed as decision 1 only
because the two lists differ on their face.

### 1.2 Two changes to the reader that every key relies on

Read in `model.js`: `readItem` rebuilds an item from a fixed list of keys and
`normalizeFrame` does the same for the frame, so a key neither knows is
dropped on load and erased on the next save. `readCables` and `readZeroU`
keep what they do not know. That difference is why three of the five bumps so
far were needed.

**Settled here:** from version 4, `readItem` and `normalizeFrame` keep keys
they do not know, as `readCables` does. The keys they know are still
normalised. A later optional key that is safe to ignore then needs no bump
(the `side` precedent of #926); a key that is unsafe to ignore still does.

**Settled here:** `kit/rack/validate.js` gains the `multipleOf` keyword, since
the schema needs it for `ru` and the validator covers only the keywords the
schema uses.

## 2. Half-U positions (#970)

### 2.1 What the Fibrain XCU10 is

Read, in `library/devices/fibrain/xcu/device.yaml` and the datasheet it names
(`DSH_XCU00_EN` rev 1.1, modified 05.07.2024, two pages):

- The datasheet title is "Fibrain extendable Patch panel HD 0.5U for 48
  splices". Its description says height 0.5U; its specification table gives
  height 0.5U, width 19 in, depth 284 mm, powder painted steel. Those four
  rows are the whole table.
- The manifest states `chassis.ru: 0.5` and `height: 22.2`, and its
  provenance says 22.2 is half of 44.45, the figure a sibling sheet prints
  beside its own 0.5U.
- The manifest states no `chassis.ears`, and its `handles-and-ears` gap says
  the ears are real and not drawn, because no held image is square to them.
- The NetBox exports state `u_height: 0.5`. The Nautobot exports state
  `u_height: 1.0`, on purpose: `for_target` in
  `spec/tools/portrayal/dcim_export.py` rounds a fractional height up for
  Nautobot and adds the comment line "Occupies 0.5U. Nautobot stores whole
  rack units, so this type states 1."

What the source does **not** say: how the panel bolts to the rail, how many
holes or slots an ear has and at what height, whether two panels may share a
unit, and whether anything goes between them. It publishes no drawing and no
installation guide.

Inferred, and marked as such wherever it is used:

- **It is a 0.5U unit on its own ears, not a 1U enclosure.** The vendor sells
  a separate 1U extendable sibling, the body is 22.2 mm high, and the three
  quarter renders show an integral ear tab the height of the body with one
  elongated slot a side. One slot and its direction are read off renders that
  are not square to the ear, so neither is a measurement.
- **Two stacked in one unit is the point of the product,** since half a unit
  of height has no other use on a rail. Nothing held says so in words.
- **Side by side is not possible:** the face is 19 in wide.

So the device is right as modelled, its height needs no fix, and the fault
reported in #970 is in the Rack Builder and the rack file.

### 2.2 What the kit does today

Measured, by running `fits` from `kit/rack/fit.js` on a 42U four-post frame:

| case | answer today | right answer |
|---|---|---|
| a 0.5U item at U20, then a second 0.5U item at U20 | refused, "Taken by" | allowed in the other half |
| a 1U item at U2, over a 1.5U item at U1 | allowed | refused: the 1.5U item fills half of U2 |
| a 1U item at U13, over a 3.5U item at U10 | allowed | refused |

Read: every height in the kit is `Math.max(1, chassis.ru)` and every span is
the closed whole-unit range `[ru, ru + u - 1]` (`fit.js` `span`, `fits`,
`fitsRackFace`, `heightOf`, `shrinkRack`; `managers.js` `unitsOf`;
`export-data.js` `overlaps`, `uOfItem`, `drawioU`, `hardwareRows`). A 0.5U
device is therefore a 1U device, and a 1.5U device has a top of `ru + 0.5`,
which a closed whole-unit test never meets. Three catalogue devices state a
height that is not a whole number: the XCU10 (0.5), the BATM TM-7124S (1.5)
and the Juniper MX104 (3.5). The second and third rows of the table are a
fault in saved version-3 racks today, and version 4 fixes it with the first.

Read: the loader refuses a file whose item `ru` is not an integer
(`readItem`), the schema says `integer`, and the commands take an integer
(`RU` in `commands.js`).

Read: where a body shorter than its span is drawn is said three ways.
`kit/rack/solids.js` stands a box on the bottom of its unit
(`y0: (it.ru - 1) * RU`). `docs/cable-bundles-design.md` section 6 says the
face is drawn centred in the item span, and gives the formula the routing
context uses for a port. `route.js` `pointOf` and the fallback in `portPoint`
use the middle of the bottom unit. The report on #970 is those three meeting:
the 2D elevation centred the 22.2 mm face in a 44.45 mm span, and 3D stood it
on the bottom.

### 2.3 The position format

Three formats were weighed.

| | (a) `ru` in steps of 0.5 | (b) integer `ru` plus `half: lower \| upper` | (c) a millimetre offset |
|---|---|---|---|
| a 0.5U device in the upper half of U12 | `ru: 12.5` | `ru: 12, half: upper` | `ru: 12, offsetMm: 22.225` |
| a 1.5U device above it | `ru: 13` | `ru: 13` | `ru: 13` |
| a 1.5U device starting on a half | `ru: 12.5` | `ru: 12, half: upper` | as (a) with an offset |
| NetBox `position` | the same number on a bottom-up frame | computed from two keys | computed, and rounded |
| a reader that forgets the new part | cannot: there is one number | reads `ru` alone and overlaps two devices silently | the same |
| what an item carries | one key, as now | two keys that must agree | two keys, one in other units |
| `Number.isInteger(ru)` in old code | fails loudly | still passes | still passes |
| positions that meet no hole | steps of half a unit only | the same | any millimetre, most of them impossible |

**Against the DCIMs.** Read at netbox-community/netbox commit `84e19368`:
`netbox/dcim/models/devices.py` declares `DeviceType.u_height` and
`Device.position` as `DecimalField(max_digits=4, decimal_places=1)`, and both
`clean` methods refuse a value that is not a multiple of 0.5 ("U height must
be in increments of 0.5 rack units.", "Position must be in increments of 0.5
rack units."); `netbox/dcim/models/racks.py` builds a rack as a range of
half units (`drange(..., 0.5)` in `units`, `get_rack_units` and
`get_available_units`). So NetBox holds exactly format (a). Read at
nautobot/nautobot commit `c77e4255`: `nautobot/dcim/models/devices.py`
declares both `DeviceType.u_height` and `Device.position` as
`PositiveSmallIntegerField`, and `nautobot/dcim/models/racks.py` walks whole
units (`range(1, self.u_height + 1)`). Nautobot takes neither a fractional
height nor a fractional position, whatever the format here.

**Against the kit.** Every consumer needs a span and a box, not a key: fit and
collision, the elevation rows, the routing anchors and the exports all ask
"which half units does it fill" and "where is its body in millimetres". Under
(a) those come from one number and the device height. Under (b) every one of
them must remember a second key, and the one that forgets is the fault of
section 2.2 again, silently. Zero-U parts are untouched by all three: they
already stand at `offsetMm`.

**Against a height that is not 0.5.** A 1.5U device at U13 needs no new
position under any format; what it needs is a span that ends at 14.5 and not
at 13.5. That is a change to how spans are computed, and it is the same change
under (a), (b) and (c). Only (a) then lets the half unit above it be named
with the same key the device below uses.

**Format (c)** is what zero-U parts use and is right for them, since a duct
bracket bolts wherever the upright has a hole. For a rail item it says more
than the hardware allows: an item meets holes only at whole or half units
(2.5), and both DCIMs want units.

**Recommendation: (a).** `ru` stays the bottom of the item, counted bottom-up
from 1, and may be any multiple of 0.5 from 1. The schema says
`{"type": "number", "minimum": 1, "multipleOf": 0.5}`. It is the NetBox field,
it is the unit the library already writes heights in, and it is the only one
of the three that a careless reader cannot half read. Format (b) is the
smaller diff and keeps `ru` an integer for a consumer that only labels by it;
that is its one advantage, and the version gate already keeps such a consumer
away from a file it would misread.

```json
{"id": "i8", "ref": "xcu", "cfg": "XCU10-21IC", "label": "ODF A", "ru": 12,
 "face": "front", "turned": false, "swaps": {}, "fields": {}},
{"id": "i9", "ref": "xcu", "cfg": "XCU10-21IC", "label": "ODF B", "ru": 12.5,
 "face": "front", "turned": false, "swaps": {}, "fields": {}}
```

What stays whole: the frame `heightRU`, a lane waypoint `{lane, ru}` (a lane
point is the middle of a unit), a rack-face part and its `unit` on a host, and
a zero-U part (`offsetMm`, written as a whole number of units as today). A
rack-face part over an item that starts on a half takes
`unit = ru - floor(host.ru) + 1`.

### 2.4 Spans, and the one function that says where a body is

**Settled here.** Three functions in `kit/rack/fit.js` own the answers, and no
other file computes them:

- **`unitsOf(chassis)`** is the height in units: the stated `ru` rounded up to
  the next half, and never less than 0.5. A device with no `ru` is 1, as now.
- **`spanOf(item, chassisOf)`** is the half-open range `[ru, ru + units)`.
  Two spans overlap when each starts below the end of the other. `span` (the
  closed whole-unit pair) is removed; `heightOf`, `itemsWithU`, `shrinkRack`,
  `availableDepth`, `hostAt` and the export `overlaps` are rebuilt on it. With
  `roll: 90` or `270` the units are the rolled ones (section 6).
- **`itemBox(rack, item, chassisOf)`** is the body as mounted:
  `{y0, y1, h, lo, hi}`, millimetres above the bottom of the rails. `lo` and
  `hi` are the span edges, `(ru - 1) * RU` and `(ru - 1 + units) * RU`.

**The rule `itemBox` implements: a body is centred in its span.**
`y0 = lo + (hi - lo - h) / 2`. The reason is the rail: a rack panel is made a
little short of its units and its ears put it in the middle of them, so the
gap is shared above and below (an EIA-310 1U panel is 43.66 mm in a 44.45 mm
unit; that figure is from the standard as generally cited, not from a file
here). A body that states more height than its span (a duct cover) stands on
`lo`. With `unitsOf` right, the XCU10 is centred in a 22.225 mm span and the
2D and 3D pictures agree to 0.0125 mm.

Every reader of a height moves to it: `solids.js` (its `y0`), `route.js`
`pointOf` and the `portPoint` fallback (the middle of the box, not of the
bottom unit), the routing context formula for `portY` and for a guide box
(`y1` less the face `y`), the strap extents of the bundle note, and the two
site drawings. A test asserts that the site imports it and computes no `y`
from `ru` itself (section 9).

### 2.5 The rack holes

Read in `kit/rack/rails.js`: the holes of a unit are 6.35, 22.22 and 38.10 mm
above its bottom (`HOLE_DY`), so the spacing up a rail is 15.875, 15.875,
12.7, repeating. Measured from that:

- A half unit does **not** repeat the pattern. The lower half of a unit holds
  one usable hole, 6.35 mm above its own bottom. The upper half holds one,
  15.875 mm above its own bottom (38.1 less 22.225). The middle hole sits on
  the line between the two halves, and no ear 22.2 mm high can use it.
- So **one half-unit ear cannot serve both halves with a round hole**: it
  needs its hole 6.35 mm from the bottom in the lower half and 6.35 mm from
  the top in the upper half. A slot elongated up and down by 9.5 mm about the
  middle of the ear serves both, and so does turning the panel over
  (`roll: 180`, section 6). Which the XCU10 does is not known (2.1).
- A device of a **whole** number of units shifted by half a unit meets no
  hole: its ear holes land 28.575, 44.45 and 60.325 mm above the unit bottom,
  and the rail has holes at 22.225, 38.1, 50.8 and 66.675.
- A device 1.5 or 3.5 units high meets a different set of holes on a whole
  start than on a half start, so an ear made for one start fits only that one
  unless it is slotted.

**For fit:**

1. A position is a multiple of 0.5. Anything else is refused by the schema
   and the commands.
2. **A device whose height is a whole number of units is refused at a half
   position**, with a sentence: "QFX5120-48Y is 1U; its ears meet the rail
   holes only at a whole unit, and U12.5 is a half unit." The arithmetic above
   is the reason, and it holds for any ear on the standard pattern.
3. **A device whose height is not a whole number may start on a whole unit or
   on a half.** Whether its ears meet the holes there is checked only when the
   catalogue states its ear slot heights. No catalogue row does today, so in
   version 4 the check is silent and `inspect` says so once for such a device:
   "The ear holes of XCU10 are not stated, so its holes at U12.5 are not
   checked." When a slot height is stated and misses, it is a warning and not
   a refusal, since the slot length is rarely stated with it.
4. The top of the rack: `ru + units - 1 <= heightRU` becomes
   `ru + units <= heightRU + 1`.

**For the drawn ears.** Read: `spec/tools/portrayal/ears.py` plans a generic
ear with `units = max(1, floor(h / U + 0.5))` and spaces three slots across
each unit, and `kit/relief.js` does the same in 3D. For a 22.2 mm body that
is one unit squeezed to 22.2 mm with three slots 7.9 mm apart, which no rail
takes. **Settled here:** the slot heights of a generic ear come from the rail
pattern through one helper, `holesIn(lo, hi)` in `kit/rack/rails.js` (every
hole centre at least 3 mm inside the range), mirrored in `ears.py`. A
half-unit ear then has one slot, 6.35 mm up when the device is drawn alone
and wherever its half puts it when it is in a rack. This is a drawing change
in library tooling, not a rack-file change, so it is a follow-up issue beside
the version-4 pull request and not part of it; the Rack Builder draws the ears
of an item through `holesIn` from the start. Only the three devices of 2.2 are
affected, and the XCU10 draws no ears until its gap closes.

### 2.6 Labels and queries

- **`uText(frame, ru)`** names a position: "U12", "U12.5". `positionOf` is
  generalised to the lowest-numbered half unit the item fills, as NetBox
  defines a position: `ru` on a bottom-up frame, and
  `heightRU + 2 - (ru + units)` on a top-down one. That is the present
  formula with a fractional height, and it gives 31 for the physical upper
  half of the unit labelled 31 and 31.5 for the lower half, the order in
  which the NetBox `units` property lists a descending rack (read at the
  commit above; the half-unit labelling of a descending rack was not tried on
  a running instance, and the build does so).
- `fitsAt` and `freeUs` take and return half positions. `freeUs` lists whole
  positions for a whole-unit device and both for any other.
- `describe` and `inspect` print spans as "U12.5" or "U13-U14.5".
- The commands (`place`, `move`, `patch`, `side.place`) take `ru` as a number
  in steps of 0.5; a rack-face part is still refused a half.
- `shrinkRack` packs in half units.

### 2.7 What the exports write

For two XCU10 panels at `ru: 12` and `ru: 12.5` on a bottom-up frame:

| export | lower panel | upper panel |
|---|---|---|
| NetBox device rows | `position: 12` | `position: 12.5` |
| NetBox device type | `u_height: 0.5` (already so) | the same |
| Nautobot device type | `u_height: 1.0` with its comment (already so) | the same |
| Nautobot device rows | `position: 12`, comment "Occupies the lower half of U12 (0.5U). Nautobot stores whole rack units." | no position and no face, comment "In the upper half of U12, above ODF A; no position, since Nautobot stores whole rack units." |
| cable schedule `a_u`, `b_u` | `12` | `12.5` |
| draw.io | a cell from `itemBox`, half a unit high | the same, in the upper half |
| BOM mounting hardware | 2 screws and 2 cage nuts | the same |

- **Nautobot.** The rule is general: a device is written at the whole unit its
  bottom is in, with a comment saying which part of it it fills; a later
  device whose rounded span meets one already written is kept in the rack with
  no position and no face, as a held item is (rack products, 7.4), and its
  comment says where it is. It is not left out of the file, since both rows
  import. That Nautobot refuses two devices in one unit on one face is
  inferred from its whole-unit walk and is tried on a running instance in the
  build.
- **Mounting hardware.** A half unit has one hole an ear, so the count is 2
  for an item under one unit and `4 * floor(units)` otherwise. The row text
  changes from "Two per ear for each U a device covers" to "Two per ear for
  each whole U a device covers, and one per ear for a device under 1U".
- **draw.io** `drawioU` is whole units from the top. It becomes the top of the
  box in units from the top, in steps of 0.5; the vendor cabinet shape takes a
  fractional row.

**Recommendation, for the whole feature:** format (a), spans half-open in half
units from `spanOf`, bodies centred by `itemBox`, whole-unit devices refused
at a half, and the upper of two half-unit devices unpositioned in Nautobot.

## 3. Slack, stock length and lay (#949 step 4)

### 3.1 What is there today

Read in `kit/rack/route.js`: a routed length is the path, plus an end
allowance from a sourced table (`END_ALLOWANCE_BY_MEDIA`: what is inside the
port, and for copper and DAC half of how short the maker lets a cord be), plus
a `DRESSING_ALLOWANCE` of 0.1 m an end that has no source and is marked
temporary until this step. `stockLength` then takes the next size in
`STOCK_M`, with a tolerance of one nanometre. Only the path is drawn.

Measured on the reference rack of #949: one cord has a 397 mm path, a
measured length of 0.62 m (397 plus two ends of 113.1 mm) and a 1 m stock
size. About 0.58 m of the cable bought is neither drawn nor placed, and a
0.5 m cord beside it looks the same.

`inspect` already returns `slack: {metres}` for an entered length. The tray
contract of the FS FHD-CMP5DR already states `slack: {kind: area}` and
`rack.json` already carries it (`solids.js` passes `slack` through). Nothing
reads it.

### 3.2 The lengths, named

**Settled here.** Four words, each one number:

- **path**: the routed points, port face to port face.
- **need**: the path, plus what the end table says is inside the ports, plus
  the short tolerance of the maker. It is what the cord must at least be.
- **stock**: the length bought. Pinned by the user, or chosen by the kit.
- **spare**: stock less need. It is real cable, and it is somewhere.

`DRESSING_ALLOWANCE` goes, as its comment says it will. What replaces it is
named for what it is: **`MIN_SPARE_M`, 0.2 m a cable**, the least spare the
kit will choose a stock size with. It is the same 0.2 m, moved out of the
measured length and into the spare, so **no stock size on a saved rack
changes because of the move**, while every measured length drops by 0.2 m and
is at last what was measured.

- **The chosen stock** is the smallest size `s` in `STOCK_M` with
  `s + BREAK_TOL_M >= need + MIN_SPARE_M` (and, where a slack entry states a
  value, with that value in place of the minimum when it is larger).
- **`BREAK_TOL_M`** settles #983. Recommended: 0.01 m. A cord may be chosen
  with up to 10 mm less than the minimum spare, so 500.018 mm no longer buys
  a metre. The figure is one twentieth of the minimum spare; it also covers
  the spread of the LC plug depth estimate at two ends (1.8 mm each, read in
  the `route.js` comment). It is applied in `stockLength` and nowhere else.
  It is decision 5, since it moves stock sizes at the breaks.
- **The copper tolerance becomes proportional** (the note on #949 of
  2026-10-10). The table keeps what is inside the port (9.5 mm an end for an
  RJ45 plug), and the short tolerance is 1 per cent of the stock length, half
  at each end, solved with the stock size: 50 mm at 5 m as now, 300 mm at
  30 m where the constant gave 50. DAC keeps its stated 50 mm to 5 m. Fibre
  and AOC have none (their makers state plus tolerances only).
- **`length`** keeps its shape. `{value, unit, source: "routed", measured}` is
  a stock size the kit chose, with `measured` now the need; `source:
  "entered"` is a stock length the user pinned, and is never touched. No new
  key is needed to pin a stock length.
- **A pinned length shorter than the need** is a finding ("c7 is 0.5 m and
  needs 0.62 m."), as `inspect` already shows a negative slack.

For the reference cord: path 397 mm, need 423 mm (two LC ends of 13.1 mm),
stock 1 m (0.5 m leaves 77 mm of spare, under the minimum), **spare 577 mm**.

### 3.3 What the file records

One cable key, a list, in the shape section 5.2 of the cable lay note gave it,
with one more kind of entry:

```json
{"id": "c2", "a": {"item": "i3", "path": "bay-2/module/p1", "view": "front"},
 "b": {"item": "i5", "path": "p14", "view": "front"}, "media": "os2",
 "length": {"value": 1, "unit": "m", "source": "routed", "measured": 0.42},
 "route": [{"item": "i4", "via": "r3"}],
 "slack": [{"item": "i4", "via": "tray", "form": "coil"}]}
```

| entry | means |
|---|---|
| `{item, via, form?, value?, unit?}` | spare stored in a named tray or spool of a placed item or zero-U part, as a waypoint names a pathway |
| `{end: "a" \| "b", value?, unit?}` | spare left at that end of the cable, on nothing the library describes |

- **`form`** is `coil` (the default, decided 2026-10-09), `serpentine` or
  `spool`. A `spool` entry names a tray whose `slack` is a spool.
- **`value` absent means the rest.** At most one entry of a cable has no
  value; entries with a value take theirs first. Values that add up to more
  than the spare are a finding ("c7 stores 1.5 m in mgr-1 tray and has 0.6 m
  to spare."), and the stock size is chosen to cover a stated value.
- **No `slack` key** means the kit places the spare itself (3.5). An empty
  list, `"slack": []`, means the user wants none placed; the spare is then
  stated and marked as not placed.
- **Lay order on a shared tray** is the cable key `lay`, each entry
  `{item, via, position?, face?}`, as section 7 of the cable lay note fixed
  it. A coil sits at the lay position of its cable, so coils on one tray are
  ordered as the cables are.

An older reader keeps `slack` and `lay` (a cable keeps keys `readCables` does
not know) and misreads `slack`: it measures without it and edits a tray off
the route under it. The cable lay note wrote a guard for a version-4 reader
that held `slack` without acting on it. **That guard is not needed:** version
4 is one build, and its first reader acts on `slack`.

### 3.4 Is the spare drawn?

| | (1) stated, not drawn | (2) a loop sized to the stock length | (3) coils on a spool or in a manager volume |
|---|---|---|---|
| what is drawn | the path, with a tag | the path and one loop at the storage place, its length the spare | the path and a stylised hank at the storage place |
| from the library | nothing | a place states that it holds slack and its floor: `tray.slack`, which exists | the same, plus a drum height on a spool for the turn count |
| bend radius | not applicable | every turn at or above the installed radius, checked as the path is | by rule of the hank, not by geometry |
| nothing in reach | no different | the spare is marked as not placed | the same |
| cost in 3D | none | one tube a turn: three turns for the reference cord | one solid a cable |
| what the picture can be trusted for | routes only; a 0.5 m and a 1 m cord are one picture | **the tube drawn is the cable bought**, where the spare is placed | that slack exists and where; not how much |

**Recommendation: (2), drawn as flat racetrack turns, with (1) as the stated
fallback where nothing can hold it.** It is the only option that answers the
report: two cords of different stock sizes then differ in the picture by
exactly the cable that differs.

**The geometry.** A coil is `n` turns lying flat on the resting face of the
tray, each an oval of two half circles of radius `r` joined by two straights
of length `s`, so a turn is `2 * pi * r + 2 * s` long. For a spare `L`:

- `r` is the largest radius the floor allows across the run, and never less
  than the installed bend radius of the cable (`bendOf`, from the cable types
  table);
- `n` is the fewest turns whose oval fits along the run, in the cell between
  two ring bands or on the open floor;
- `s` is then `(L - n * 2 * pi * r) / (2 * n)`, so the turns add up to `L`
  exactly.

Worked for the reference cord on the FHD-CMP5DR (floor strip 448.4 by 61.2 mm
with five ring bands of 6.8 mm, so six cells of 69.1 mm; 3 mm cord, installed
radius 25 mm): `r` is 29.1 mm (61.2 less the cord, halved), one turn at that
radius is 182.8 mm, three turns take 548.5 mm, and `s` is 4.7 mm. The oval is
66 mm long and fits its cell. Drawn tube: 397 mm of path and 577 mm of coil.

**The invariant.** For a cable whose spare is placed, **the drawn tube is as
long as the stock length, less what the end table says is inside the two
ports and less the copper or DAC short tolerance**, which is not cable. It
does not hold in four cases, and each is said on the drawing and in the list:

1. **A spare under one turn at the bend radius** (157 mm for a 25 mm radius).
   It cannot be coiled. It is stated ("0.12 m spare, in the dressing") and
   not drawn. With a minimum spare of 0.2 m this arises only for a pinned
   length.
2. **Nothing in reach to hold it** (3.5). Marked "not placed".
3. **An `{end}` entry.** No part holds it, so it has no shape. Stated ("0.6 m
   spare at the A end"), tagged at that port, not drawn.
4. **More than twelve turns in one place** (`TURNS_DRAWN`). The first twelve
   are drawn and the tag gives the count and the length, so a 20 m spare does
   not put a hundred tubes in the scene.

**Bend rule.** The coil joins the path as points marked `at: "slack"` with
their `item`, `via` and radius. `cornersOf` does not read them as corners; a
coil is judged by its radius alone, and one below the installed radius cannot
be made, since `r` is never chosen below it. The leg into and out of the coil
is an ordinary corner and is in `bends` with the rest (kit 0.17.0). A cable
whose loop is too wide for the floor is refused by the command with the
sentence the cable lay note gives (Cat6A, 7.5 mm at 30 mm, needs 67.5 mm of a
61.2 mm strip), and skipped by the automatic placement.

**A full tray.** Decided 2026-10-09: storing into a full tray warns at
`FILL_LIMIT` and draws the turns as they fall, above the lip if need be.

**2D.** Decided 2026-10-09: a marked loop at the tray, in the cable colour,
with the stored length in its tag. An elevation sees a flat coil edge on, so
2D carries the number and 3D the shape.

**From the library.** Nothing new for a tray: `slack: {kind: area}` and the
floor are enough, and the FHD-CMP5DR states both. A spool
(`slack: {kind: spool, at, diameter}`) gains an optional `height`, the drum
between its flanges, so the kit can say how many turns it takes; without it a
spool takes one layer. The FHD enclosures are the first parts with spools
(cable lay note, section 6) and none is modelled with one yet. Vertical ducts
state no `slack` and hold none in version 4 (section 12).

### 3.5 Where the spare goes when the file does not say

**Recommendation: the kit places it, by a rule that does not depend on which
end the cable is read from, and says so.**

- **Candidates** are the supports the cable already rests on that state
  `slack` and whose floor takes a turn of this cable: the trays in the `rests`
  of its path. The kit **never reroutes a cable to reach a tray**, since that
  would change the path that the spare is measured against.
- **The choice**, in order: the candidate with the most free volume; then the
  one nearest the middle of the path, by distance along it; then the lowest
  `item` id and `via`, compared as text. Each of the three reads the same from
  either end, which is what #986 asks of the lay. A test writes each fixture
  cable end for end and asserts the same place, the same turns and the same
  length (section 9).
- **The automatic place is computed, not saved,** as an automatic route is.
  It is saved when the user pins it (`cable.slack`), and then it is an entry
  like any other. `inspect` marks which it is (`auto: true`).
- **No candidate:** the spare is not placed. It is a finding of kind
  `spare-unplaced` when it is over 0.3 m (`UNPLACED_WARN_M`: one and a half
  times the minimum, so a cord at the minimum never warns), with the sentence
  "c2 has 0.58 m of spare and nothing on its route holds slack: route it
  through a manager tray, or shorten it." Under that it is stated and not
  warned about.

The direction faults #986 lists in the path itself (`cornersOf` merging from
one end, the first body met, the hang at one end) are not fixed by this note.
The spare is measured against whichever path the kit lays, and the placement
adds no new dependence on direction.

### 3.6 The exports

- **Cable schedule.** Two columns **appended after the last**, so no column
  read by position moves: `spare` (metres, a number) and `stored` (text:
  "mgr-1 tray, coil, 3 turns", "A end", "not placed", or blank for a cable
  with no length). The cable lay note planned one text column named `slack`;
  two serve a spreadsheet better, since the length can be summed. Its
  `straps` column follows them, as that note has it. **This is a download
  format change**: a reader that takes columns by header is unaffected, one
  that checks the column count is not.
- **BOM.** The cable lines keep their shape; the length bought is the stock
  length, as now. One note line totals the spare ("Spare cable: 14.2 m of
  31 m bought; 3 cords are not placed."), and one line names each cable whose
  spare is not placed.
- **DCIM.** Nothing new: both targets import the stock length.
- **draw.io.** The edge label of a cable gains its spare where it has a
  length ("1 m, 0.58 m spare").
- **Bend findings (#1007)** join the same pass: one note line a cable in the
  schedule and BOM notes, `bends` on a cable in `inspect`, a count and the
  worst in `describe`, and one finding a corner where two share a point. They
  need no rack key, and they are built with this section because a coil adds
  corners at its entry and exit that a reader must be told about.

### 3.7 `lay`

`lay` is in the schema as the cable lay note fixed it, with `position` and
`face` each optional. `face` is acted on from the first build (the held face
exists since step 3). `position` is kept and not acted on until lay order
(step 5 of that note) is built; ignoring it moves a cable across its pathway
by millimetres and is harmless, as that note argues.

The gap behind a tray (#966) needs no key in version 4. If it becomes a
pathway a user can pin, it is one more value in a `lay` entry, which is an
additive schema change and needs no bump (1.2).

### 3.8 Straps

Asked beside this note: a strap just before each point where a cable leaves a
bundle, a strap securing a bundle to a manager or ring it passes, and the
same for a single cable.

Read: `straps()` in `kit/rack/bundles.js` places `ceil(L / every)` straps
evenly along each run and moves one off a ring; a bundle carries
`straps: {every}`; `readBundles` keeps the `straps` object whole when its
`every` is valid. The tray contract states `ties`, the tie slots, and the
cable lay note counts one strap a tie slot on the held face and none on the
resting face (decided 2026-10-09).

**Whether any of it needs a rack key:**

- **Where the straps go is computed from version-3 data.** The end of a run
  is already in what `straps()` returns (`runs`), and a peel point is on the
  bundle member. A breakout strap is one strap within 50 mm before each end
  of a run where a member leaves, unless an even strap is already that close.
  An anchor strap is one at each tie slot the trunk or cable passes on a part
  that states `ties`. Neither needs a key to exist.
- **A ring states no tie point.** A strap at a D-ring would be geometry no
  source gives. An anchor at a ring waits for a part that states one, which
  is a library key on a guide and not a rack key.
- **Turning a rule off, or on for one cable, is a rack key,** and an optional
  one that is safe to ignore: a reader that ignores it only counts straps
  differently. So it needs no bump (1.2). It is put in the version-4 schema
  all the same, so the schema is published once:
  `straps: {every?, breakout?: boolean, anchors?: boolean}` on a bundle, and
  `straps: {anchors?: boolean}` on a cable.
- **It changes the BOM strap count**, and anchors on the resting face reverse
  part of the 2026-10-09 decision that straps under single cables are not
  drawn or counted. That is decision 8.

### 3.9 What the kit gains

- `rack/route`: `needOf(path, cable)`, `spareOf(rack, cable, ctx)` returning
  `{need_m, stock_m, spare_m, pinned}`; `MIN_SPARE_M`, `BREAK_TOL_M`,
  `UNPLACED_WARN_M`, `TURNS_DRAWN`; `stockLength(need, {pinned})`.
  `END_ALLOWANCE_BY_MEDIA` and `endAllowance` keep their names and lose the
  dressing allowance and the copper tolerance; `shortTolerance(cable, stock)`
  is new.
- `rack/slack` (a new subpath): `slackPlan(rack, cable, ctx)` returning each
  entry with `{item, via, form, metres, turns, r_mm, auto, points}` and
  `unplaced_m`; `holdsOf(tray, cable)`; `slackFindings(rack, ctx, nameOf)`.
- `routePath` returns the coil points in `points`, marked `at: "slack"`.
- Commands: `cable.slack {id, at: {item, via} | {end}, value?, unit?, form?}`
  and `cable.slack.clear {id, at?}`; `cable.lay` as the cable lay note has it.
- `inspect` of a cable: `slack` becomes
  `{metres, stored: [...], unplaced_m}`, and `need` and `stock` join `length`.
  `describe` gains one line ("Spare: 14.2 m; 3 cords not placed.").

## 4. Outlet states and readings (#934)

Decided 2026-10-08, and not reopened: the device declares what an outlet can
be (`states: [on, off]`), the rack entry sets it, and readings go in the rack
file first. This section gives the keys their exact shape.

```json
{"id": "z2", "ref": "evma8365x", "cfg": "", "label": "PDU A", "at": "left-rear",
 "offsetMm": 133.35,
 "swaps": {}, "fields": {"section-a-label": "Row 4 A"},
 "states": {"outlet-a1": "on", "outlet-a2": "off"},
 "readings": {"source": "SNMP poll of the PDU network module",
              "at": "2026-10-08T14:05:00Z",
              "values": {"outlet-a1": {"current-a": 1.8, "power-w": 372},
                         "breaker-a": {"current-a": 11.2},
                         "input": {"current-a": 19.6}}}}
```

| key | on | type | default |
|---|---|---|---|
| `states` | item, zero-U entry | map of part path to state name, both strings | absent: no state set, lamps unlit |
| `readings` | item, zero-U entry | `{source, at, values}`; `source` a string, `at` an RFC 3339 time, `values` a map of part path to `{current-a?, power-w?, energy-kwh?}`, each a number from 0 | absent |
| `swaps`, `fields` | zero-U entry | as on an item | absent, read as `{}` |

- **Units** are in the names: amperes, watts, kilowatt hours.
- **The loader** normalises `states` entry by entry: an own key that is a
  string, with a string value, is kept; anything else is dropped with a
  notice. `readings` is kept only whole: without a `source` or a readable
  `at` it moves to `readingsAsWritten`, as an unusable length moves to
  `lengthAsWritten`, and nothing draws it.
- **The catalogue check** is a settle step, as managers have, since
  `parseDoc` has no catalogue. A state a part does not declare is kept and
  not applied: "outlet-a1 on PDU A cannot be standby: it can be on or off." A
  reading where the PDU meters nothing is kept and not shown: "EVMI2130X
  meters its input only, so there is no reading for outlet-a1." The check
  reads `pdu-class` and the state vocabulary, so `rack.json` gains each
  device its switchable paths and its metering scope (additive, `format` 1).
- **Older readers.** A version-3 reader drops both keys from an item and
  erases them on save; it keeps them on a zero-U entry and ignores them. The
  first is why they need the bump.
- **Applying them.** `statesFor(entry, facts)` in a new `rack/states` subpath
  returns the map to hand a drawing, expanded from each outlet to the lamps
  bound to it by `for:`, through the one expansion the PDU note requires for
  2D and 3D alike (its section 3.2). `readingsFor(entry, facts)` returns the
  badges with the source and the time.
- **Commands.** `state.set {id, path, state | null}` and
  `readings.set {id, readings | null}`, on an item or a zero-U entry, each
  refused with the sentences above. `patch` and `zerou.update` take `swaps`
  and `fields` on a zero-U entry.
- **Exports.**
  - **NetBox:** a new file in the import kit, `power-outlets.csv`, one row
    for each outlet with a state set: `device`, `name`, `status`, with `on` as
    `enabled` and `off` as `disabled`. Read at netbox-community/netbox commit
    `84e19368`, `netbox/dcim/choices.py`: `PowerOutletStatusChoices` is
    `enabled`, `disabled`, `faulty`. The file updates outlets the device type
    created, so it is imported after the devices, and the kit README says so.
  - **Nautobot:** nothing. Read at nautobot/nautobot commit `c77e4255`,
    `nautobot/dcim/models/device_components.py`: a `PowerOutlet` has `type`,
    `power_port` and `feed_leg`, and no status. The states go in the device
    comment, one line ("Outlets off: A2, A7.").
  - **Readings** are in no DCIM file. The sheets, the BOM notes and draw.io
    that show one state its source and time (decided 2026-10-08).

## 5. PDU brackets (#939)

A zero-U PDU on a frame with no zero-U channel hangs on two brackets bolted to
an upright. The bracket is a library device (FS-PDUBK, to be modelled with #939 as a
`mount: rack-side` part);
its keyholes are placements whose part carries `interface: pdu-button`; the
PDU mount points carry `mates: pdu-button` (PDU note, 6.2; rack products, 3).

**How the hosting is written.** Each bracket is a zero-U entry of its own, so
the parts list counts it and it is drawn where it is. The PDU entry names
them:

```json
{"id": "z3", "ref": "fs-pdubk", "cfg": "front", "label": "Bracket", "at": "left-rear", "offsetMm": 133.35},
{"id": "z4", "ref": "fs-pdubk", "cfg": "front", "label": "Bracket", "at": "left-rear", "offsetMm": 1689.1},
{"id": "z2", "ref": "evmi2130x", "cfg": "", "label": "PDU A", "at": "left-rear", "offsetMm": 120.65,
 "heldBy": {"parts": ["z3", "z4"]}}
```

- **`heldBy: {parts: [id, ...]}`** on a zero-U entry: the ids of the zero-U
  entries that hold it, one or more, each an entry of this rack. It is the
  same word an item uses for a shelf (rack products, 7.2), and the shape
  differs with where it is written: an item is on one host at a place, a PDU
  hangs on several parts and its place follows from them.
- **The bracket option** (the quick start guide gives two: on the front of
  the post, or on its rear side) is the bracket configuration, `cfg`.
- **How the position behaves.** Decided 2026-10-09: a hosted item keeps `ru`,
  written by the kit and kept in step with its host, and `heldBy` is what
  decides. A zero-U entry has no `ru`; its position is `at` and `offsetMm`,
  and the same rule is applied to them. **The kit writes both for a held
  PDU:** `at` is the `at` of its brackets, and `offsetMm` is the height of
  the lowest bracket slot less the height of the lowest PDU mount point. When
  a bracket moves the PDU moves with it, as a manager moves with its host.
  Every reader that sorts or labels a zero-U part by where it is goes on
  working, and `zeroUBottom` still names the unit.
- **Off the whole unit.** A held PDU has an `offsetMm` that is not a whole
  number of units (120.65 above). Zero-U overlap is therefore judged in
  millimetres from version 4 (`offsetMm` to `offsetMm + h`), not in units,
  and **a part does not overlap the parts that hold it**.
- **Fit**, in order, each a sentence:
  1. every id in `parts` is a zero-U entry of the rack whose part offers a
     slot with the interface the PDU mates: "z9 is not a bracket in this
     rack.";
  2. the parts are on one attachment point (or in one `channel`): "z3 is at
     left-rear and z4 at right-rear; a PDU hangs on one upright.";
  3. each PDU mount point lands on a slot, within the tolerance the interface
     states in the connectors registry, 1 mm where it states none: "PDU A has
     mount points 1555.8 mm apart; brackets z3 and z4 are 1511.3 mm apart.
     Move z4 up 1U." The Eaton G4 pitch is 35 units to 0.05 mm (1555.75), so
     brackets at whole units meet it.
- **A bracket removed** leaves the PDU where it was, with `heldBy` naming a
  part that is gone, refused by fit and said in a note until it is hung
  again or freed. Nothing is deleted.
- **A channel.** A PDU in a cabinet channel (rack products, 3) carries
  `channel` and no `heldBy`: the channel is part of the frame. The fit check
  is the same comparison against the channel slots.
- **An older reader** keeps `heldBy` on a zero-U entry and ignores it: it
  draws the PDU where `offsetMm` says, which is right, and lets a bracket be
  moved from under it, which is wrong. That is the bump case.
- **Commands.** `zerou.hang {id, on: [ids]}` and `zerou.hang {id, on: null}`.
  `zerou.update` of a bracket carries its PDU. A query,
  `bracketPositions(rack, {ref, at}, ctx)`, returns the offsets two brackets
  need for a PDU, so a page or an agent can place them first.
- **Exports.** The brackets are lines of the BOM. The PDU comment in both
  DCIMs names what it hangs on ("0U, on 2 FS-PDUBK brackets at left-rear,
  from U4; NetBox has no field for that."), and each bracket is a zero-U
  device row with its own comment, as a duct is today.
- **Library.** FS-PDUBK is built with #939 as a plain device first; its
  `mount-points` side is published in `rack.json` as `slots` for the part
  (`[{interface, at}]`, millimetres above its own bottom), beside the
  `mount-points` a PDU already gets.

## 6. Roll

Decided in the cable lay note (7.1) and the rack products note (10), and
kept: one item key, `roll`, `90`, `180` or `270`, degrees clockwise as the
item is seen in the elevation of the face it is on, applied after `face` and
`turned`. Absent is upright and `0` is never written.

```json
{"id": "i6", "ref": "fhd-cmp5dr", "cfg": "", "label": "Lacer, inverted", "ru": 21,
 "face": "front", "turned": false, "swaps": {}, "fields": {}, "roll": 180}
```

| | `180` | `90`, `270` |
|---|---|---|
| units | unchanged | the width over 44.45 mm, rounded up to a whole unit |
| box | the same box, from `itemBox` | height and width swapped, centred across the opening until #550 says otherwise |
| ears | a whole-unit ear meets the same holes; see below for a half unit | the ears do not meet the rails; the mount kit of #550 does |
| ports and guides | every face point turned about the centre of the box | the same |
| routing | resting and lay in the frame as mounted (cable lay, 3.1) | routed as an outline only, and said so, until #550 |
| version 4 builds | fit, drawing data, routing | fit and the outline |

- **Ears at a half unit.** Measured from the hole pattern (2.5): turning a
  half-unit panel over moves a hole that is 6.35 mm above its bottom to
  6.35 mm below its top, which is the hole the other half of the unit needs.
  So `roll: 180` is the one way a half-unit ear with a round hole can go in
  the other half. The kit allows it and does not require it, since the slot
  of the XCU10 is not measured.
- **Ports.** `facePoint(rack, item, {x, y}, chassisOf)` in `kit/rack/fit.js`
  turns a point of the face as drawn into the rack, through `face`, `turned`
  and `roll`, on the box `itemBox` gives. `pointOf`, `portPoint`, the solids
  and the site drawings go through it, so a port on a rolled item is where it
  is drawn. Labels printed on the item are turned with it and are not
  redrawn upright.
- **A rack-face part hosted on a rolled item** keeps `on` and `unit`; `unit`
  counts from the bottom of the host as mounted.
- **Exports.** The notes of the cable lay note: "Mounted upside down.",
  "Mounted rotated 90 degrees clockwise, as seen from its face.", or the same
  with anticlockwise, in the BOM notes and both DCIM comments.
- **An older reader** drops `roll` and fits a quarter-turned item upright,
  into units it does not fill. That is the bump case.
- **Commands.** `patch` takes `roll: 90 | 180 | 270 | null`, refused where
  the rolled box does not fit.

## 7. DIN devices on a shelf rail (#972)

**The rack-file part is in version 4. The feature is not built with it, and
needs no version 5.**

What #972 needs from the rack file is one statement: this item is on that
rail of that item, so far along it. The rack products note wrote that key
(its 7.2), `heldBy: {item, at, x}`, with `at` the id of a host of `kind:
rail`, and version 4 carries it (1.1). The depth of the rail follows the
shelf adjustment through `fields` (#950, decided 2026-10-10), so it needs no
key either. The DCIM answer is also written (rack products, 7.4): a device in
the rack with no position and no face, and a comment saying what it is on.

What is **not** ready, and why the build waits:

- The library has no `hosts:` key yet (read: `spec/schemas/device.schema.json`
  does not define it), and the DINRAIL2U and DINRAIL4U manifests state no
  rail, profile or usable span. The profile has to be read from the FS
  source, not assumed.
- A `mount: din-rail` device does not yet state the rail profiles it clips to
  in a form fit can compare (#734).
- Whether a DIN device on a shelf should be a child device in either DCIM
  instead of an unpositioned one was asked in #972 and not checked upstream.

So version 4 reads and keeps an item `heldBy`, writes its `ru` as the host
bottom unit, moves it with its host, exports it unpositioned with its
comment, and **refuses to place a new one** until the catalogue describes
hosts: "DINRAIL2U states no rail to hold a device." When the library gains
`hosts:`, placing starts to work on files version 4 already reads.

This holds only if the rack products keys ride in version 4 (decision 1). If
they do not, `heldBy` waits, and #972 with it, for version 5.

## 8. Migration, and what each reader does

- **3 to 4** is the identity: `d => ({...d, version: 4})`. Nothing in a
  version-3 file changes shape or meaning. The bump is so that a version-3
  page refuses a file it would erase keys from (`states`, `readings`, `roll`,
  item `heldBy` and `setback`, the frame keys), misplace (`ru: 12.5` it
  refuses outright; `channel`, zero-U `heldBy`) or measure wrongly (`slack`).
- **A version-3 reader given a version-4 file** refuses it whole, with the
  sentence it has today: "This rack file is version 4; this reader supports
  up to version 3." Nothing is read in part.
- **A version-4 reader given a version-3 file** migrates it on load and saves
  it as version 4. Three things then differ, none of them in the file:
  1. **Overlaps the old fit allowed.** A 1.5U or 3.5U item with another in
     the unit its top half fills (2.2) now overlaps. Both are kept where they
     are, as fit keeps an item it would no longer accept, and a notice names
     them: "TM-7124S at U1 is 1.5U and reaches into U2, where QFX5120 is."
  2. **Measured lengths drop by 0.2 m** and stock sizes stay, except at a
     break within `BREAK_TOL_M` and for copper of 7 m and over (3.2). The
     page says once which stock sizes moved, as it does after any re-measure.
  3. **Faceplates move** with the setback order of the rack products note
     (its section 8): the 30 mm showcase default goes.
- **Zero-U overlap** is judged in millimetres (section 5). Parts written at
  whole units, which is every part a version-3 file holds, overlap exactly as
  before.
- **The schema** is `spec/schemas/rack.schema.json` with `version` const 4
  and `$id` `https://portrayal.dev/schemas/v3/rack.schema.json`. The file
  under `/v2/` stays as published. `docs/format-stability.md` gains the
  version-4 section in the build.

## 9. Build order inside the one pull request

One branch, one commit a part, in this order. Each part lands with its tests,
and the full kit suite runs at the end of each.

| | part | tests it needs |
|---|---|---|
| 1 | **The format.** `VERSION` 4, the migration, the schema under `/v3/`, `multipleOf` in the validator, `readItem` and `normalizeFrame` keeping unknown keys, every key of 1.1 read and round-tripped. | A version-3 fixture opens and saves as version 4 with nothing else changed. Each key of 1.1 survives parse and serialise. A version-3 `parseDoc`, kept as a fixture, refuses a version-4 file with its sentence. The schema accepts `ru: 12.5` and refuses `12.25`. A file with an unknown item key and frame key keeps both. |
| 2 | **Spans and boxes.** `unitsOf`, `spanOf`, `itemBox`, `holesIn`, `uText`, `positionOf`; every site of `Math.max(1, ru)` moved to them; `freeUs`, `shrinkRack`, the commands. | The three rows of 2.2, each asserting the right answer. Two 0.5U items in one unit, no overlap, boxes that tile the unit. A 1U item refused at a half with its sentence. `positionOf` on a top-down frame for both halves. A source scan that fails when `kit/rack/` computes a height from `ru` outside `fit.js`. |
| 3 | **Roll.** `facePoint`, the rolled box, `roll: 180` through solids, resting and routes. | Fixture 3 of the cable lay note (two managers back to back, the lower with `roll: 180`). A port on a rolled item at the mirrored point. A quarter-turned item taking its rolled units and refusing a neighbour. |
| 4 | **Zero-U: `swaps`, `fields`, `states`, `readings`, `channel`, `heldBy`.** Overlap in millimetres; `zerou.hang`; `bracketPositions`; the state and reading settle step and commands. | A PDU hung on two brackets 35U apart fits; 34U apart is refused with the sentence and the distance. Moving a bracket moves the PDU. A state the part does not declare is kept, not applied, and named. A reading with no `source` moves to `readingsAsWritten`. An outlet state reaches its lamp path in the map handed to a drawing. |
| 5 | **Lengths and slack.** `needOf`, `spareOf`, `MIN_SPARE_M`, `BREAK_TOL_M`, the proportional copper tolerance, `slackPlan`, the coil points, `cable.slack`, the automatic place, the findings. | On the reference rack of #949: every stock size before and after, with only the cords within 10 mm of a break changing, each named in the test. For each placed coil, the summed length of the drawn points equals stock less the inside ends, to 1 mm. Each fixture cable written end for end gives the same place, turns and length. A Cat6A cord is refused the FHD-CMP5DR tray with its sentence. A cable with no tray on its route gets `spare-unplaced` over 0.3 m and none under. The test asserts it placed at least one coil, so an empty plan cannot pass. |
| 6 | **Exports.** Positions in halves, the Nautobot rule, the hardware count, `spare` and `stored`, `power-outlets.csv`, the comments for roll, brackets and held items, the bend lines of #1007. | Golden files for both DCIM kits with two half-unit items in one unit. The schedule header ends `..., status, notes, spare, stored, straps`. An import of the NetBox kit, and of the Nautobot kit, into a running instance, with two half-unit devices in one unit: both files import whole. |
| 7 | **Queries and agent output.** `describe`, `inspect`, `fitsAt`, the command table. | The agent command schema validates each new argument. `inspect` of a cable shows `stored` and `unplaced_m`. |
| 8 | **Docs and release.** `format-stability.md`, the four notes of the header amended to point here, the kit minor version, the changelog fragment naming each one-way item. | Preflight and the docs tests. |

The site follows in portrayal-site once the kit is published: the 2D and 3D
drawings read `itemBox` and `facePoint`, draw the coil points, and draw
bracket-hung PDUs. Its browser check asserts, for two half-unit items in one
unit, that neither drawn box overlaps the other in 2D or in 3D, and that a
0.5 m and a 1 m cord on one route draw tubes of different length.

**Not in the pull request, and no format change when they come:** lay order
by `position` (cable lay step 5), the quarter turns of #550, placing a new
held item (section 7), the gap behind a tray (#966), the direction faults of
#986, the generic ear slots in `ears.py` (2.5), and spools on the FHD
enclosures.

## 10. Decisions to take

Each says what is one-way. Everything else in this note is settled above.

1. **Do the rack products keys ride in version 4?** (`setback`, item
   `heldBy`, `channel`, `width`, `startU`, round holes, `options`.)
   Options: (a) yes, as decided 2026-10-09 and recorded on #908; (b) no, the
   five features of 2026-10-10 only, and those keys wait for version 5.
   **Recommend (a).** The one-bump rule is the reason version 4 exists, and
   (b) makes a version 5 certain and sends #972 to it. One-way either way:
   the version-4 schema is published once.

2. **The half-U position format.** Options: (a) `ru` in steps of 0.5;
   (b) integer `ru` and `half: lower | upper`; (c) a millimetre offset.
   **Recommend (a)** (section 2.3): it is the NetBox field, it is one number,
   and a reader cannot read half of it. One-way: a saved-format key and a
   published schema.

3. **A whole-unit device at a half position: refused, or warned about?**
   Options: (a) refused, since its ears meet no hole there (2.5); (b) allowed
   with a warning, as NetBox allows it. **Recommend (a).** The arithmetic
   holds for every ear on the standard pattern, and a rack that cannot be
   built should not be drawn as built. Two-way in the kit; loosening it later
   breaks nothing saved.

4. **Is the spare drawn?** Options: (1) stated only; (2) drawn as flat
   racetrack turns at the storage place, with the tube as long as the cable
   bought; (3) a stylised hank. **Recommend (2)** with (1) as the fallback
   where nothing holds it (section 3.4). Two-way for the picture. One-way
   for what rides with it: the coil points in `routePath`, the `stored`
   fields of `inspect`, and the `spare` and `stored` columns of the cable
   schedule, which are a download format change.

5. **The stock break.** Options: (a) `MIN_SPARE_M` 0.2 m and `BREAK_TOL_M`
   0.01 m; (b) the same minimum and no tolerance; (c) another minimum.
   **Recommend (a).** The minimum is the dressing allowance already decided,
   under its right name, so no stock size moves for it; the tolerance settles
   #983 with a figure that has a stated reason. One-way: stock sizes change
   on saved racks at the breaks, and for copper of 7 m and over through the
   proportional tolerance.

6. **Does the kit place the spare when the file names no place?** Options:
   (a) yes, on a tray the cable already rests on, by the rule of 3.5, computed
   and not saved; (b) no, the spare is unplaced until the user stores it.
   **Recommend (a).** Under (b) the picture that prompted this note does not
   change until someone edits every cable. Two-way: nothing is saved.

7. **Nautobot and two half-unit devices in one unit.** Options: (a) the
   first positioned, the later kept in the rack with no position and a
   comment; (b) the later left out of the file; (c) each given a whole unit
   of its own in the export. **Recommend (a).** It imports, it loses no
   device, and it says no position that is false; (c) would export a rack
   taller than the one drawn. One-way: an imported device keeps where it was
   put.

8. **Straps at breakouts and at tie points.** Options: (a) both computed
   and counted, on by default for bundles, anchors for single cables only on
   the held face as now, with the optional `straps` keys of 3.8 to turn each
   off; (b) (a), and anchors for single cables on the resting face too, which
   reverses part of the 2026-10-09 decision; (c) leave straps as they are.
   **Recommend (a).** It gives the breakout strap and the anchor to a
   manager without counting straps no source can place. The keys are
   optional and need no bump. One-way: the BOM strap count changes.

## 11. One-way items

| item | where | why it is one-way |
|---|---|---|
| rack file version 4 under `/schemas/v3/`, with every key of 1.1 | rack file, schemas | an older page refuses a version-4 file; a label is never reused |
| `ru` as a multiple of 0.5, the bottom of the item | rack file | saved files carry it |
| `unitsOf`, `spanOf` (half-open), `itemBox` and the centred rule, `facePoint`, `holesIn`, `uText` | kit API | pages place and route by them; changing the centred rule moves every body |
| a whole-unit device refused at a half position | kit fit | agents and pages match the sentence |
| `positionOf` in halves, and the top-down formula | kit, exports | exported positions follow it |
| the Nautobot rule for a shared unit, and its two comment lines | DCIM export | an imported device keeps its position and comment |
| the mounting hardware count by ear hole, and its row text | BOM | a reader matches the row |
| `slack` entries `{item, via, form, value, unit}` and `{end, value, unit}`; absent against empty | rack file | saved files carry them |
| `MIN_SPARE_M`, `BREAK_TOL_M`, the proportional copper tolerance, `measured` meaning the need | kit, saved lengths | stock sizes and measured lengths on saved racks follow them |
| the coil geometry, `at: "slack"` points, `TURNS_DRAWN`, `UNPLACED_WARN_M`, `spare-unplaced` | kit API, agent output | a page draws the points and an agent reads the finding |
| the automatic place and its three-step order | kit | the picture of every saved rack follows it |
| `spare` and `stored` appended to the cable schedule; the spare lines of the BOM notes; the draw.io edge label | exports | a download format change |
| `states`, `readings`, and `swaps` and `fields` on a zero-U entry | rack file | saved files carry them |
| `power-outlets.csv` in the NetBox kit, and the Nautobot comment line | DCIM export | an import kit file and its columns |
| zero-U `heldBy: {parts}`, the kit writing `at` and `offsetMm` of a held part, overlap in millimetres | rack file, kit | saved files carry it; fit depends on it |
| `zerou.hang`, `state.set`, `readings.set`, `cable.slack`, `cable.slack.clear`, `roll` on `patch` | kit commands | agent sessions call them by name |
| `straps.breakout`, `straps.anchors` | rack file | saved files carry them; the strap count follows |
| `readItem` and `normalizeFrame` keeping unknown keys | kit reader | later optional keys rely on it to skip a bump |

## 12. Left for version 5, or later with no version

**Needs a later version:**

- **Rows of racks** (`rows` on the document), baying checked between two
  products, and `between: true` resolved to two racks (rack products, 10).
- **A room**: rows in plan, aisles, anchors.
- **Slack across racks**, which needs rows first.
- **A stored position for a channel that slides** (`moves`, rack products 3),
  if a product needs one.

**Needs no version, only a build:**

- Lay order by `position`, and the gap behind a tray (#966).
- The quarter turns of `roll` and the mount kit facts of #550.
- Placing a device on a shelf, in a drawer or on a DIN rail (#972), once the
  library has `hosts:`.
- Slack in a vertical duct, and service loops with a shape at a device end:
  both wait for a library part that states how it holds them.
- An anchor strap at a ring, which waits for a ring that states a tie point.
- Readings in the marks format, a later decision of its own (PDU note, 3.4).
- The ear slot heights of a device in the catalogue, which turn on the hole
  check of 2.5.
