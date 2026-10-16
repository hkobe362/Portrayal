### Added
- **Part conformance runs as a report-only test** (P-0049, D-0034, D-0035).
  `spec/tests/test_part_conformance_report.py` runs `spec/tools/dev/part_conformance.py`
  over the fixed sample and the devices a change touches, in `library/dist`, and writes
  `library/dist/part-conformance.json`. It never fails the suite. `preflight.py` gains a
  `conformance` check that only warns: a device or component file changed and no report
  from this tree is there to read. `docs/part-conformance-design.md` is approved and its
  open questions are answered: a rack PDU's ground pads and one-sided backplane cards are
  one-sided by design, a made-up cable end (C15) is a blocking code, and the Rack Builder
  gets no control for lamps and outlets (a person uses the Explorer, an agent its tools).
