### Added
- **Eaton Tripp Lite series PDU12IEC** (#1044, `eaton/pdu12iec`): a 1U basic
  PDU with an IEC C20 inlet, four C13 outlets on the front and two C19 and
  eight C13 on the rear. The outlets export as `Front 1` to `Front 4` and
  `Rear 1` to `Rear 10`, the names of the NetBox community device type, since
  the unit prints none.
- **`common/breaker-push-reset@1`**: a push-to-reset thermal breaker seen end
  on, a plunger in a threaded bushing under a hex nut.

### Changed
- **A PDU with no network card exports a device type** (`dcim_export.py`). A
  device type was written only when it had an interface, a console port or a
  module bay, so a basic PDU, whose outlets are all a DCIM cables to, wrote
  none. Power outlets now count. No device type already exported changes.
