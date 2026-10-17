### Fixed
- **A DCIM cables file writes a cable on a module seated in a bay of another
  module** (#1024). A Fibrain holder in the XCU10 drawer's slot was left out
  with the reason "the card has no module bay", which was untrue: the committed
  `XCU10` module type has module bays on both platforms. An end is now named
  through each level's installed module, with the `{module}` and
  `{module.parent}` tokens the type files use, and its port names are taken
  from `optical.ports` as for a panel in a device bay: port 3 of the holder in
  `slot-1` of a drawer in the bay `drawer` is `drawer/slot-1/3` on NetBox and
  on Nautobot. 28 of the 63 modules with fibre ports are reached this way (20
  Fibrain holders and 8 Smartoptics modules), where the issue counted 20.
  A panel seated directly in a bay is written as before, byte for byte.
  **The cables file changes: cables on nested modules are newly written.**
- **A NetBox modules file installs a module in a bay of another module**
  (#1024), after the module it sits in, by the bay's name as NetBox installs it
  (`drawer/slot-1`). Without the row the cables on its ports would name ports
  that do not exist, and NetBox refuses a cables file whole for one such row.
  Nautobot's module import names a bay by its device and a bay of a module is
  on none, so that file still leaves such a module out, now saying which bay to
  install it in; its cables are written, and `import_cables.py` reports the
  ports it cannot find until the module is there.
- `moduleImportRows` and `resolveEnd` take the module type seated at a nested
  bay by its path (`drawer/module/slot-1`); a host that answers `moduleAt` for
  a device's bay ids only gets "what is seated in drawer/module/slot-1 has no
  module type" for a nested one. `renderName(template, positions)` is new.
