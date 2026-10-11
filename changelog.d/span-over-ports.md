### Added
- **A span that crosses in front of other ports is reported** (#1013,
  `kit/rack/route.js`). With no horizontal manager a cable runs from its lane
  to its port across the faces between, and nothing said so. `routePath`
  returns `covers`, each port such a span passes in front of, and
  `coverFindings(rack, ctx, nameOf)` gives one finding a cable with the ports
  by device and the advice to add a horizontal cable manager. It warns and
  never refuses. Only a span from a port to a lane or to the other port is
  judged; a leg into or out of a ring, a duct or a tray is not.
- **`ctx.portBoxesOf(itemId)`**, an optional reader on the routing context:
  `[{path, view, x, y, w?, h?}]`, every port of a device in the frame `portX`
  and `portY` use. Without it a span is judged against the ports that hold a
  cable, which the kit can already place; with it, against every port. A
  context without it is as valid as it was. `PORT_BOX` and `COVER_DEPTH` are
  the two estimates the check rests on.
