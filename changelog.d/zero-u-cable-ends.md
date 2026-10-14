### Added
- **A cable can end on an outlet of a zero-U PDU** beside the rack.
  `@portrayal/kit` is 0.36.0. An end is `{item, path, view}` with `item` the
  part's id (`z3`) and `path` one of its own connector slots (`outlet-a2`).
  `cable.add` and `cable.update` take it; a path the part does not have is
  refused, naming the slots it has by type. Taking the part away keeps its
  cords as loose ends, or removes them with `zerou.remove` `cables: remove`,
  and its id is not handed to the next part while a cord names it.
- **The cord ends at the outlet**: `portPoint` places it from the slot's
  `mate` in `configs.json`, on the panel the PDU looks out of, and the routed
  length is measured to it. The automatic route runs down the gutter beside
  the PDU to the outlet's unit.
- **The catalogue answers for an end on a part beside the rack**
  (`settleEnds`, `zeroUEnds`): it lands, it is a power outlet, and its plug
  is derived. Where a slot takes more than one plug, as a C39 does, the plug
  that pairs with the cord's other end is drawn (C13 with C14, C19 with C20),
  and nothing is stored.
- **`freePorts` lists power ends too.** On a part beside the rack it lists its
  outlets with `type` (C13, C19, C39), the unit each stands at and its
  printed name, and takes `type` and `near` (a unit). On a rack device it adds
  the slots the catalogue knows, such as a supply's C14 or C20 inlet, where the
  page's reader did not hand them in. `inspect` gives a device's and a part's
  `ends`, each with the cable on it.
- **The exports name the PDU end**: the cable schedule gives the part's label
  and the outlet's unit, the bill of materials reads "power at both ends", and
  the sheet notes count a cord on the face its ends are on.
