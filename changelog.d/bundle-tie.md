### Fixed
- **A bundle whose trunk is one waypoint is a tie, and has its strap** (#1017,
  `kit/rack/bundles.js`). Four cables that share one ring and nothing else were
  listed and counted but drew nothing and bought no strap, because `straps()`
  returned none for a trunk of fewer than two waypoints. Such a bundle is now
  held by one strap round the pack at that waypoint, as wide as any strap there
  (19 mm, or 25 mm for a pack 25 mm across or more), when two or more members
  ride it. With fewer than two riding it has no strap (#1021) and its notes say
  so. `bundle.create` still accepts a one-waypoint route and a saved rack that
  holds one loads unchanged; a trunk of two or more waypoints is measured and
  strapped exactly as before.
- **The strap count, the BOM and the exports gain the tie's strap, and say
  "tied at" for its length.** `straps()` returns a `tie` strap (`kinds.tie: 1`,
  a key only a tie has); `strapTotals` adds it to `total`, and gives `tie` when
  there is one; `trunkLength` gives `{metres: 0, tie: true}` for a tie;
  `bundleExports` gives such a bundle `tie: true`, `tie_at` and a `length_m` of
  null; the bundle note reads "tied at mgr-1 ring 3, 1 strap", and the BOM line
  counts it ("1 round a bundle tied at one point"). **A rack with a one-waypoint
  bundle of two or more cables riding it buys one more strap than before.** The
  rack JSON, the NetBox and Nautobot files and draw.io have no field for a tie
  and are unchanged. `describe` says "fewer than two cables ride it" of a tie
  only when fewer than two do, not whenever the strap count is 0 (a bundle set
  to no straps has none for another reason), and `ridersOf` is exported.
