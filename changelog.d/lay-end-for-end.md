### Fixed
- **The same cable written end for end gets the same lay and the same
  findings** (#986, `kit/rack/route.js`). The lay read a path from its end a,
  so on a sample of 1,803 generated cables 38 measured differently written
  the other way round and 9 reported a different number of bends.
  `routePath` now lays a cable from both ends and keeps one lay by a rule
  that does not know which end was written first: fewer bodies crossed, then
  less short of room, then shorter, then the end whose port sorts first.
  None of the 1,803 differs now. **Routed lengths change** on the few cables
  whose other lay is the better one, and are rewritten in a saved rack the
  next time routed lengths are refreshed: seven of the 1,803, five shorter
  (up to 128 mm) and two longer (15 and 82 mm, for fewer tight bends), one
  up a stock size. Where the two lays are as good as each other the path's
  points can differ though its length does not. A reader on the routing
  context (`plugReachOf`, `trayFaceOf`, `bendOf`, `diameterOf`) can be handed
  a twin of the cable, the same id with `a` and `b` exchanged, and is asked
  more than once.
