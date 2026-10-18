### Fixed
- **A DCIM bay's `Accepts:` line names a module once** (#994). A bay that
  accepts two majors of one module listed its name twice, because the line
  drops the major; the MX-MPC2E-3D MIC bays read it in both the NetBox and the
  Nautobot files. Repeats are dropped, first mention kept. A description
  changes in those files; nothing imported depends on it.
- **The kit finds the type of a module that has no `attrs.model`** (#1025).
  The exporter files such a module under its contract name and the kit looked
  only for the part number, so a cable on one of three FS adapter panels
  (`fhd-fap12lcd-om5`, `fhd-fap12mtp-b`, `fhd-fap12mtp16-a`) was left out of
  the cables file. `moduleTypePath(paths, model, name)` tries the name second.
  No type file is renamed or rewritten.
