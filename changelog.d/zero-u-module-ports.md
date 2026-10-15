### Added
- **A cable ends on a port of a module seated in a bay of a part beside the
  rack** (P-0038). `@portrayal/kit` is 0.44.0. A vertical PDU's network card
  (the Eaton G4 eNMC in `network-module`) has ports a cable ends on, as a
  switch's supply has its inlet. `zeroUEnds` now lists, after the part's own
  slots, the connector slots of the module in each of its bays, named as a
  rack device's are (`network-module/module/eth0`): what the part's `swaps`
  put in the bay, else its configuration, else the bay's default. Each has its
  `view`, `connector` (`RJ45 port`, `USB-C port`), `kind` (`data`), `plug`
  and, where the bay is not turned, its place on the part (`x`, `y`: the
  bay's `at` plus the slot's `mate` in the module), with the placement's
  `media` and `speed` (the eNMC's PDU+1 and sensor jacks are
  `rj45-telemetry`, not Ethernet). `cable.add` and `cable.update`, the settled
  facts, the route's end point, `freePorts`, `inspect`, `describe`, the
  exports and the refusal text all follow, so a dry run from a management
  port to `network-module/module/eth0` is accepted and the cable reaches the
  jack on the PDU's face. A port the module does not have is refused, naming
  the full list. The eNMC's console is its configuration port `usb-0` (USB-C,
  the console over an emulated serial port); it is an end like the other ports.
  A host that offers a zero-U part's ports from `freePorts` or the `ends` of
  `inspect` gets the module's ports with the new kit.
