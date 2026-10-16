### Added
- **Two FS FHD-FAPM6 panels that come loaded: `fs/fhd-fapm6-rj45@1` and
  `fs/fhd-fapm6-blank@1`.** The RJ45 panel is the FAPM6's face with six Cat6
  RJ45 ports, `p1` to `p6` numbered as FS numbers the panel, each a port a
  `generic/rj45-plug@1` cable end lands on; its rear is a punch-down (IDC)
  termination and has no cable port. The blank panel closes each opening with
  the new `common/keystone-blank@1` insert and has no ports. Both are
  Portrayal configurations of the FAPM6, not FS SKUs, and both are listed in
  the `accepts` of the seven enclosures that list the FAPM6 (FHD-1UBE, 1UFCE,
  1UFMT-N, 1UFMT-S, 1UME, 2UFCE, 4UFCE), each bumped a minor. Nothing here
  seats a keystone in a single opening; the FAPM6 itself is unchanged.
