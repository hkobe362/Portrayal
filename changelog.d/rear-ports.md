### Fixed
- **A port on the back of a module seated in a bay can take a cable** (#1019,
  `kit/zones.js`, `kit/rack/`). The rear adapters of a patch panel and the
  trunk connector of a cassette are drawn on the host's rear face as a
  projection, and `readSvg` read such a part's path as its element id
  (`bay-1-rear--b01`), which nothing accepted. A zone's `path` is now the
  part's own path (`bay-1/module/b01`) and the zone says `projected: true`.
  The address of such a port is `{ item, path: '<bay>/module/<part>', view }`
  with the panel that shows the back. `freePorts` offers it, `fit` counts
  the ports of a part's back as its ports, and an end on the wrong panel
  says which panel the port is on.
- **An element id of a drawing is not accepted as a cable end.** `cable.add`
  and `cable.update` refuse a path such as `bay-1-rear--b01` and name the
  address to give; `freePorts` never offers one; a rack file that already
  holds one opens, and the end reads as loose with the same advice.

### Added
- **`rack/ports.js`**: `seatedPort(item, end, ctx)` answers from the parts
  lists (`loadSlots`) whether a cable end under a bay names a port of what
  is seated, on which panel, and what holds it, with no drawing.
  `settleEnds(rack, ends, ctx)` lays that over the facts a page read, and
  `looseEnds`, `inspect`, `selectCables` and `suggestMedia` use it. The
  exports that read cable ends take the same lists as `parts` and settle
  the same way. It answers for a port the part composes, in a bay the
  item's swaps or its configuration names; a port a skin draws alone, a
  bay left to its default and a device's own ports are still read off the
  drawing.
- **`exportName(zone)`** in `zones.js`: the name the draw.io and OmniGraffle
  exports write for a port. A projected port keeps the element id those
  files have carried, so a file exported again is unchanged, and a cable
  end finds the port by its address as well.
