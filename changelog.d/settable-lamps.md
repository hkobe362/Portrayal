### Added
- **Every lamp and digit a drawing declares can be set in a rack** (P-0041).
  `@portrayal/kit` is 0.45.0. `configs[].states` in `<device>.configs.json`
  listed a PDU's outlets and nothing else, so the rack path refused every
  other state with `led-sys on <device> cannot be set: it declares no state`,
  though the Explorer sets them from the drawing. The build now lists, for
  each configuration, every `data-states` the faces it draws declare, by the
  `data-path` the drawing gives it: the device's status lamps (`led-sys`,
  `led-fan`, `led-ps0`), a seated module's (`psu-0/module/status-led`,
  `fan-0/module/status-led`, a PDU network card's `network-module/module/eth0/led-a`),
  a port's link and activity lamps (`led-port-0/lamp`, QSFP lanes
  `led-port-100/lane-1`), a segment display's digits
  (`status-display/digit-1`: `0` to `f` and `blank`), and a PDU's outlet lamps
  and breaker rockers (`led-a1`, `breaker-a/rocker`). A placement's own
  vocabulary still wins for its path, so the outlets are as they were. No
  kit code loosens the check: `state.set` and `statesFor` read the longer list,
  so a made-up path or state is still refused. The refusal for a path the
  device does not declare now names what it does declare, as vocabularies with
  a few paths each. `inspect` of a device or a part beside the rack gives
  `settable` (`[{can: [names], paths: [...]}]`, grouped by vocabulary) and
  `states` (what it is set to now), and `state.set` says to use it.
  A module put in a bay by the rack's own `swaps` is not listed: only what a
  configuration seats is.

### Changed
- `configs[].states` is no longer outlets alone: a configuration's file is
  larger by its lamp vocabularies (the largest is 22 KB, the library's 675
  configurations 2 MB in all). A reader that took every key of it for an
  outlet now reads lamps too.
