### Changed
- **A power cord to an outlet of a vertical PDU arrives from beside it, not over
  the top** (`kit/rack/solids.js`, `route.js`, P-0037). A cord whose last leg
  ran from the rack's interior to an outlet on a zero-U PDU's outward face
  crossed the PDU's body, and the way round it that was tried first was over the
  top or under the foot, so a cord to an outlet near the top ran up past the rack
  and down again. A leg that lands on the face of a zero-U part is now taken in
  past the side of the part that faces the rails, at the outlet's height, and
  the cord turns into the plug from there. On a 42U rack with a switch at U41 and
  the PDU at left-rear, the cord to F42 needs 0.61 m where it needed 0.67 m, and
  stays inside the rack. A route by hand, and a leg that does not land on a face,
  are as they were.
- **The crossing finding no longer counts the body of the part a cable ends
  on, at that end.** The plug leg of a cord on an outlet runs into the PDU's
  body, so every such cord "crossed a body" at its own outlet. That leg is not
  judged against the part it ends on; any other leg through that part, and the
  plug leg through another part, are still found.

### Added
- **A lane between a rail and a part beside it**: on a four-post each lane has an
  inner one, `left-front-inner`, `right-front-inner`, `left-rear-inner` and
  `right-rear-inner`, on the upright's centre line in the rail plane. A route by
  hand names it as it names a gutter (`{lane: 'left-rear-inner', ru}`) and a
  cord to a PDU outlet through it does not run out past the PDU and back. It is
  offered by `waypointLanesOf(frame)` and `inspect`'s `lanes`; `lanesOf(frame)` is
  the four gutters as before, and the automatic route and the detours take the
  gutters alone. A two-post has none. `@portrayal/kit` is 0.42.0.
