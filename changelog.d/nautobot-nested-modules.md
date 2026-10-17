### Fixed
- **The Nautobot DCIM modules file writes a module seated in a bay of another
  module** (#1127), after the module it sits in, so the reader no longer
  installs it by hand and the note that said to is gone. Nautobot 3.2.6's CSV
  import names such a bay by lookups down through the parent module, one
  `parent_module_bay__parent_module__` more for each level of nesting, so a
  Fibrain panel in the XCU10 drawer's `slot-1` is
  `Fibrain,XMI1051GA,<device>,drawer,slot-1,Planned` under
  `module_type__manufacturer__name`, `module_type__model`,
  `parent_module_bay__parent_module__parent_module_bay__parent_device__name`,
  `parent_module_bay__parent_module__parent_module_bay__name`,
  `parent_module_bay__name` and `status__name`. One header cannot name rows of
  two depths, so `moduleImportRows` returns the modules in the device's bays as
  `columns` and `rows`, as before, and a section for each deeper level as
  `deeper: [{depth, columns, rows}]`, outermost first; a host writes each as
  a file of its own (`nautobotModuleFile(depth)`, `2b-modules-depth-1.csv`) and
  the README lists them in import order (`rows.modulesIn`). All 28 nested
  modules of the library (20 Fibrain holders, 8 Smartoptics) are written.
  A module seated directly in a bay, and the NetBox modules file, are written
  as before, byte for byte. **The Nautobot modules file changes: nested
  modules are newly written.**
