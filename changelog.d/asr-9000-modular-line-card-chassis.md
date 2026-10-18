### Fixed
- `cisco/asr-9006`, `asr-9904`, `asr-9906`, `asr-9910`, `asr-9912` and `asr-9922` now
  accept `cisco/a9k-mod400-se@2`, `a9k-mod400-tr@2`, `a9k-mod200-se@2` and
  `a9k-mod200-tr@2` in every line card slot, as the `asr-9010` already did. Cisco data sheet
  c78-735809 (p4, and Table 2, "Chassis compatibility", with its per-chassis card counts)
  names all seven routers; each chassis cites it in its provenance, and its line card slot
  count equals Table 2's maximum. The RSP and RP slots do not take them. The MOD80 and MOD160
  are not in that data sheet and stay where they were. Each of the six chassis takes a minor
  version bump, and the DCIM exports change in their slot bay descriptions (#885).
