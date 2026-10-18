### Added
- **`rack.json` gains `frames`: the rack products a frame can be set from**
  (#935, `spec/tools/portrayal/rack_index.py`). One row per product in
  `library/racks/`, keyed by its ref `<vendor>/<name>@<major>` (today
  `apc/ar203a@1`, `apc/ar201@1` and the three `generic/` shapes). A row holds
  the product's identity and the numbers it states (`form`, `ru`, `numbering`,
  `width`, `hole-centres`, `opening`, `holes`, `rails`, `max-device-depth`,
  `outer`, `weight-kg`, `load`) exactly as the manifest has them; a key the
  product does not hold is absent from its row, never zero. Its sources
  (datasheet, references, provenance, gaps) stay in the product's own file.
  `rack.json` stays `format: 1`, its `devices` are unchanged, and a `rack.json`
  built before the key reads as having no products. `loadCatalog` returns
  `frames` and `frameOf(ref)`, and refuses a ref two roots both hold.
- **`frame.apply` and `frame.customise` rack commands, and `kit/rack/frames.js`**
  (#935, `kit/rack/commands.js`). `frame.apply {ref}` writes `frame.ref` and
  copies the product's numbers into the frame (`kind` from `form`, `heightRU`,
  `numbering`, `holes`, `railDepth` as the fixed or factory depth, `usableDepth`
  as `max-device-depth`), by the path a frame edit takes, so a lower height packs
  devices down and the parts beside the rack follow. It writes only `ref` and
  the frame keys rack file version 3 already had; a product that needs `width`,
  `numbering.start` or a round hole is refused with a sentence. `frame.customise`
  sets `ref` to `null` and keeps every number. `createRackEditor` takes
  `frameOf` (from `loadCatalog`); a page that passes none behaves as before.
  `frames.js` exports the same rules as pure functions (`appliedFrame`,
  `editRefusal`, `customisedFrame`, `frameState`, `frameProducts`) for page
  controls. The Rack Builder's frame picker follows in the site.

- **`frameName(row)` in `kit/rack/frames.js` is the name a rack product is shown
  by** (#935). It was the private rule behind the kit's own sentences: the maker
  and model (`APC AR201`), or the ref when a row has neither. A row's `name` is
  the short id (`ar201`), so a page lists products by `frameName`. The kit's
  sentences now use the export; none of their wording changes, and `rack.json`
  gains no key.

### Changed
- **A frame that holds a rack product refuses an edit to a number the product
  fixes** (`frame` command). While `frame.ref` is set, `kind`, `heightRU`,
  `numbering`, `holes`, `usableDepth` (where the product states
  `max-device-depth`) and `startU` can only be asked for at the product's own
  value, and `railDepth` only within its range and step (a fixed depth allows
  only itself). `frame.customise` frees them. A frame with `ref: null` is edited
  exactly as before, and so is one whose ref the catalogue lacks or one on a page
  with no catalogue of products.
- **Loading a rack whose frame ref the catalogue lacks, or whose numbers no
  longer match the product, says so** (`loadDoc` findings). The frame is drawn
  from the file's own numbers; the note offers to apply the product again.
