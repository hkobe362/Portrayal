### Changed
- Lint's air-aperture check (L64) works out each decor rectangle once per item,
  not once per sample point. The warnings are the same, byte for byte, and
  `devices_index.py`, which lints every device for its derived gaps, takes
  about half the time it did.
- Collecting the test suite lists `library/dist` once, not once per sized
  view, and the allow-list test collects in one process. Collection is about
  a fifth faster and gives the same tests.
