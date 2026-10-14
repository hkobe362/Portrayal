### Changed
- **Opening a large rack in 3D no longer spends seconds finding nodes by id**
  (`kit/relief.js`, P-0035). `cablePoints` ran one `querySelector('[id=...]')`
  per cable point that names a feature, and `extractRelief` one per cavity, each
  a walk of the drawing; a trace of a rack of about 76 items and 450 cables put
  4.1 s and 3.2 s there. Each now builds an id map once (`cablePoints` one per
  marker host, kept to the marker's own parent as before) and reads it. Results,
  warnings and fallbacks are unchanged, and the first element wins when an id
  repeats inside one scope. `@portrayal/kit` is 0.41.0.
