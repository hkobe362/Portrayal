### Fixed
- **A cable with no cable type is bend-checked at the default radius in a
  bundle too, and both messages say it is a default** (#1132,
  `kit/rack/bundles.js`, `kit/rack/route.js`). Alone, such a cable was judged at
  24 mm, but as a bundle member it was reported as "not checked". A bundle now
  judges each member at the radius `bendOf` (`kit/rack/resting.js`) gives it, the
  default for an untyped one, so a bundle of untyped cables is no longer "not
  checked" and a mixed bundle checks each cable at its own radius. A warning that
  an untyped cable sets reads "needs 24 mm (the default, it has no cable type)",
  and a bundle with such members says "the bend is checked at 24 mm for c1 and
  c2, the default for a cable with no cable type". `bundleCheck`'s `bend` gains
  `defaulted`, the members judged at the default. A cable with a type, alone or
  in a bundle, is checked as before; the bend is "not checked" only where no
  cable types are loaded.
