### Added
- **An optional `audience` on device and component contracts** (P-0044). One of
  `public`, `internal`, `nda`, or `customer:<name>` (lower case letters, digits
  and hyphens). It lets a project that keeps private entries beside the public
  library write them in the same format and say who each is for. The field is
  optional and absent means `public`; Portrayal's own library only ever uses
  `public`. Lint L192 holds the public library to that, and `lint.py
  --allow-audience` turns it off for a library of private entries.
  `devices.json`, `components.json` and `kits.json` carry `audience` on an
  entry that sets it, and nothing on one that does not, so a public index is
  unchanged. `device.schema.json` and `component.schema.json` gain the property.
