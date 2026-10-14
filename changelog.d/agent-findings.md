### Added
- **An agent is told what a person sees in the Rack Builder's Warnings panel.**
  `describe`'s `Findings:` line counts the cables whose route would enter and
  leave a ring by one face and the cords shorter than their route needs,
  beside the tight bends and the covered ports it already counted. `inspect` of a cable carries
  `route.ring_findings` (`{item, via, text}`), from the new `ringFindingsOf` in
  `rack/route.js`. Kit 0.37.0.

### Changed
- **A tight bend is named at the stop where the cable turns.** A corner of one
  turn at a ring or a lane point reads "at ring 5, between ring 4 and its
  port", and has `stop` in `routePath`'s `bends`, in `bendFindingsOf` and in
  `inspect`. A corner in a lead or a detour is named by the two stops either
  side, as before. The sentences in a cable schedule's notes and in the lay
  notes change with it.
- **`cable.lay` judges a position and a face against the pathway when the
  routes are known.** A position past the number of cables that share the
  pathway is refused, as is one for a cable that does not pass through it, and
  a face on a ring or a duct is refused as one.
