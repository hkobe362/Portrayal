"""The Dell PowerEdge R660xs (dell/r660xs), against Dell's Installation and Service Manual.

The envelope, each front and its bay numbering, the slots of each riser
configuration's rear, the supply bays, the top view's fans, heatsinks and DIMM
slots, and the DCIM device types. The sources are the ISM's tables 8 and 95,
its figures 1 to 3, 7, 8 and 60.
"""
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
DEVICE = LIB / "devices" / "dell" / "r660xs" / "device.yaml"
DIST = LIB / "dist"
EXPORTS = LIB / "exports"


@pytest.fixture(scope="module")
def doc():
    return yaml.safe_load(DEVICE.read_text())


def _bays(doc, view):
    return doc["views"][view]["components"]["bays"]


def _built_paths(name):
    svg = DIST / f"r660xs.{name}.svg"
    assert svg.exists(), f"{svg.name} is not built: run ./build.sh first"
    return {n.get("data-path") for n in ET.parse(svg).iter() if n.get("data-path")}


# --- the envelope: ISM table 8 -------------------------------------------------

def test_the_envelope_is_ism_table_8(doc):
    ch = doc["chassis"]
    assert ch["width"] == 434.0, "Xb, between the ears"
    assert ch["height"] == 42.8, "Y"
    # Zb, ear to rear wall, 677.1 for 10 or 4 drives, plus Za without the bezel, 22
    assert ch["depth"] == pytest.approx(677.1 + 22.0)
    assert ch["ru"] == 1


@pytest.mark.parametrize("view", ["front", "front-sff8", "front-lff4"])
def test_every_front_is_the_rack_face_across_the_ears(doc, view):
    # Xa, 482 across the ears (482.6 as the rack's face), carrying both control panels
    assert doc["views"][view]["size"] == {"w": 482.6, "h": 42.8}
    ids = {b["id"] for b in _bays(doc, view)}
    assert "panel-left" in ids


def test_the_top_and_sides_run_the_chassis_depth(doc):
    assert doc["views"]["top"]["size"] == {"w": 434.0, "h": doc["chassis"]["depth"]}
    assert doc["views"]["left"]["size"]["w"] == doc["chassis"]["depth"]


# --- the fronts: ISM figures 1 to 3 --------------------------------------------

FRONTS = {
    # view: (bay ids in Dell's order, the numbering each bay carries)
    "front": ([f"drive-{n}" for n in range(10)], list(range(10))),
    "front-sff8": ([f"drive-{n}" for n in range(8)], list(range(8))),
    "front-lff4": ([f"lff-drive-{n}" for n in range(4)], list(range(4))),
}


@pytest.mark.parametrize("view", sorted(FRONTS))
def test_each_front_has_its_bays_numbered_as_dell_numbers_them(doc, view):
    ids, numbers = FRONTS[view]
    drives = [b for b in _bays(doc, view) if b["id"].startswith(("drive-", "lff-drive-"))]
    assert [b["id"] for b in drives] == ids
    assert [b["rel-pos"] for b in drives] == numbers
    assert all(b["default"].endswith(("blank-25@2", "blank-35@1")) for b in drives), \
        "every bay defaults to a blank"


def test_the_8_drive_front_has_its_vent_block_over_columns_4_and_5(doc):
    drives = {b["id"]: b for b in _bays(doc, "front-sff8")}
    # bays 6 and 7 are the lower row of columns 4 and 5: no upper bay there
    assert drives["drive-6"]["at"][0] == pytest.approx(281.1)
    assert drives["drive-7"]["at"][0] == pytest.approx(363.95)
    assert drives["drive-6"]["at"][1] == drives["drive-1"]["at"][1]
    assert drives["drive-7"]["at"][1] == drives["drive-1"]["at"][1]


def test_each_front_is_bound_by_a_configuration(doc):
    views = {}
    for name, cfg in doc["configurations"].items():
        views[name.split("-")[0]] = (cfg.get("views") or {}).get("front", "front")
    assert views == {"sff10": "front", "sff8": "front-sff8", "lff4": "front-lff4"}


def test_the_bezel_hides_the_drives_and_not_the_vga(doc):
    for view, (ids, _) in FRONTS.items():
        bezel = next(p for p in doc["views"][view]["components"]["placements"] if p["id"] == "bezel")
        assert bezel["ref"] == "dell/bezel-1u-16g@1"
        assert bezel["hides"] == ids
        assert "vga" not in bezel["hides"]


# --- the rear for each riser configuration: ISM table 95 -----------------------

SLOTS = {
    # riser configuration: the slots Dell numbers on its risers
    "rc1-1a2a": {"slot-1", "slot-2", "slot-3"},
    "rc2-1a2e": {"slot-1", "slot-2"},
    "rc3-1a": {"slot-1"},
    "rc4-1a-rear2": {"slot-1"},
    "rc5-1a2d": {"slot-1", "slot-2"},
    "rc6-1b2e": {"slot-1", "slot-2"},
}


@pytest.mark.parametrize("rc", sorted(SLOTS))
def test_each_riser_configurations_rear_has_its_slots(rc):
    # the build writes a rear once per distinct rear, so the first front's name stands for all three
    paths = _built_paths(f"sff10-{rc}.rear")
    slots = {p.split("/")[-1] for p in paths if p.count("/") == 2 and "/module/slot-" in p}
    assert slots == SLOTS[rc]
    rear_drives = {p for p in paths if p.startswith("rear-drive-") and "/" not in p}
    assert rear_drives == ({"rear-drive-0", "rear-drive-1"} if rc == "rc4-1a-rear2" else set())


def test_slots_are_numbered_across_the_risers_not_per_riser(doc):
    risers = {}
    for ref in ("riser-1a", "riser-1b", "riser-2a", "riser-2d", "riser-2e"):
        c = yaml.safe_load((LIB / "components" / "dell" / f"r660xs-{ref}" / "v1" / "contract.yaml").read_text())
        risers[ref] = {k for k, b in c["bays"].items() if "slot" in b}
    assert risers == {"riser-1a": {"slot-1"}, "riser-1b": {"slot-1"}, "riser-2a": {"slot-2", "slot-3"},
                      "riser-2d": {"slot-2"}, "riser-2e": {"slot-2"}}


def test_the_riser_widths_are_table_95s():
    def lanes(ref):
        c = yaml.safe_load((LIB / "components" / "dell" / f"r660xs-{ref}" / "v1" / "contract.yaml").read_text())
        return {k: b["slot"]["lanes"] for k, b in c["bays"].items() if "slot" in b}
    assert lanes("riser-1a") == {"slot-1": 16}
    assert lanes("riser-1b") == {"slot-1": 8}
    assert lanes("riser-2a") == {"slot-2": 8, "slot-3": 8}
    assert lanes("riser-2d") == {"slot-2": 8}
    assert lanes("riser-2e") == {"slot-2": 16}


# --- the supplies --------------------------------------------------------------

def test_the_supplies_stand_side_by_side_at_the_right(doc):
    bays = {b["id"]: b for b in _bays(doc, "rear")}
    p1, p2 = bays["psu-1"], bays["psu-2"]
    assert p1["at"][0] > doc["chassis"]["width"] / 2, "not at opposite ends, as on the R660"
    assert p1["at"][0] + p1["size"]["w"] <= p2["at"][0]
    assert p2["at"][0] + p2["size"]["w"] <= doc["chassis"]["width"]
    want = ["dell/psu-1400w-ac-60mm@1", "dell/psu-1100w-ac-60mm@1",
            "dell/psu-800w-ac-60mm@1", "dell/psu-700w-ac-60mm@1"]
    assert p1["accepts"] == p2["accepts"] == want


# --- the top view: ISM figures 8 and 60 ----------------------------------------

def test_the_top_view_carries_seven_fans_two_heatsinks_and_sixteen_dimm_slots(doc):
    bays = _bays(doc, "top")
    fans = [b for b in bays if b["id"].startswith("fan-")]
    dimms = [b["id"] for b in bays if b["id"].startswith("dimm-")]
    assert len(fans) == 7
    assert sorted(dimms) == sorted(f"dimm-{c}{n}" for c in "ab" for n in range(1, 9))
    heatsinks = [p for p in doc["views"]["top"]["components"]["placements"] if p["id"].startswith("heatsink-")]
    assert len(heatsinks) == 2


def test_the_dimm_slots_run_in_figure_60s_order(doc):
    dimms = sorted((b for b in _bays(doc, "top") if b["id"].startswith("dimm-")), key=lambda b: b["at"][0])
    assert [b["id"][5:] for b in dimms] == [
        "b8", "b2", "b6", "b4", "b1", "b7", "b3", "b5", "a8", "a2", "a6", "a4", "a1", "a7", "a3", "a5"]


def test_the_top_view_shows_the_seated_parts_from_above():
    svg = DIST / "r660xs.sff10-rc1-1a2a.top.svg"
    ids = {n.get("id") for n in ET.parse(svg).iter() if n.get("id")}
    assert {"psu-1-plan", "psu-2-plan", "riser-1-plan", "riser-2-plan"} <= ids, "the supplies and risers project"
    paths = _built_paths("sff10-rc1-1a2a.top")
    assert "system-board" in paths
    assert sum(1 for p in paths if p.startswith("fan-") and "/" not in p) == 7


# --- the DCIM device types -----------------------------------------------------

def _types():
    found = sorted((EXPORTS / "netbox" / "device-types" / "Dell").glob("PowerEdge R660xs *.yaml"))
    assert found, "no R660xs device type is exported: run ./publish.sh --no-images"
    return found


def test_the_device_types_are_one_u_and_full_depth():
    for f in _types():
        t = yaml.safe_load(f.read_text())
        assert t["u_height"] == 1.0, f.name
        assert t["is_full_depth"] is True, f.name


def test_a_device_type_is_exported_for_every_front_and_the_default():
    names = {f.stem.split(" ", 2)[2] for f in _types()}
    assert "sff10-rc1-1a2a" in names
    assert {n.split("-")[0] for n in names} == {"sff10", "sff8", "lff4"}
