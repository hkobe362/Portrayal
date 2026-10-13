### Fixed
- **FS horizontal cable managers stand at their real depth in the Rack Builder.**
  Every one was drawn wholly behind the front rail, because `rack.json` never
  carried the ear position and no part stated one. `rack.json` now carries
  `ears.default` (`name`, `at`) for a device whose `chassis.ears.positions`
  names a default with an `at`, and 22 FS managers state it, each from its own
  provenance notes: a dual-sided finger duct (CMH-DFD1U, CMH-DFDS1U,
  CMH-DFDS2U, CMH-BS-DFDABS2U) spans the rail, and a ring or finger manager
  stands in front of it. This is a placement fix and no dimension changed. The
  CMH-4DRB1U (FS gives no recess figure) and the five rack-side verticals state
  none and keep their placement.
