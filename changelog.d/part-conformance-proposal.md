### Added
- **A proposal, and a prototype runner, for trying every part's cable ends and settings at ingest.**
  `docs/part-conformance-design.md` sets out two checks generated from a built part (every
  place a cable can end, laid and routed in a frame; every setting reached through the agent's
  commands as through the Explorer), where they run, what blocks a merge, how a gap is declared
  and the work to a green library. `spec/tools/dev/part_conformance.py` runs them over a sample
  of 32 devices (`--out` writes the report) and `test_part_conformance.py` holds it to a library
  built in the test. Nothing blocks yet: the proposal waits for approval.
