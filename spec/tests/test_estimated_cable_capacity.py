"""An estimated cable capacity is marked, named for what it is, and never stands
where a maker states a count (P-0027).

`attrs.performance.cable-capacity-estimated: true` is the one mark. A device
that carries it has a count of a named kind, a `capacity` provenance entry whose
confidence is `estimated`, and a basis that opens with the word ESTIMATE and
names the cross-section and the parts it was calibrated on.
"""
import pathlib

import pytest
import yaml

LIB = pathlib.Path(__file__).resolve().parents[2] / "library" / "devices"
DEVICES = {p.parent.name: yaml.safe_load(p.read_text()) for p in sorted(LIB.glob("*/*/device.yaml"))}
ESTIMATED = {n: d for n, d in DEVICES.items() if (d.get("attrs", {}).get("performance") or {}).get("cable-capacity-estimated")}

# every FS cable manager with a duct and no count its maker states
FS_NO_COUNT = {"cmh-sfds1u", "cmh-sfds2u", "cmh-dfds1u", "cmh-dfds2u", "cmv-sfd42u9w", "cmv-sfds45u5w", "cmv-dfds45u5w",
               "uscmh-sfdabsb2u"}


def test_the_fs_ducts_that_state_no_count_carry_an_estimate():
    fs = {n for n, d in ESTIMATED.items() if d.get("manufacturer") == "FS.com"}
    assert fs == FS_NO_COUNT


@pytest.mark.parametrize("name", sorted(ESTIMATED))
def test_an_estimate_is_of_a_named_kind_and_says_how_it_was_made(name):
    d = ESTIMATED[name]
    perf = d["attrs"]["performance"]
    assert isinstance(perf["cable-capacity"], int) and perf["cable-capacity"] > 0
    assert perf.get("cable-capacity-media"), "an estimate is of a kind of cable"
    basis = perf["cable-capacity-basis"]
    assert basis.lstrip().startswith("ESTIMATE"), basis
    for word in ("FS's own Cat6 counts", "mm2 a cable"):
        assert word in basis, (word, basis)
    prov = d["provenance"]["capacity"]
    assert prov["confidence"] == "estimated"
    assert prov["note"].lstrip().startswith("estimated")


@pytest.mark.parametrize("name", sorted(n for n, d in DEVICES.items() if (d.get("attrs", {}).get("performance") or {}).get("cable-capacity") is not None
                                        and n not in ESTIMATED and "ESTIMATE" not in str(d["attrs"]["performance"].get("cable-capacity-basis"))))
def test_a_stated_count_is_never_marked_as_an_estimate(name):
    assert "cable-capacity-estimated" not in DEVICES[name]["attrs"]["performance"]
