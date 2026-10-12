### Changed
- **A cable manager's stated count is compared only with cables of the kind
  it counts** (#1032, `kit/rack/route.js` `capacityOver`). The kit compared
  the count with every cable through the manager, so 48 fibre cords of 3 mm
  through an FHD-CMP5DR, which states 30 Cat6 24AWG, were reported as over
  its capacity while its fullest ring stood at 45% of its fill limit. The
  count is now compared with the cables whose `media` is the kind the device
  states, and a count with no stated kind is never compared. How full a
  manager is comes from the fill of its rings, as before. A cable of another
  kind is not counted against the count in either direction; the rule for a
  mix of kinds is `docs/cable-managers-design.md` section 14. **This changes
  what a rack page warns of and the notes of three downloads** (the sheet,
  the cable schedule CSV and the BOM CSV). No rack file changes.
- **The notes name the manager and say what the percentage is of**
  (`kit/rack/export-data.js` `fillNotes`). A manager is named with its U and
  its face, so two managers of one model give two lines: `FHD-CMP5DR (U42
  front)`. A pathway over its fill reads `ring 1 on FHD-CMP5DR (U42 front):
  60 cables, 112% of its fill limit; the limit is 40% of the opening.` It
  read `guide-1 on FHD-CMP5DR: 60 cables, 112% of a 40% fill.` A manager
  over its count reads `FHD-CMP5DR (U42 front): 31 Cat 6 copper cables
  through it, more than the 30 of that kind its maker states.` It read
  `FHD-CMP5DR: 31 cables through it, more than its stated 30.`
- **A cross-face tag names its port in words** (`kit/rack/cable-rules.js`
  `tagText`): `→ FHD-1UFCE bay 1 b09`, where it gave the path, `→ FHD-1UFCE
  bay-1/module/b09`. `freePorts` gives the same text as a port's `label`,
  which read `bay 1/module/b09` for a port on a seated part.
- **Eighteen FS cable managers state the kind of cable their count is of**
  (`cable-capacity-media: cat6`), each a patch bump: FHD-CMP5DR 1.1.2,
  CMH-6DR1U 1.0.1, CMH-SFD1U 0.1.4, CMH-DFD1U 0.1.3, CMH-BS-SFDS1U,
  CMH-HD-SFDABS3U and 4U and CMH-UHD-SFDABS1U, 2U and 3U 0.1.2, and
  CMH-5DR1U, CMH-5DR1U-N, CMH-SFD2U, CMH-BS-DFDABS2U, CMV-5U3W,
  CMV-SFD45U5W, CMV-DFD45U5W and USCMH-5DR1U 0.1.1. Each datasheet names
  the cable, Cat6 24AWG. Their NetBox and Nautobot device types gain the
  line in their comments and the new drawing version; no port, bay, name or
  file name changes. Four managers state a count and no kind, and are never
  compared: the CMH-4DRB1U, whose two sources disagree on the cable, and the
  USCMH-SFDABS1U, USCMH-SFDABS2U and USCMH-SFDABSB1U, whose counts are
  estimates.
- **`@portrayal/kit` is 0.27.0.** The kit README lists what a page calls
  under "New in 0.27.0".

### Added
- **`attrs.performance.cable-capacity-media`** in the device schema: the kind
  of cable a manager's `cable-capacity` counts, one of the kinds a rack file
  gives a cable (`os2`, `om3`, `om4`, `om5`, `cat6`, `cat6a`, `dac`, `aoc`).
  It needs `cable-capacity` beside it. Set it only where a source names the
  cable. `rack.json` carries it as `capacity.media`.
- **`inspect` of a manager states its capacity** (`kit/rack/queries.js`):
  `capacity: {count, basis, media}`, `media` null where no source names the
  cable. `portLabel(path)` in `kit/rack/cable-rules.js` is a port in words.
