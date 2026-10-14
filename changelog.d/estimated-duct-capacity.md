### Added
- **Eight FS cable managers that state no cable capacity carry an estimated
  one, so spare stored in their duct counts against a figure** (P-0027,
  `docs/cable-managers-design.md` section 15). CMH-SFDS1U 54, CMH-SFDS2U 142,
  CMH-DFDS1U 143, CMH-DFDS2U 270, USCMH-SFDABSB2U 186, CMV-SFD42U9W 2002,
  CMV-SFDS45U5W 4505 and CMV-DFDS45U5W 9083, each Cat6. The figure is the
  channel's inside cross-section, read from the part's own side view, at the
  area a cable takes in FS's own counts for the parts that state one (the
  median of ten horizontal ducts, 47.7 mm2; 4.7 mm2 from the two closed
  vertical ducts), rounded down. FS's vertical counts are not a fill of the
  channel, so the three vertical figures are on FS's scale and no stored loop
  will reach them. A new device key, `attrs.performance.cable-capacity-estimated`,
  marks the count, and `rack.json` carries `capacity.estimated: true` for it
  and no key for a stated count. Each device is a patch bump.
- **A stored loop in a part with an estimated count says it is an estimate**
  (`kit/rack/slack.js`): `hm-1 holds 5 cat6 cables' worth with the spare stored
  in it, against an estimated 54 cat6 cables' worth (its maker states none).`
  It is a note when within the count (`spare-capacity-estimated`), and the
  refusal past it and the note of cables through a manager read "an estimated".
  `inspect` gives `capacity.estimated`. A part that still states none keeps
  `spare-capacity-unstated`. The USCMH-SFDABS1U, 2U and B1U keep the earlier
  estimates, with no kind and no mark.
