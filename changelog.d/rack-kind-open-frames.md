### Added
- **A rack is its own kind of library product, `kind: rack`** (#935). It lives at
  `library/racks/<vendor>/<name>/rack.yaml`, is checked against the new
  `rack-product.schema.json` (published under `/schemas/v1/`), and is versioned
  by a `rack.lock.json` beside it: a number a saved rack file copies (height,
  numbering, width, holes, rail depth) is a major, a rating stated where there
  was none a minor, prose and provenance a patch. Lint rule L193 holds a rack's
  name to be free among its vendor's devices and its rails to match its form.
  A rack is not a device and is not the Rack Builder's file; no device, no
  existing generic frame and no part of the rack file changes.
- **The first two rack products, under the maker `apc`:** the NetShelter
  four-post open frame `apc/ar203a` (44U, 9.5 mm square holes, fixed 740 mm rails)
  and the two-post open frame `apc/ar201` (45U, tapped #12-24 holes, equipment
  to 1048 mm), from APC's public data sheets, installation manual and sheet. A
  figure no sheet prints (the label direction, the EIA-310 hole centres and
  opening) is a declared stand-in, with a gap that says what would close it.
- **Rack products ship as npm packages.** `@portrayal/racks-<vendor>-<name>`
  holds the compiled product and the schema it was checked against, one package
  per rack, and `@portrayal/index` carries `rack-products.json` and a `racks`
  table in `packages.json` that names each package and version. Each new rack
  package counts against npm's daily quota of new packages.
- **The kit's package resolver loads racks from those packages.** `dist.js`
  resolves `racks/<vendor>--<name>.rack.json` to the rack's own package, and
  `rackFile(ref)` and `readRack(distAt, ref)` read a product by the ref a saved
  rack file's `frame.ref` carries, `<vendor>/<name>@<major>`; a ref to another
  major is refused with a sentence, never answered with the product it finds.
