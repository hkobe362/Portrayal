### Added
- **Three generic rack shapes, `generic/2-post-frame`, `generic/4-post-frame` and
  `generic/4-post-cabinet`** (#1105). They are rack products (`kind: rack`) that
  stand for the Rack Builder's generic frames: the same height, numbering and
  hole style the Rack Builder gives a new frame, plus 465 mm hole centres and a
  450 mm opening. Those two figures were read from an IBM rack-requirements
  page and from Wikipedia, not from the EIA-310 text, so each product says so in
  its `gaps` and carries the page it came from. No 23-inch figure was found, so
  none is stated. The Rack Builder's frame with no product is unchanged, and
  nothing in `library/devices/` or in the APC frames changes. Each shape ships
  as an npm package, `@portrayal/racks-generic-<name>`.
- **Rack types in the DCIM exports.** `library/exports/netbox/rack-types/<Manufacturer>/<model>.yaml`
  is a NetBox rack type for each rack product, with its `form_factor`
  (`2-post-frame`, `4-post-frame` or `4-post-cabinet`), width, height in U,
  outer box, mounting depth and weight; the cooling fields are left out, as no
  source gives them. `library/exports/nautobot/rack-types/` beside it holds
  the fields of a Nautobot rack, with the facts Nautobot has no field for in
  `comments`. `publish.sh` and `preflight.py` write them through
  `dcim_export.py --racks`. The kit has no change and its version is not bumped.
