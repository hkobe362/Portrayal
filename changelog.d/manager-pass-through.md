### Changed
- **A cable crosses a vertical manager front to rear through its back
  windows, not over its top.** `@portrayal/kit` is 0.35.0. In
  `rack/solids.js`, `legCrossings` now judges a pass-through on the stretch of
  the true plate, not the plate grown by the cable's radius, so a cable at a
  window's height crosses straight (no cable could pass any window before).
  `waysRound` tries a zero-U part's holes, nearest first, before going over its
  top or bottom edge, so a cable routed at a height with no window crosses at
  the nearest window. A cable that went over the top of a full-height vertical
  loses that loop and its 1 to 1.7 m of phantom length. The ways round a
  horizontal manager are as they were.
- **A duct waypoint of a narrow rack-face part on a rail is on the part.**
  `pointOf` in `rack/route.js` adds the rail offset that the part's body has
  (`centreX`), so the CMV-5U3W's `duct` point is at about x = -233 on a left
  rail and not at the rack's centre. A route through the bracket is measured
  to the bracket, and 3D draws it there.

### Fixed
- `rack.json` carries the pass-throughs a part declares on its left and right
  views. `rack_index.py` read only the top, front and rear views, so the
  CMH-4DRB1U's two `end-hole` passes never reached the catalogue; its
  pathways are now `end-hole` on each side as well as the five windows and the
  rear brush. Guides are still read from the three views.
