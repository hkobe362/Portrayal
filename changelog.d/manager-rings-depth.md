### Added
- **`rack.json` carries where a rack device's rings stand** (#1027,
  `rack_solids.ring_depths`, `rack_index.py`). A device that is not a
  rack-face part and lists ring guides gains `rings`, `{via: {z, depth}}`:
  `z` the middle of the ring on the device's plan, in mm back from its front,
  and `depth` its band along its run (the contract's `depth` where it states
  one). It is read from the drawing, never stated, and written for the five
  FS managers that have rings: CMH-4DRB1U, CMH-5DR1U, CMH-5DR1U-N,
  CMH-6DR1U and USCMH-5DR1U (the CMH-5DR1U's rings stand 42.75 mm back, 9.9
  mm thick). A rack-face part and a ring on a tray have none: the kit places
  them from the part's depth and the tray. No part, version or export changes.

### Changed
- **`@portrayal/kit` is 0.33.0: a rack-mounted manager's rings are at their
  real depth, and a manager taller than one unit is an `autoRoute`
  neighbour** (#1027). The entry below says how the kit routes now.
- **A rack-mounted ring manager's rings are at their depth, and a manager
  taller than one unit is used by `autoRoute`** (#1027, kit
  `rack/route.js` `guidesFor`, `rack/fit.js` `neighbours`). The kit stood
  every guide of a rack device on its rail plane and took a ring that stated
  no `depth` as 10 mm thick, so a lead through a CMH-5DR1U was always tight.
  A ring on the face the device is mounted on is now `z` behind that rail
  (`pointOf`), and a ring the page gives no `depth` takes the catalogue's. A
  catalogue built before this has no `rings` and routes as before. A manager
  of more than one unit (one that lists guides) above or below a device is a
  neighbour the route looks to, as a one-unit one was. **This changes the
  routed length, the corners and the findings of a rack with such a manager,
  and a saved rack's automatic routes are re-laid; a hand route keeps its
  waypoints.** A rack of lacers only is unchanged.
