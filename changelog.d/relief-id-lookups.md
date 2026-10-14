### Changed
- **`cablePoints` and `extractRelief` read ids from a map instead of a selector
  per lookup** (`kit/relief.js`, P-0035). `cablePoints` ran one
  `querySelector('[id=...]')` per cable point that names a feature, and
  `extractRelief` one per cavity; a trace of a large rack put 4.1 s and 3.2 s
  there. `extractRelief` now builds one id map per call. `cablePoints` builds one
  per marker host, kept to the marker's own parent as before, from the second
  lookup in that host. Results, warnings and fallbacks are unchanged, and the
  first element wins when an id repeats inside one scope. Measured here, the
  gain is in a tree that is not attached to the page (the cavity lookup, 192
  cavities: 8.7 ms to 1.9 ms) and the whole calls are within a few percent
  elsewhere. `@portrayal/kit` is 0.41.0.
