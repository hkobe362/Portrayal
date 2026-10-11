### Fixed
- **A bundle member with no route of its own no longer rides the whole trunk
  and back** (#1012, `kit/rack/`). A jumper within two units hangs when it is
  on its own and has no waypoint; in a bundle given a route it joined at one
  end of the trunk and left at the other, so a one-unit hop in a bundle down
  eleven units measured 1.64 m and bought a 2 m cord. A member now takes the
  gutter route whatever the two-unit rule says (`ownRoute` and `autoRoute`
  take `{gutter: true}`), and one whose route still does not meet the trunk
  joins and leaves it at the trunk elements nearest its two ports
  (`followTrunk` takes `nearest`, which the new `trunkMeasures` in
  `rack/route.js` measures). **Measured lengths change** for such members,
  and only for them: a member whose own route never met its bundle's trunk
  gets shorter (0.81 m and a 1 m cord for the hop above), and its length in a
  saved rack is rewritten the next time routed lengths are refreshed. A
  member that met the trunk measures what it did.
- The summary of `bundle.create` says when a jumper that hung gets longer in
  the bundle, cable by cable ("c1 hung on its own and now runs with the
  bundle: 0.60 m becomes 0.81 m.").
- `bundle.create` with no route now works one out for short jumpers too, since
  each is taken by the gutter as a member is; it was refused as running with
  none of the others.

### Changed
- The refusal for a cable that runs with none of the others, the note on a
  member that does not meet its bundle's route, and the descriptions of
  `bundle.create` and `bundle.update` say where such a member joins and leaves
  a route given by hand (#1012).
